import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { DateTime } from "luxon";
import * as argon2 from "argon2";
import { Actor, Public, publicUser, Roles, safeUser } from "./auth";
import { ownSchedule, patientId } from "./appointments";
import { Db } from "./db";
import {
  ActiveDto,
  AvailabilityDto,
  BlockDto,
  DoctorDto,
  DoctorEditDto,
  ProfileDto,
  SlotsQuery,
  SpecialtyDto,
  TypeDto,
} from "./dto";
import {
  fitsWindow,
  generatedSlots,
  overlap,
  Scheduling,
  timezone,
} from "./scheduling";
const doctorInclude = {
  user: { select: { name: true, email: true, isActive: true } },
  specialty: true,
  appointmentTypes: { include: { appointmentType: true } },
  availability: {
    orderBy: [{ dayOfWeek: "asc" as const }, { startMinute: "asc" as const }],
  },
};
@Controller()
export class ClinicController {
  constructor(
    private db: Db,
    private scheduling: Scheduling,
  ) {}
  @Public() @Get("config") config() {
    return {
      name: "Clearwell Clinic",
      timezone: timezone(),
      holdMinutes: 5,
      serverNow: new Date(),
    };
  }
  @Public() @Get("health") async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("specialties") specialties() {
    return this.db.specialty.findMany({ orderBy: { name: "asc" } });
  }
  @Roles("ADMIN") @Post("specialties") specialtyCreate(
    @Body() dto: SpecialtyDto,
  ) {
    return this.db.specialty.create({ data: dto });
  }
  @Roles("ADMIN") @Patch("specialties/:id") specialtyEdit(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SpecialtyDto,
  ) {
    return this.db.specialty.update({ where: { id }, data: dto });
  }
  @Get("appointment-types") types(@Req() req: { user: Actor }) {
    return this.db.appointmentType.findMany({
      where: req.user.role === "ADMIN" ? {} : { isActive: true },
      orderBy: { name: "asc" },
    });
  }
  @Roles("ADMIN") @Post("appointment-types") typeCreate(@Body() dto: TypeDto) {
    return this.db.write((tx) => tx.appointmentType.create({ data: dto }));
  }
  @Roles("ADMIN") @Patch("appointment-types/:id") typeEdit(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TypeDto,
  ) {
    return this.db.write((tx) =>
      tx.appointmentType.update({ where: { id }, data: dto }),
    );
  }
  @Get("doctors") async doctors(@Req() req: { user: Actor }) {
    const doctors = await this.db.doctorProfile.findMany({
      where: req.user.role === "ADMIN" ? {} : { user: { isActive: true } },
      include: doctorInclude,
      orderBy: { user: { name: "asc" } },
    });
    return doctors.map((d) =>
      req.user.role === "ADMIN"
        ? d
        : { ...d, user: { name: d.user.name, isActive: d.user.isActive } },
    );
  }
  @Get("doctors/:id") async doctor(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const doctor = await this.db.doctorProfile.findUnique({
      where: { id },
      include: doctorInclude,
    });
    if (!doctor || (!doctor.user.isActive && req.user.role !== "ADMIN"))
      throw new NotFoundException("Doctor not found.");
    return req.user.role === "ADMIN"
      ? doctor
      : {
          ...doctor,
          user: { name: doctor.user.name, isActive: doctor.user.isActive },
        };
  }
  @Roles("ADMIN") @Post("doctors") async createDoctor(@Body() dto: DoctorDto) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    return this.db.write((tx) =>
      tx.doctorProfile.create({
        data: {
          specialty: { connect: { id: dto.specialtyId } },
          user: {
            create: {
              name: dto.name,
              email: dto.email,
              passwordHash,
              role: "DOCTOR",
            },
          },
          appointmentTypes: {
            create: dto.appointmentTypeIds.map((id) => ({
              appointmentType: { connect: { id } },
            })),
          },
        },
        include: doctorInclude,
      }),
    );
  }
  @Roles("ADMIN") @Patch("doctors/:id") editDoctor(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DoctorEditDto,
  ) {
    return this.db.write(async (tx) => {
      await tx.doctorAppointmentType.deleteMany({ where: { doctorId: id } });
      return tx.doctorProfile.update({
        where: { id },
        data: {
          specialty: { connect: { id: dto.specialtyId } },
          user: {
            update: {
              name: dto.name,
              isActive: dto.isActive,
              ...(dto.isActive ? {} : { tokenVersion: { increment: 1 } }),
            },
          },
          appointmentTypes: {
            create: dto.appointmentTypeIds.map((appointmentTypeId) => ({
              appointmentType: { connect: { id: appointmentTypeId } },
            })),
          },
        },
        include: doctorInclude,
      });
    });
  }
  @Roles("PATIENT") @Get("doctors/:id/slots") slots(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: SlotsQuery,
  ) {
    return this.db.write(async (tx, now) => {
      const day = DateTime.fromISO(query.date, { zone: timezone() });
      if (
        !day.isValid ||
        day.startOf("day") <
          DateTime.fromJSDate(now, { zone: timezone() }).startOf("day") ||
        day > DateTime.fromJSDate(now, { zone: timezone() }).plus({ days: 365 })
      )
        throw new BadRequestException(
          "Choose a date within the next 365 days.",
        );
      const { doctor, type } = await this.scheduling.typeAndDoctor(
        tx,
        id,
        query.appointmentTypeId,
      );
      const owner = patientId(req.user);
      const range = {
        startAt: { lt: day.plus({ days: 1 }).toJSDate() },
        endAt: { gt: day.toJSDate() },
      };
      const [appointments, holds, blocks] = await Promise.all([
        tx.appointment.findMany({
          where: {
            ...range,
            status: "CONFIRMED",
            OR: [{ doctorId: id }, { patientId: owner }],
          },
        }),
        tx.temporaryHold.findMany({
          where: {
            ...range,
            status: "ACTIVE",
            expiresAt: { gt: now },
            OR: [{ doctorId: id }, { patientId: owner }],
          },
        }),
        tx.blockedTime.findMany({ where: { ...range, doctorId: id } }),
      ]);
      const busy = [...appointments, ...holds, ...blocks];
      return {
        serverNow: now,
        slots: generatedSlots(
          query.date,
          doctor.availability,
          type.durationMinutes,
          timezone(),
          now,
        ).filter((slot) => !busy.some((b) => overlap(slot, b))),
      };
    });
  }
  @Roles("ADMIN", "DOCTOR") @Get("doctors/:id/availability") async availability(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    ownSchedule(req.user, id);
    return {
      windows: await this.db.doctorAvailability.findMany({
        where: { doctorId: id },
        orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      }),
      blocks: await this.db.blockedTime.findMany({
        where: { doctorId: id, endAt: { gt: new Date() } },
        orderBy: { startAt: "asc" },
      }),
    };
  }
  @Roles("ADMIN", "DOCTOR") @Put("doctors/:id/availability") saveAvailability(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AvailabilityDto,
  ) {
    ownSchedule(req.user, id);
    const windows = [...dto.windows].sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
    );
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i],
        previous = windows[i - 1];
      if (
        w.startMinute >= w.endMinute ||
        (previous &&
          previous.dayOfWeek === w.dayOfWeek &&
          previous.endMinute > w.startMinute)
      )
        throw new BadRequestException(
          "Working hours must have valid, non-overlapping time ranges.",
        );
    }
    return this.db.write(async (tx, now) => {
      if (!(await tx.doctorProfile.findUnique({ where: { id } })))
        throw new NotFoundException("Doctor not found.");
      const appointments = await tx.appointment.findMany({
        where: { doctorId: id, status: "CONFIRMED", endAt: { gt: now } },
      });
      const holds = await tx.temporaryHold.findMany({
        where: { doctorId: id, status: "ACTIVE", expiresAt: { gt: now } },
      });
      if (
        [...appointments, ...holds].some(
          (a) => !fitsWindow(a.startAt, a.endAt, windows),
        )
      )
        throw new BadRequestException(
          "These hours would exclude an existing appointment or reservation. Resolve those conflicts first.",
        );
      await tx.doctorAvailability.deleteMany({ where: { doctorId: id } });
      await tx.doctorAvailability.createMany({
        data: windows.map((w) => ({ doctorId: id, ...w })),
      });
      return { windows };
    });
  }
  @Roles("ADMIN", "DOCTOR") @Post("doctors/:id/blocked-times") block(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: BlockDto,
  ) {
    ownSchedule(req.user, id);
    return this.db.write(async (tx, now) => {
      const startAt = new Date(dto.startAt),
        endAt = new Date(dto.endAt);
      if (startAt <= now || startAt >= endAt)
        throw new BadRequestException(
          "Choose a future start time before the end time.",
        );
      const range = {
        doctorId: id,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      };
      const count =
        (await tx.appointment.count({
          where: { ...range, status: "CONFIRMED" },
        })) +
        (await tx.temporaryHold.count({
          where: { ...range, status: "ACTIVE", expiresAt: { gt: now } },
        })) +
        (await tx.blockedTime.count({ where: range }));
      if (count)
        throw new BadRequestException(
          "This period overlaps an appointment, reservation, or blocked time. Resolve the conflict first.",
        );
      return tx.blockedTime.create({
        data: { doctorId: id, startAt, endAt, reason: dto.reason },
      });
    });
  }
  @Roles("ADMIN", "DOCTOR")
  @Delete("doctors/:id/blocked-times/:blockId")
  removeBlock(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
    @Param("blockId", ParseUUIDPipe) blockId: string,
  ) {
    ownSchedule(req.user, id);
    return this.db.write(async (tx, now) => {
      const block = await tx.blockedTime.findUnique({ where: { id: blockId } });
      if (!block || block.doctorId !== id)
        throw new NotFoundException("Blocked time not found.");
      if (block.startAt <= now)
        throw new BadRequestException(
          "Only future blocked time can be removed.",
        );
      return tx.blockedTime.delete({ where: { id: blockId } });
    });
  }
  @Patch("profile") async profile(
    @Req() req: { user: Actor },
    @Body() dto: ProfileDto,
  ) {
    return publicUser(
      await this.db.user.update({
        where: { id: req.user.id },
        data: dto,
        select: safeUser,
      }),
    );
  }
  @Roles("ADMIN") @Get("users") users() {
    return this.db.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true },
      orderBy: { name: "asc" },
    });
  }
  @Roles("ADMIN") @Patch("users/:id") userStatus(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ActiveDto,
  ) {
    if (id === req.user.id)
      throw new BadRequestException("You cannot deactivate your own account.");
    return this.db.write((tx) =>
      tx.user.update({
        where: { id },
        data: { isActive: dto.isActive, tokenVersion: { increment: 1 } },
        select: { id: true, name: true, isActive: true },
      }),
    );
  }
}
