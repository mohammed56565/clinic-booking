import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { DateTime } from "luxon";
import { Actor, Roles } from "./auth";
import { Db, Tx } from "./db";
import { ConfirmDto, HoldDto, OutcomeDto } from "./dto";
import {
  conflict,
  fitsWindow,
  generatedSlots,
  Scheduling,
  timezone,
} from "./scheduling";
export const appointmentInclude = {
  doctor: { select: { id: true, user: { select: { name: true } } } },
  patient: {
    select: { id: true, user: { select: { name: true, email: true } } },
  },
  specialty: true,
  appointmentType: true,
} as const;
export function patientId(actor: Actor) {
  if (actor.role !== "PATIENT" || !actor.patient)
    throw new ForbiddenException("Only patients can book appointments.");
  return actor.patient.id;
}
export function ownSchedule(actor: Actor, doctorId: string) {
  if (
    actor.role !== "ADMIN" &&
    (actor.role !== "DOCTOR" || actor.doctor?.id !== doctorId)
  )
    throw new ForbiddenException(
      "You cannot manage another doctor’s schedule.",
    );
}
@Injectable()
export class Appointments {
  constructor(
    private db: Db,
    private scheduling: Scheduling,
  ) {}
  async owned(tx: Tx, id: string, actor: Actor) {
    const record = await tx.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
    if (!record) throw new NotFoundException("Appointment not found.");
    if (
      actor.role !== "ADMIN" &&
      !(actor.role === "DOCTOR" && actor.doctor?.id === record.doctorId) &&
      !(actor.role === "PATIENT" && actor.patient?.id === record.patientId)
    )
      throw new ForbiddenException("You cannot access this appointment.");
    return record;
  }
  future(record: { status: string; startAt: Date }, now: Date) {
    if (record.status !== "CONFIRMED" || record.startAt <= now)
      throw new BadRequestException(
        "Only future confirmed appointments can be changed.",
      );
  }
  createHold(actor: Actor, dto: HoldDto) {
    const owner = patientId(actor);
    return this.db.write(async (tx, now) => {
      if (dto.rescheduleOfId)
        this.future(await this.owned(tx, dto.rescheduleOfId, actor), now);
      const { doctor, type } = await this.scheduling.typeAndDoctor(
        tx,
        dto.doctorId,
        dto.appointmentTypeId,
      );
      const startAt = new Date(dto.startAt);
      if (
        startAt >
        DateTime.fromJSDate(now, { zone: timezone() })
          .plus({ days: 365 })
          .toJSDate()
      )
        throw new BadRequestException(
          "Choose a date within the next 365 days.",
        );
      const date = DateTime.fromJSDate(startAt, {
        zone: timezone(),
      }).toISODate()!;
      const slot = generatedSlots(
        date,
        doctor.availability,
        type.durationMinutes,
        timezone(),
        now,
      ).find((s) => +s.startAt === +startAt);
      if (!slot)
        throw new BadRequestException(
          "Choose a valid future slot within working hours.",
        );
      const activeCount = await tx.temporaryHold.count({
        where: { patientId: owner, status: "ACTIVE", expiresAt: { gt: now } },
      });
      if (activeCount >= 3)
        throw new BadRequestException(
          "Release an existing reservation before holding another time.",
        );
      await this.scheduling.assertFree(
        tx,
        doctor.id,
        owner,
        slot.startAt,
        slot.endAt,
        now,
      );
      const hold = await tx.temporaryHold.create({
        data: {
          patientId: owner,
          doctorId: doctor.id,
          appointmentTypeId: type.id,
          ...slot,
          expiresAt: new Date(+now + 300000),
          rescheduleOfId: dto.rescheduleOfId,
        },
        include: {
          doctor: {
            select: {
              id: true,
              user: { select: { name: true } },
              specialty: true,
            },
          },
          appointmentType: true,
        },
      });
      return { ...hold, serverNow: now };
    });
  }
  confirm(actor: Actor, holdId: string, rescheduleOfId?: string) {
    const owner = patientId(actor);
    return this.db.write(async (tx, now) => {
      const hold = await tx.temporaryHold.findUnique({ where: { id: holdId } });
      if (!hold) throw new NotFoundException("Reservation not found.");
      if (hold.patientId !== owner)
        throw new ForbiddenException(
          "This reservation belongs to another patient.",
        );
      if (hold.rescheduleOfId !== (rescheduleOfId || null))
        throw new BadRequestException(
          "This reservation must be confirmed through its original booking flow.",
        );
      // A retried confirmation returns the same booking instead of creating a duplicate.
      if (hold.status === "CONSUMED") {
        const existing = await tx.appointment.findUnique({
          where: { holdId },
          include: appointmentInclude,
        });
        if (existing) return existing;
      }
      if (hold.status !== "ACTIVE" || hold.expiresAt <= now)
        throw new BadRequestException(
          "Your reservation time expired. Please select an available appointment again.",
        );
      let original;
      if (rescheduleOfId) {
        original = await this.owned(tx, rescheduleOfId, actor);
        this.future(original, now);
      }
      const { doctor, type } = await this.scheduling.typeAndDoctor(
        tx,
        hold.doctorId,
        hold.appointmentTypeId,
      );
      if (
        hold.startAt <= now ||
        +hold.endAt - +hold.startAt !== type.durationMinutes * 60000 ||
        !fitsWindow(hold.startAt, hold.endAt, doctor.availability)
      )
        throw conflict();
      await this.scheduling.assertFree(
        tx,
        doctor.id,
        owner,
        hold.startAt,
        hold.endAt,
        now,
        hold.id,
      );
      await tx.temporaryHold.update({
        where: { id: holdId },
        data: { status: "CONSUMED" },
      });
      if (original)
        await tx.appointment.update({
          where: { id: original.id },
          data: { status: "CANCELLED", cancelledAt: now },
        });
      const appointment = await tx.appointment.create({
        data: {
          patientId: owner,
          doctorId: doctor.id,
          specialtyId: doctor.specialtyId,
          appointmentTypeId: type.id,
          holdId,
          startAt: hold.startAt,
          endAt: hold.endAt,
        },
        include: appointmentInclude,
      });
      if (original)
        await tx.appointment.update({
          where: { id: original.id },
          data: { rescheduledToId: appointment.id },
        });
      return appointment;
    });
  }
  cancel(actor: Actor, id: string) {
    return this.db.write(async (tx, now) => {
      const record = await this.owned(tx, id, actor);
      this.future(record, now);
      await tx.temporaryHold.updateMany({
        where: { rescheduleOfId: id, status: "ACTIVE" },
        data: { status: "RELEASED" },
      });
      return tx.appointment.update({
        where: { id },
        data: { status: "CANCELLED", cancelledAt: now },
        include: appointmentInclude,
      });
    });
  }
}
@Controller()
export class AppointmentController {
  constructor(
    private db: Db,
    private appointments: Appointments,
  ) {}
  @Roles("PATIENT") @Post("holds") createHold(
    @Req() req: { user: Actor },
    @Body() dto: HoldDto,
  ) {
    return this.appointments.createHold(req.user, dto);
  }
  @Roles("PATIENT") @Get("holds") async holds(@Req() req: { user: Actor }) {
    const now = new Date();
    return {
      serverNow: now,
      holds: await this.db.temporaryHold.findMany({
        where: {
          patientId: patientId(req.user),
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
        include: {
          doctor: {
            select: {
              id: true,
              user: { select: { name: true } },
              specialty: true,
            },
          },
          appointmentType: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    };
  }
  @Roles("PATIENT") @Delete("holds/:id") release(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.db.write(async (tx) => {
      const hold = await tx.temporaryHold.findUnique({ where: { id } });
      if (!hold) throw new NotFoundException("Reservation not found.");
      if (hold.patientId !== patientId(req.user))
        throw new ForbiddenException(
          "You cannot release another patient’s reservation.",
        );
      if (hold.status === "ACTIVE")
        await tx.temporaryHold.update({
          where: { id },
          data: { status: "RELEASED" },
        });
      return { message: "Reservation released." };
    });
  }
  @Roles("PATIENT") @Post("appointments") confirm(
    @Req() req: { user: Actor },
    @Body() dto: ConfirmDto,
  ) {
    return this.appointments.confirm(req.user, dto.holdId);
  }
  @Get("appointments") list(@Req() req: { user: Actor }) {
    const actor = req.user;
    return this.db.appointment.findMany({
      where:
        actor.role === "PATIENT"
          ? { patientId: patientId(actor) }
          : actor.role === "DOCTOR"
            ? { doctorId: actor.doctor!.id }
            : {},
      include: appointmentInclude,
      orderBy: { startAt: "desc" },
    });
  }
  @Get("appointments/:id") detail(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.appointments.owned(this.db, id, req.user);
  }
  @Roles("PATIENT", "ADMIN") @Post("appointments/:id/cancel") cancel(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.appointments.cancel(req.user, id);
  }
  @Roles("PATIENT") @Post("appointments/:id/reschedule") reschedule(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConfirmDto,
  ) {
    return this.appointments.confirm(req.user, dto.holdId, id);
  }
  @Roles("ADMIN", "DOCTOR") @Post("appointments/:id/outcome") outcome(
    @Req() req: { user: Actor },
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: OutcomeDto,
  ) {
    return this.db.write(async (tx, now) => {
      const record = await this.appointments.owned(tx, id, req.user);
      if (record.status !== "CONFIRMED")
        throw new BadRequestException(
          "This appointment already has a final outcome.",
        );
      if (record.endAt > now)
        throw new BadRequestException(
          "Record the outcome after the appointment ends.",
        );
      return tx.appointment.update({
        where: { id },
        data: {
          status: dto.status,
          completedAt: dto.status === "COMPLETED" ? now : null,
        },
        include: appointmentInclude,
      });
    });
  }
}
