import "dotenv/config";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import * as argon2 from "argon2";
import { DateTime } from "luxon";
import { randomUUID } from "crypto";

describe("Clinic API with real PostgreSQL", () => {
  let app: INestApplication,
    db: PrismaClient,
    patients: any[],
    doctors: any[],
    admin: any,
    type: any,
    followup: any,
    specialty: any;
  let tokens: Record<string, string> = {};
  const password = "IntegrationTest!42";
  const future = DateTime.now()
    .setZone("Asia/Riyadh")
    .plus({ days: 7 })
    .startOf("day")
    .plus({ hours: 10 });
  const startAt = future.toISO()!;
  const api = (
    method: "get" | "post" | "put" | "patch" | "delete",
    path: string,
    who = "p1",
  ) =>
    request(app.getHttpServer())
      [method](`/api${path}`)
      .set("Authorization", `Bearer ${tokens[who]}`);
  const hold = async (who = "p1", overrides = {}) =>
    api("post", "/holds", who).send({
      doctorId: doctors[0].id,
      appointmentTypeId: type.id,
      startAt,
      ...overrides,
    });
  const book = async (who = "p1", overrides = {}) => {
    const h = await hold(who, overrides);
    expect(h.status).toBe(201);
    const a = await api("post", "/appointments", who).send({
      holdId: h.body.id,
    });
    expect(a.status).toBe(201);
    return a.body;
  };
  const slots = () =>
    api(
      "get",
      `/doctors/${doctors[0].id}/slots?appointmentTypeId=${type.id}&date=${future.toISODate()}`,
    );
  const pastAppointment = async () => {
    const time = future.minus({ days: 8 });
    const h = await db.temporaryHold.create({
      data: {
        patientId: patients[0].patient.id,
        doctorId: doctors[0].id,
        appointmentTypeId: type.id,
        startAt: time.toJSDate(),
        endAt: time.plus({ minutes: 30 }).toJSDate(),
        expiresAt: new Date(),
        status: "CONSUMED",
      },
    });
    return db.appointment.create({
      data: {
        patientId: h.patientId,
        doctorId: h.doctorId,
        specialtyId: specialty.id,
        appointmentTypeId: type.id,
        holdId: h.id,
        startAt: h.startAt,
        endAt: h.endAt,
      },
    });
  };
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith("_test"))
      throw new Error(
        "Set TEST_DATABASE_URL to a dedicated database whose name ends with _test. Tests clear this database.",
      );
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = "test";
    process.env.CLINIC_TIMEZONE = "Asia/Riyadh";
    process.env.JWT_SECRET ||=
      "integration-test-only-secret-at-least-32-characters";
    const { AppModule, configure } = await import("../src/app");
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configure(module.createNestApplication());
    await app.init();
    db = new PrismaClient();
    await db.$executeRawUnsafe(
      'TRUNCATE "ScheduleOccupancy", "Appointment", "TemporaryHold", "BlockedTime", "DoctorAvailability", "DoctorAppointmentType", "DoctorProfile", "PatientProfile", "Specialty", "AppointmentType", "User" CASCADE',
    );
    specialty = await db.specialty.create({
      data: { name: "General Medicine" },
    });
    type = await db.appointmentType.create({
      data: { name: "General Consultation", durationMinutes: 30 },
    });
    followup = await db.appointmentType.create({
      data: { name: "Follow-up", durationMinutes: 15 },
    });
    const passwordHash = await argon2.hash(password);
    admin = await db.user.create({
      data: {
        email: "admin@test.local",
        name: "Admin",
        role: "ADMIN",
        passwordHash,
      },
    });
    patients = await Promise.all(
      [1, 2].map((i) =>
        db.user.create({
          data: {
            name: `Patient ${i}`,
            email: `p${i}@test.local`,
            passwordHash,
            patient: { create: {} },
          },
          include: { patient: true },
        }),
      ),
    );
    doctors = await Promise.all(
      [1, 2].map((i) =>
        db.doctorProfile.create({
          data: {
            specialty: { connect: { id: specialty.id } },
            user: {
              create: {
                email: `d${i}@test.local`,
                name: `Doctor ${i}`,
                role: "DOCTOR",
                passwordHash,
              },
            },
          },
        }),
      ),
    );
    for (const who of ["p1", "p2", "d1", "d2", "admin"]) {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: `${who}@test.local`, password });
      expect(response.status).toBe(201);
      tokens[who] = response.body.token;
    }
  });
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "ScheduleOccupancy", "Appointment", "TemporaryHold", "BlockedTime", "DoctorAvailability", "DoctorAppointmentType" CASCADE',
    );
    await db.user.updateMany({ data: { isActive: true, tokenVersion: 0 } });
    await db.appointmentType.update({
      where: { id: type.id },
      data: { isActive: true, durationMinutes: 30 },
    });
    for (const d of doctors) {
      await db.doctorAppointmentType.createMany({
        data: [type, followup].map((t) => ({
          doctorId: d.id,
          appointmentTypeId: t.id,
        })),
      });
      await db.doctorAvailability.createMany({
        data: Array.from({ length: 7 }, (_, dayOfWeek) => ({
          doctorId: d.id,
          dayOfWeek,
          startMinute: 540,
          endMinute: 1020,
        })),
      });
    }
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });
  test("registers only patients and never exposes the password hash", async () => {
    const result = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({
        name: "New Patient",
        email: `new-${randomUUID()}@test.local`,
        password,
      });
    expect(result.status).toBe(201);
    expect(result.body.user.role).toBe("PATIENT");
    expect(JSON.stringify(result.body)).not.toContain("passwordHash");
  });
  test("rejects duplicate emails regardless of case", async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/auth/register")
          .send({ name: "Duplicate", email: "P1@TEST.LOCAL", password })
      ).status,
    ).toBe(409);
  });
  test("rejects role injection and whitespace-only names", async () => {
    for (const data of [{ name: "Someone", role: "ADMIN" }, { name: "   " }])
      expect(
        (
          await request(app.getHttpServer())
            .post("/api/auth/register")
            .send({ ...data, email: "invalid@test.local", password })
        ).status,
      ).toBe(400);
  });
  test("valid login works and wrong passwords fail", async () => {
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/auth/login")
          .send({ email: "p1@test.local", password })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/auth/login")
          .send({ email: "p1@test.local", password: "WrongPassword!" })
      ).status,
    ).toBe(401);
  });
  test("disabled users cannot log in or use existing tokens", async () => {
    await db.user.update({
      where: { id: patients[0].id },
      data: { isActive: false },
    });
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/auth/login")
          .send({ email: "p1@test.local", password })
      ).status,
    ).toBe(401);
    expect((await api("get", "/appointments")).status).toBe(401);
  });
  test("protected routes reject missing tokens", async () =>
    expect(
      (await request(app.getHttpServer()).get("/api/appointments")).status,
    ).toBe(401));
  test("logout revokes existing tokens", async () => {
    await api("post", "/auth/logout");
    expect((await api("get", "/appointments")).status).toBe(401);
  });
  test("patient cannot create doctors", async () =>
    expect((await api("post", "/doctors").send({})).status).toBe(403));
  test("admin creates doctors with the correct role", async () => {
    const r = await api("post", "/doctors", "admin").send({
      name: "New Doctor",
      email: `doctor-${randomUUID()}@test.local`,
      password,
      specialtyId: specialty.id,
      appointmentTypeIds: [type.id],
    });
    expect(r.status).toBe(201);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: r.body.userId } })).role,
    ).toBe("DOCTOR");
  });
  test("admin creates types and invalid durations are rejected", async () => {
    expect(
      (
        await api("post", "/appointment-types", "admin").send({
          name: "Long Consultation",
          durationMinutes: 45,
          isActive: true,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await api("post", "/appointment-types", "admin").send({
          name: "Invalid",
          durationMinutes: 0,
          isActive: true,
        })
      ).status,
    ).toBe(400);
  });
  test("inactive appointment type cannot be booked", async () => {
    await db.appointmentType.update({
      where: { id: type.id },
      data: { isActive: false },
    });
    expect((await hold()).status).toBe(400);
  });
  test("unassigned appointment type cannot be booked", async () => {
    await db.doctorAppointmentType.deleteMany({
      where: { doctorId: doctors[0].id },
    });
    expect((await hold()).status).toBe(400);
  });
  test("slots are generated only inside full working windows", async () => {
    const r = await slots();
    expect(r.status).toBe(200);
    expect(r.body.slots).toHaveLength(16);
    expect(
      r.body.slots.every(
        (s: any) => DateTime.fromISO(s.endAt).setZone("Asia/Riyadh").hour <= 17,
      ),
    ).toBe(true);
  });
  test("outside working hours and off-grid starts are rejected", async () => {
    expect(
      (await hold("p1", { startAt: future.set({ hour: 18 }).toISO() })).status,
    ).toBe(400);
    expect(
      (await hold("p1", { startAt: future.plus({ minutes: 5 }).toISO() }))
        .status,
    ).toBe(400);
  });
  test("blocked time removes slots", async () => {
    expect(
      (
        await api("post", `/doctors/${doctors[0].id}/blocked-times`, "d1").send(
          {
            startAt,
            endAt: future.plus({ hours: 1 }).toISO(),
            reason: "Meeting",
          },
        )
      ).status,
    ).toBe(201);
    expect((await slots()).body.slots).toHaveLength(14);
    expect((await hold()).status).toBe(409);
  });
  test("creates a five-minute hold and blocks another patient", async () => {
    const h = await hold();
    expect(h.status).toBe(201);
    expect(Date.parse(h.body.expiresAt) - Date.parse(h.body.serverNow)).toBe(
      300000,
    );
    expect((await hold("p2")).status).toBe(409);
    expect((await slots()).body.slots).toHaveLength(15);
  });
  test("expired holds stop blocking immediately", async () => {
    const h = await hold();
    await db.temporaryHold.update({
      where: { id: h.body.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect((await hold("p2")).status).toBe(201);
  });
  test("patient cannot confirm someone else’s hold", async () => {
    const h = await hold();
    expect(
      (await api("post", "/appointments", "p2").send({ holdId: h.body.id }))
        .status,
    ).toBe(403);
  });
  test("expired hold cannot be confirmed", async () => {
    const h = await hold();
    await db.temporaryHold.update({
      where: { id: h.body.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect(
      (await api("post", "/appointments").send({ holdId: h.body.id })).status,
    ).toBe(400);
    expect(await db.appointment.count()).toBe(0);
  });
  test("confirmation rechecks type validity", async () => {
    const h = await hold();
    await db.appointmentType.update({
      where: { id: type.id },
      data: { isActive: false },
    });
    expect(
      (await api("post", "/appointments").send({ holdId: h.body.id })).status,
    ).toBe(400);
  });
  test("confirmation rechecks duration changes", async () => {
    const h = await hold();
    await db.appointmentType.update({
      where: { id: type.id },
      data: { durationMinutes: 45 },
    });
    expect(
      (await api("post", "/appointments").send({ holdId: h.body.id })).status,
    ).toBe(409);
  });
  test("confirmation consumes the hold and creates a confirmed appointment", async () => {
    const a = await book();
    expect(a.status).toBe("CONFIRMED");
    expect(
      (await db.temporaryHold.findUniqueOrThrow({ where: { id: a.holdId } }))
        .status,
    ).toBe("CONSUMED");
  });
  test("conflicting doctor appointments are rejected, including partial overlap", async () => {
    await book();
    expect((await hold("p2")).status).toBe(409);
    expect(
      (
        await hold("p2", {
          appointmentTypeId: followup.id,
          startAt: future.plus({ minutes: 15 }).toISO(),
        })
      ).status,
    ).toBe(409);
    expect(
      (await hold("p2", { startAt: future.plus({ minutes: 30 }).toISO() }))
        .status,
    ).toBe(201);
  });
  test("patient cannot hold overlapping appointments with different doctors", async () => {
    await book();
    expect((await hold("p1", { doctorId: doctors[1].id })).status).toBe(409);
  });
  test("patient active holds also conflict across different doctors", async () => {
    await hold();
    expect((await hold("p1", { doctorId: doctors[1].id })).status).toBe(409);
  });
  test("simultaneous booking attempts produce exactly one confirmed appointment", async () => {
    const attempts = await Promise.all([hold("p1"), hold("p2")]);
    expect(attempts.map((a) => a.status).sort()).toEqual([201, 409]);
    const index = attempts.findIndex((a) => a.status === 201);
    const confirm = await api(
      "post",
      "/appointments",
      index === 0 ? "p1" : "p2",
    ).send({ holdId: attempts[index].body.id });
    expect(confirm.status).toBe(201);
    expect(await db.appointment.count({ where: { status: "CONFIRMED" } })).toBe(
      1,
    );
  });
  test("simultaneous confirmation retries are idempotent", async () => {
    const h = await hold();
    const answers = await Promise.all([
      api("post", "/appointments").send({ holdId: h.body.id }),
      api("post", "/appointments").send({ holdId: h.body.id }),
    ]);
    expect(answers.map((a) => a.status)).toEqual([201, 201]);
    expect(answers[0].body.id).toBe(answers[1].body.id);
    expect(await db.appointment.count()).toBe(1);
  });
  test("database triggers reject a conflicting direct appointment insert", async () => {
    const a = await book();
    const h = await db.temporaryHold.create({
      data: {
        patientId: patients[1].patient.id,
        doctorId: doctors[0].id,
        appointmentTypeId: type.id,
        startAt: new Date(a.startAt),
        endAt: new Date(a.endAt),
        expiresAt: new Date(),
        status: "CONSUMED",
      },
    });
    await expect(
      db.appointment.create({
        data: {
          patientId: h.patientId,
          doctorId: h.doctorId,
          appointmentTypeId: type.id,
          specialtyId: specialty.id,
          holdId: h.id,
          startAt: h.startAt,
          endAt: h.endAt,
        },
      }),
    ).rejects.toThrow();
    expect(await db.appointment.count()).toBe(1);
  });
  test("database enforces patient overlap across doctors", async () => {
    const a = await book();
    const h = await db.temporaryHold.create({
      data: {
        patientId: patients[0].patient.id,
        doctorId: doctors[1].id,
        appointmentTypeId: type.id,
        startAt: new Date(a.startAt),
        endAt: new Date(a.endAt),
        expiresAt: new Date(),
        status: "CONSUMED",
      },
    });
    await expect(
      db.appointment.create({
        data: {
          patientId: h.patientId,
          doctorId: h.doctorId,
          appointmentTypeId: type.id,
          specialtyId: specialty.id,
          holdId: h.id,
          startAt: h.startAt,
          endAt: h.endAt,
        },
      }),
    ).rejects.toThrow();
  });
  test("cancelling a future appointment releases the time", async () => {
    const a = await book();
    expect((await api("post", `/appointments/${a.id}/cancel`)).status).toBe(
      201,
    );
    expect((await hold("p2")).status).toBe(201);
  });
  test("patient cannot view or cancel another patient’s appointment", async () => {
    const a = await book();
    expect((await api("get", `/appointments/${a.id}`, "p2")).status).toBe(403);
    expect(
      (await api("post", `/appointments/${a.id}/cancel`, "p2")).status,
    ).toBe(403);
  });
  test("appointments cannot be cancelled after starting", async () => {
    const a = await pastAppointment();
    expect((await api("post", `/appointments/${a.id}/cancel`)).status).toBe(
      400,
    );
  });
  test("successful reschedule secures new time and releases old time", async () => {
    const a = await book(),
      h = await hold("p1", {
        startAt: future.plus({ days: 1 }).toISO(),
        rescheduleOfId: a.id,
      });
    expect(h.status).toBe(201);
    expect((await hold("p2")).status).toBe(409);
    const r = await api("post", `/appointments/${a.id}/reschedule`).send({
      holdId: h.body.id,
    });
    expect(r.status).toBe(201);
    expect(
      (await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status,
    ).toBe("CANCELLED");
    expect((await hold("p2")).status).toBe(201);
  });
  test("failed reschedule preserves original appointment", async () => {
    const a = await book(),
      h = await hold("p1", {
        startAt: future.plus({ days: 1 }).toISO(),
        rescheduleOfId: a.id,
      });
    await db.temporaryHold.update({
      where: { id: h.body.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    expect(
      (
        await api("post", `/appointments/${a.id}/reschedule`).send({
          holdId: h.body.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status,
    ).toBe("CONFIRMED");
  });
  test("reschedule requires a hold bound to the original appointment", async () => {
    const a = await book(),
      h = await hold("p1", { startAt: future.plus({ days: 1 }).toISO() });
    expect(
      (
        await api("post", `/appointments/${a.id}/reschedule`).send({
          holdId: h.body.id,
        })
      ).status,
    ).toBe(400);
  });
  test("reschedule cannot target an occupied period", async () => {
    const a = await book();
    await book("p2", { startAt: future.plus({ days: 1 }).toISO() });
    expect(
      (
        await hold("p1", {
          startAt: future.plus({ days: 1 }).toISO(),
          rescheduleOfId: a.id,
        })
      ).status,
    ).toBe(409);
  });
  test("doctor cannot modify another doctor’s availability", async () =>
    expect(
      (
        await api("put", `/doctors/${doctors[1].id}/availability`, "d1").send({
          windows: [],
        })
      ).status,
    ).toBe(403));
  test("availability changes cannot strand existing bookings", async () => {
    await book();
    expect(
      (
        await api("put", `/doctors/${doctors[0].id}/availability`, "d1").send({
          windows: [],
        })
      ).status,
    ).toBe(400);
  });
  test("overlapping working windows are invalid", async () => {
    expect(
      (
        await api("put", `/doctors/${doctors[0].id}/availability`, "d1").send({
          windows: [
            { dayOfWeek: 1, startMinute: 540, endMinute: 700 },
            { dayOfWeek: 1, startMinute: 600, endMinute: 800 },
          ],
        })
      ).status,
    ).toBe(400);
  });
  test("blocked time cannot overwrite an existing appointment", async () => {
    await book();
    expect(
      (
        await api("post", `/doctors/${doctors[0].id}/blocked-times`, "d1").send(
          { startAt, endAt: future.plus({ hours: 1 }).toISO() },
        )
      ).status,
    ).toBe(400);
  });
  test("doctor can mark own ended appointment completed", async () => {
    const a = await pastAppointment();
    const r = await api("post", `/appointments/${a.id}/outcome`, "d1").send({
      status: "COMPLETED",
    });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("COMPLETED");
  });
  test("doctor can mark own ended appointment no-show", async () => {
    const a = await pastAppointment();
    expect(
      (
        await api("post", `/appointments/${a.id}/outcome`, "d1").send({
          status: "NO_SHOW",
        })
      ).status,
    ).toBe(201);
  });
  test("doctor cannot update another doctor’s appointment", async () => {
    const a = await pastAppointment();
    expect(
      (
        await api("post", `/appointments/${a.id}/outcome`, "d2").send({
          status: "COMPLETED",
        })
      ).status,
    ).toBe(403);
  });
  test("patients cannot set appointment outcomes", async () => {
    const a = await pastAppointment();
    expect(
      (
        await api("post", `/appointments/${a.id}/outcome`).send({
          status: "COMPLETED",
        })
      ).status,
    ).toBe(403);
  });
  test("future appointments cannot be marked complete", async () => {
    const a = await book();
    expect(
      (
        await api("post", `/appointments/${a.id}/outcome`, "d1").send({
          status: "COMPLETED",
        })
      ).status,
    ).toBe(400);
  });
  test("only the hold owner can release it, releasing restores availability", async () => {
    const h = await hold();
    expect((await api("delete", `/holds/${h.body.id}`, "p2")).status).toBe(403);
    expect((await api("delete", `/holds/${h.body.id}`)).status).toBe(200);
    expect((await hold("p2")).status).toBe(201);
  });
  test("doctor cannot cancel appointments", async () => {
    const a = await book();
    expect(
      (await api("post", `/appointments/${a.id}/cancel`, "d1")).status,
    ).toBe(403);
  });
  test("database failure during replacement rolls back the original and the hold", async () => {
    const a = await book(),
      h = await hold("p1", {
        startAt: future.plus({ days: 1 }).toISO(),
        rescheduleOfId: a.id,
      });
    await db.$executeRawUnsafe(
      `CREATE FUNCTION test_reject_replacement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Test rejection' USING ERRCODE = '23514'; END $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER test_reject_replacement BEFORE INSERT ON "Appointment" FOR EACH ROW EXECUTE FUNCTION test_reject_replacement()',
    );
    try {
      expect(
        (
          await api("post", `/appointments/${a.id}/reschedule`).send({
            holdId: h.body.id,
          })
        ).status,
      ).toBe(400);
      expect(
        (await db.appointment.findUniqueOrThrow({ where: { id: a.id } }))
          .status,
      ).toBe("CONFIRMED");
      expect(
        (await db.temporaryHold.findUniqueOrThrow({ where: { id: h.body.id } }))
          .status,
      ).toBe("ACTIVE");
      expect(await db.appointment.count()).toBe(1);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER test_reject_replacement ON "Appointment"',
      );
      await db.$executeRawUnsafe("DROP FUNCTION test_reject_replacement()");
    }
  });
  test("terminal outcomes cannot be reopened", async () => {
    const a = await pastAppointment();
    await api("post", `/appointments/${a.id}/outcome`, "d1").send({
      status: "COMPLETED",
    });
    expect(
      (
        await api("post", `/appointments/${a.id}/outcome`, "d1").send({
          status: "NO_SHOW",
        })
      ).status,
    ).toBe(400);
    await expect(
      db.appointment.update({
        where: { id: a.id },
        data: { status: "CONFIRMED" },
      }),
    ).rejects.toThrow();
  });
});
