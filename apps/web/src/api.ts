export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("clinic-token");
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login"))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      body.message || "Unable to complete this request. Please try again.",
      response.status,
    );
  }
  return body;
}
export const send = <T = any>(path: string, data?: unknown, method = "POST") =>
  api<T>(path, {
    method,
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
export type User = {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "DOCTOR" | "ADMIN";
  isActive: boolean;
  doctor?: { id: string };
  patient?: { id: string };
};
export type AppointmentType = {
  id: string;
  name: string;
  durationMinutes: number;
  isActive: boolean;
};
export type Specialty = { id: string; name: string };
export type Window = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};
export type Doctor = {
  id: string;
  userId: string;
  specialtyId: string;
  user: { name: string; email?: string; isActive: boolean };
  specialty: Specialty;
  appointmentTypes: {
    appointmentTypeId: string;
    appointmentType: AppointmentType;
  }[];
  availability: Window[];
};
export type Appointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  doctorId: string;
  appointmentTypeId: string;
  doctor: { id: string; user: { name: string } };
  patient: { user: { name: string; email: string } };
  specialty: Specialty;
  appointmentType: AppointmentType;
  rescheduledToId?: string;
};
export type Hold = {
  id: string;
  doctorId: string;
  appointmentTypeId: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
  rescheduleOfId?: string;
  serverNow: string;
  doctor: { user: { name: string }; specialty: Specialty };
  appointmentType: AppointmentType;
};
