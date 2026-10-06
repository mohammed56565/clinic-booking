import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { DateTime } from "luxon";
import { Tx } from "./db";
export const timezone = () => process.env.CLINIC_TIMEZONE || "Asia/Riyadh";
export const overlap = (
  a: { startAt: Date; endAt: Date },
  b: { startAt: Date; endAt: Date },
) => a.startAt < b.endAt && a.endAt > b.startAt;
export const conflict = () =>
  new ConflictException(
    "This appointment is no longer available. Please select another time.",
  );
type Window = { dayOfWeek: number; startMinute: number; endMinute: number };
export function generatedSlots(
  date: string,
  windows: Window[],
  duration: number,
  zone: string,
  now: Date,
) {
  const day = DateTime.fromISO(date, { zone }).startOf("day");
  if (!day.isValid || day.toISODate() !== date || duration <= 0)
    throw new BadRequestException("Invalid date or appointment duration.");
  const slots: { startAt: Date; endAt: Date }[] = [];
  // Iterate real instants: skipped local times never appear, and repeated times have offsets.
  for (
    let start = day;
    start < day.plus({ days: 1 });
    start = start.plus({ minutes: 1 })
  ) {
    const minute = start.hour * 60 + start.minute;
    const end = start.plus({ minutes: duration });
    const match = windows.some(
      (w) =>
        w.dayOfWeek === day.weekday % 7 &&
        minute >= w.startMinute &&
        (minute - w.startMinute) % duration === 0 &&
        end <= day.plus({ days: 1 }) &&
        (end.toISODate() === date ? end.hour * 60 + end.minute : 1440) <=
          w.endMinute &&
        end.offset === start.offset,
    );
    if (match && start.toJSDate() > now)
      slots.push({ startAt: start.toJSDate(), endAt: end.toJSDate() });
  }
  return slots;
}
export function fitsWindow(startAt: Date, endAt: Date, windows: Window[]) {
  const start = DateTime.fromJSDate(startAt, { zone: timezone() });
  const end = DateTime.fromJSDate(endAt, { zone: timezone() });
  const endMinute =
    end.toISODate() === start.toISODate()
      ? end.hour * 60 + end.minute
      : end.equals(start.startOf("day").plus({ days: 1 }))
        ? 1440
        : 9999;
  return (
    start.offset === end.offset &&
    windows.some(
      (w) =>
        w.dayOfWeek === start.weekday % 7 &&
        start.hour * 60 + start.minute >= w.startMinute &&
        endMinute <= w.endMinute,
    )
  );
}
@Injectable()
export class Scheduling {
  async typeAndDoctor(tx: Tx, doctorId: string, typeId: string) {
    const doctor = await tx.doctorProfile.findUnique({
      where: { id: doctorId },
      include: {
        user: true,
        availability: true,
        appointmentTypes: { include: { appointmentType: true } },
      },
    });
    const type = doctor?.appointmentTypes.find(
      (a) => a.appointmentTypeId === typeId,
    )?.appointmentType;
    if (!doctor?.user.isActive || !type?.isActive)
      throw new BadRequestException(
        "This doctor or appointment type is unavailable.",
      );
    return { doctor, type };
  }
  async assertFree(
    tx: Tx,
    doctorId: string,
    patientId: string,
    startAt: Date,
    endAt: Date,
    now: Date,
    ignoreHold?: string,
  ) {
    const range = { startAt: { lt: endAt }, endAt: { gt: startAt } };
    const [appointments, holds, blocks] = await Promise.all([
      tx.appointment.count({
        where: {
          ...range,
          status: "CONFIRMED",
          OR: [{ doctorId }, { patientId }],
        },
      }),
      tx.temporaryHold.count({
        where: {
          ...range,
          status: "ACTIVE",
          expiresAt: { gt: now },
          ...(ignoreHold ? { id: { not: ignoreHold } } : {}),
          OR: [{ doctorId }, { patientId }],
        },
      }),
      tx.blockedTime.count({ where: { ...range, doctorId } }),
    ]);
    if (appointments || holds || blocks) throw conflict();
  }
}
