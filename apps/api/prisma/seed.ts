import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { DateTime } from "luxon";
const db = new PrismaClient();
async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8 || password.startsWith("replace-"))
    throw new Error("Set ADMIN_PASSWORD to a strong password before seeding.");
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await db.user.upsert({
    where: {
      email: (process.env.ADMIN_EMAIL || "admin@clinic.test").toLowerCase(),
    },
    update: {},
    create: {
      name: "Clinic administrator",
      email: (process.env.ADMIN_EMAIL || "admin@clinic.test").toLowerCase(),
      passwordHash: hash,
      role: "ADMIN",
    },
  });
  const types = await Promise.all(
    [
      ["General Consultation", 30],
      ["Follow-up", 15],
    ].map(([name, durationMinutes]) =>
      db.appointmentType.upsert({
        where: { name: String(name) },
        update: {},
        create: {
          name: String(name),
          durationMinutes: Number(durationMinutes),
        },
      }),
    ),
  );
  const specialties = await Promise.all(
    ["General Medicine", "Dermatology", "Cardiology", "Orthopedics"].map(
      (name) =>
        db.specialty.upsert({ where: { name }, update: {}, create: { name } }),
    ),
  );
  if (process.env.SEED_DEMO !== "true") return;
  const demoPassword = process.env.DEMO_PASSWORD;
  if (
    !demoPassword ||
    demoPassword.length < 8 ||
    demoPassword.startsWith("replace-")
  )
    throw new Error("Set DEMO_PASSWORD to seed sample accounts.");
  const demoHash = await argon2.hash(demoPassword, { type: argon2.argon2id });
  const people = [
    ["Dr. Ahmed Hassan", "ahmed", 0],
    ["Dr. Sara Al-Faisal", "sara", 1],
    ["Dr. Omar Khalid", "omar", 2],
    ["Dr. Nora Abdullah", "nora", 3],
    ["Dr. Yousef Ali", "yousef", 0],
    ["Dr. Leena Mansour", "leena", 1],
  ] as const;
  for (const [name, email, specialty] of people) {
    const user = await db.user.upsert({
      where: { email: `${email}@clinic.test` },
      update: {},
      create: {
        name,
        email: `${email}@clinic.test`,
        role: "DOCTOR",
        passwordHash: demoHash,
        doctor: {
          create: {
            specialtyId: specialties[specialty].id,
            appointmentTypes: {
              create: types.map((t) => ({ appointmentTypeId: t.id })),
            },
            availability: {
              create: [0, 1, 2, 3, 4].flatMap((dayOfWeek) => [
                { dayOfWeek, startMinute: 540, endMinute: 780 },
                { dayOfWeek, startMinute: 840, endMinute: 1020 },
              ]),
            },
          },
        },
      },
      include: { doctor: true },
    });
    if (!user.doctor)
      throw new Error("Seed doctor account is missing its profile.");
  }
  const patient = await db.user.upsert({
    where: { email: "patient@clinic.test" },
    update: {},
    create: {
      name: "Alex Morgan",
      email: "patient@clinic.test",
      passwordHash: demoHash,
      role: "PATIENT",
      patient: { create: {} },
    },
    include: { patient: true },
  });
  const doctor = await db.doctorProfile.findFirstOrThrow({
    where: { user: { email: "ahmed@clinic.test" } },
  });
  if (
    !(await db.appointment.count({ where: { patientId: patient.patient!.id } }))
  ) {
    let date = DateTime.now()
      .setZone(process.env.CLINIC_TIMEZONE || "Asia/Riyadh")
      .plus({ days: 1 })
      .startOf("day")
      .plus({ hours: 10 });
    while ([5, 6].includes(date.weekday % 7)) date = date.plus({ days: 1 });
    await db.$transaction(async (tx) => {
      const hold = await tx.temporaryHold.create({
        data: {
          patientId: patient.patient!.id,
          doctorId: doctor.id,
          appointmentTypeId: types[0].id,
          startAt: date.toJSDate(),
          endAt: date.plus({ minutes: 30 }).toJSDate(),
          expiresAt: new Date(),
          status: "CONSUMED",
        },
      });
      await tx.appointment.create({
        data: {
          patientId: patient.patient!.id,
          doctorId: doctor.id,
          specialtyId: doctor.specialtyId,
          appointmentTypeId: types[0].id,
          holdId: hold.id,
          startAt: hold.startAt,
          endAt: hold.endAt,
        },
      });
    });
  }
  console.log(
    "Seed complete. Sample accounts created with your configured passwords.",
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
