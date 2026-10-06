import { generatedSlots, overlap } from "../src/scheduling";
describe("slot generation", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const windows = [{ dayOfWeek: 1, startMinute: 540, endMinute: 660 }];
  test("generates all complete appointments at the selected duration", () => {
    const slots = generatedSlots("2026-10-05", windows, 30, "Asia/Riyadh", now);
    expect(slots).toHaveLength(4);
    expect(slots[0].startAt.toISOString()).toBe("2026-10-05T06:00:00.000Z");
    expect(slots[3].endAt.toISOString()).toBe("2026-10-05T08:00:00.000Z");
    expect(
      generatedSlots("2026-10-05", windows, 15, "Asia/Riyadh", now),
    ).toHaveLength(8);
  });
  test("does not exceed working hours or include closed weekdays", () => {
    expect(
      generatedSlots("2026-10-05", windows, 45, "Asia/Riyadh", now),
    ).toHaveLength(2);
    expect(
      generatedSlots("2026-10-06", windows, 30, "Asia/Riyadh", now),
    ).toHaveLength(0);
  });
  test("rejects past start times", () =>
    expect(
      generatedSlots(
        "2026-10-05",
        windows,
        30,
        "Asia/Riyadh",
        new Date("2026-10-05T07:00:00Z"),
      ),
    ).toHaveLength(1));
  test("adjacent periods do not overlap; partial intersections do", () => {
    const range = (s: number, e: number) => ({
      startAt: new Date(s),
      endAt: new Date(e),
    });
    expect(overlap(range(0, 30), range(30, 60))).toBe(false);
    expect(overlap(range(0, 30), range(15, 45))).toBe(true);
  });
  test("rejects invalid dates", () =>
    expect(() =>
      generatedSlots("2026-02-30", windows, 30, "Asia/Riyadh", now),
    ).toThrow());
  test("skips nonexistent DST times without duplicate instants", () => {
    const slots = generatedSlots(
      "2027-03-14",
      [{ dayOfWeek: 0, startMinute: 60, endMinute: 240 }],
      30,
      "America/New_York",
      now,
    );
    expect(new Set(slots.map((s) => +s.startAt)).size).toBe(slots.length);
    expect(slots.every((s) => +s.endAt - +s.startAt === 1800000)).toBe(true);
  });
});
