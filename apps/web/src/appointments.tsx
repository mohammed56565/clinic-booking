import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  send,
  type Appointment,
  type Doctor,
  type Hold,
  type User,
} from "./api";
import { formatDate, today, useAuth } from "./context";
import {
  Avatar,
  Badge,
  Confirm,
  Empty,
  ErrorBox,
  Icon,
  Loading,
  PageHeading,
  useData,
  useToast,
} from "./ui";
export function AppointmentActions({
  appointment: a,
  onChange,
}: {
  appointment: Appointment;
  onChange: () => void;
}) {
  const { user } = useAuth(),
    [action, setAction] = useState(""),
    toast = useToast();
  const future = new Date(a.startAt) > new Date(),
    ended = new Date(a.endAt) <= new Date();
  if (a.status !== "CONFIRMED")
    return a.rescheduledToId && user!.role === "PATIENT" ? (
      <Link
        className="text-button"
        to={`/my-appointments/${a.rescheduledToId}`}
      >
        View replacement
      </Link>
    ) : a.rescheduledToId ? (
      <span className="muted">Rescheduled</span>
    ) : null;
  return (
    <>
      <div className="appointment-actions">
        {user!.role === "PATIENT" && future && (
          <Link
            className="button secondary small"
            to={`/book?doctor=${a.doctorId}&type=${a.appointmentTypeId}&reschedule=${a.id}`}
          >
            Reschedule
          </Link>
        )}
        {user!.role !== "DOCTOR" && future && (
          <button
            className="text-button danger-text"
            onClick={() => setAction("cancel")}
          >
            Cancel
          </button>
        )}
        {user!.role !== "PATIENT" && ended && (
          <>
            <button
              className="button secondary small"
              onClick={() => setAction("COMPLETED")}
            >
              Mark completed
            </button>
            <button
              className="text-button"
              onClick={() => setAction("NO_SHOW")}
            >
              Mark no-show
            </button>
          </>
        )}
      </div>
      {action && (
        <Confirm
          title={
            action === "cancel"
              ? "Cancel this appointment?"
              : `Mark as ${action === "COMPLETED" ? "completed" : "no-show"}?`
          }
          description={
            action === "cancel"
              ? "This time will become available for another patient. You can book a new appointment at any time."
              : "This is a final appointment outcome and cannot be changed."
          }
          label={action === "cancel" ? "Cancel appointment" : "Confirm outcome"}
          danger={action === "cancel"}
          onClose={() => setAction("")}
          action={async () => {
            await send(
              `/appointments/${a.id}/${action === "cancel" ? "cancel" : "outcome"}`,
              action === "cancel" ? undefined : { status: action },
            );
            toast(
              action === "cancel"
                ? "Appointment cancelled."
                : "Appointment outcome updated.",
            );
            onChange();
          }}
        />
      )}
    </>
  );
}
export function AppointmentTable({
  appointments,
  onChange,
}: {
  appointments: Appointment[];
  onChange: () => void;
}) {
  const { user, zone } = useAuth();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{user!.role === "PATIENT" ? "Doctor" : "Patient"}</th>
            <th>Appointment</th>
            <th>Date & time</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.id}>
              <td>
                <div className="person-cell">
                  <Avatar
                    name={
                      user!.role === "PATIENT"
                        ? a.doctor.user.name
                        : a.patient.user.name
                    }
                  />
                  <div>
                    <strong>
                      {user!.role === "PATIENT"
                        ? a.doctor.user.name
                        : a.patient.user.name}
                    </strong>
                    <small>
                      {user!.role === "PATIENT"
                        ? a.specialty.name
                        : a.doctor.user.name}
                    </small>
                  </div>
                </div>
              </td>
              <td>
                {a.appointmentType.name}
                <small>
                  {Math.round(
                    (+new Date(a.endAt) - +new Date(a.startAt)) / 60000,
                  )}{" "}
                  minutes
                </small>
              </td>
              <td>
                <strong>{formatDate(a.startAt, zone, "d LLL yyyy")}</strong>
                <small>
                  {formatDate(a.startAt, zone, "h:mm a")} –{" "}
                  {formatDate(a.endAt, zone, "h:mm a")}
                </small>
              </td>
              <td>
                <Badge status={a.status} />
              </td>
              <td>
                {user!.role === "PATIENT" ? (
                  <Link
                    className="button secondary small"
                    to={`/my-appointments/${a.id}`}
                  >
                    View details
                    <Icon name="arrow" size={15} />
                  </Link>
                ) : (
                  <AppointmentActions appointment={a} onChange={onChange} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AppointmentsPage({ admin = false }: { admin?: boolean }) {
  const appointments = useData<Appointment[]>("/appointments"),
    holds = useData<{ holds: Hold[] }>(admin ? null : "/holds");
  const [tab, setTab] = useState("upcoming"),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [date, setDate] = useState("");
  const { zone } = useAuth();
  const data = (appointments.data || [])
    .filter(
      (a) =>
        (admin ||
          (tab === "upcoming"
            ? a.status === "CONFIRMED" && new Date(a.startAt) > new Date()
            : a.status !== "CONFIRMED" || new Date(a.startAt) <= new Date())) &&
        (!status || a.status === status) &&
        (!date || formatDate(a.startAt, zone, "yyyy-MM-dd") === date) &&
        `${a.doctor.user.name} ${a.patient.user.name} ${a.appointmentType.name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      tab === "upcoming"
        ? +new Date(a.startAt) - +new Date(b.startAt)
        : +new Date(b.startAt) - +new Date(a.startAt),
    );
  return (
    <>
      <PageHeading
        eyebrow={admin ? "CLINIC SCHEDULE" : "YOUR CARE, IN ONE PLACE"}
        title={admin ? "Appointments" : "My appointments"}
        description={
          admin
            ? "Review and manage appointments across the clinic."
            : "Keep track of your upcoming visits and appointment history."
        }
        action={
          !admin && (
            <Link to="/doctors" className="button">
              <Icon name="plus" size={18} />
              Book an appointment
            </Link>
          )
        }
      />
      {holds.data?.holds.map((h) => (
        <div className="reservation-banner" key={h.id}>
          <Icon name="clock" />
          <span>You have a reserved time with {h.doctor.user.name}.</span>
          <Link to={`/book?hold=${h.id}`}>
            Finish booking
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      ))}
      <section className="panel no-padding">
        {!admin && (
          <div className="tabs" role="tablist" aria-label="Appointment period">
            <button
              role="tab"
              aria-selected={tab === "upcoming"}
              className={tab === "upcoming" ? "selected" : ""}
              onClick={() => setTab("upcoming")}
            >
              Upcoming
            </button>
            <button
              role="tab"
              aria-selected={tab === "history"}
              className={tab === "history" ? "selected" : ""}
              onClick={() => setTab("history")}
            >
              History
            </button>
          </div>
        )}
        <div className="table-filters">
          <div className="search-input">
            <Icon name="search" size={18} />
            <input
              aria-label="Search appointments"
              placeholder="Search appointments"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Appointment status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => (
              <option key={s} value={s}>
                {s === "NO_SHOW" ? "No-show" : s[0] + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <input
            aria-label="Filter by date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {appointments.loading ? (
          <Loading text="Loading appointments…" />
        ) : appointments.error ? (
          <ErrorBox message={appointments.error} retry={appointments.reload} />
        ) : !data.length ? (
          <Empty title="No appointments to show">
            <p>
              {tab === "upcoming" && !admin
                ? "Your next visit starts with finding a doctor."
                : "Try changing your search or filters."}
            </p>
            {!admin && (
              <Link to="/doctors" className="button secondary">
                Find a doctor
              </Link>
            )}
          </Empty>
        ) : (
          <AppointmentTable
            appointments={data}
            onChange={appointments.reload}
          />
        )}
      </section>
    </>
  );
}
export function AppointmentDetail() {
  const { id } = useParams(),
    { zone } = useAuth();
  const result = useData<Appointment>(`/appointments/${id}`);
  if (result.loading) return <Loading text="Loading appointment…" />;
  if (result.error || !result.data)
    return <ErrorBox message={result.error} retry={result.reload} />;
  const a = result.data;
  return (
    <>
      <Link to="/my-appointments" className="back-link">
        <Icon name="back" size={16} />
        My appointments
      </Link>
      <PageHeading
        title="Your appointment"
        description={`Booking reference ${a.id.slice(0, 8).toUpperCase()}`}
        action={<Badge status={a.status} />}
      />
      <section className="panel appointment-detail">
        <div className="hold-doctor">
          <Avatar name={a.doctor.user.name} large />
          <div>
            <h2>{a.doctor.user.name}</h2>
            <p className="muted">{a.specialty.name}</p>
          </div>
        </div>
        <dl className="summary-list">
          <div>
            <dt>Appointment</dt>
            <dd>{a.appointmentType.name}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(a.startAt, zone)}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>
              {formatDate(a.startAt, zone, "h:mm a")} –{" "}
              {formatDate(a.endAt, zone, "h:mm a")}
            </dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{zone}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>Clearwell Clinic</dd>
          </div>
        </dl>
        <AppointmentActions appointment={a} onChange={result.reload} />
        {a.status === "CONFIRMED" && (
          <p className="small-note">
            You can cancel or reschedule before your appointment starts.
          </p>
        )}
      </section>
    </>
  );
}
export function Dashboard({ admin = false }: { admin?: boolean }) {
  const { user, zone } = useAuth(),
    appointments = useData<Appointment[]>("/appointments"),
    doctors = useData<Doctor[]>(admin ? "/doctors" : null),
    users = useData<User[]>(admin ? "/users" : null);
  const all = appointments.data || [],
    day = today(zone),
    todays = all.filter(
      (a) => formatDate(a.startAt, zone, "yyyy-MM-dd") === day,
    ),
    [filter, setFilter] = useState("today");
  const stats = admin
    ? [
        [
          "Today’s appointments",
          todays.filter((a) => a.status !== "CANCELLED").length,
          "calendar",
        ],
        [
          "Active doctors",
          doctors.data?.filter((d) => d.user.isActive).length || 0,
          "people",
        ],
        [
          "Registered patients",
          users.data?.filter((u) => u.role === "PATIENT").length || 0,
          "user",
        ],
        [
          "Confirmed appointments",
          all.filter((a) => a.status === "CONFIRMED").length,
          "check",
        ],
      ]
    : [
        [
          "Today’s appointments",
          todays.filter((a) => a.status !== "CANCELLED").length,
          "calendar",
        ],
        [
          "Upcoming visits",
          all.filter(
            (a) => a.status === "CONFIRMED" && new Date(a.startAt) > new Date(),
          ).length,
          "clock",
        ],
        [
          "Completed today",
          todays.filter((a) => a.status === "COMPLETED").length,
          "check",
        ],
        [
          "No-shows today",
          todays.filter((a) => a.status === "NO_SHOW").length,
          "user",
        ],
      ];
  const list = (
    filter === "today"
      ? todays
      : all.filter(
          (a) => a.status === "CONFIRMED" && new Date(a.startAt) > new Date(),
        )
  ).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  return (
    <>
      <PageHeading
        eyebrow={admin ? "CLINIC OVERVIEW" : "YOUR DAY AT CLEARWELL"}
        title={admin ? "Clinic overview" : `Welcome, ${user!.name}`}
        description={formatDate(day, zone, "cccc, d LLLL yyyy")}
        action={
          <Link
            className="button"
            to={admin ? "/admin/appointments" : "/doctor/calendar"}
          >
            <Icon name="calendar" size={18} />
            {admin ? "All appointments" : "Open calendar"}
          </Link>
        }
      />
      <div className="stats-grid">
        {stats.map(([label, value, icon]) => (
          <div className="stat-card" key={label}>
            <span className="stat-label">
              {label}
              <Icon name={String(icon)} />
            </span>
            <strong>{appointments.loading ? "—" : value}</strong>
          </div>
        ))}
      </div>
      <section className="panel no-padding">
        <div className="section-heading padded">
          <h2>
            {filter === "today" ? "Today’s schedule" : "Upcoming appointments"}
          </h2>
          <select
            aria-label="Schedule period"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
        {appointments.loading ? (
          <Loading />
        ) : appointments.error ? (
          <ErrorBox message={appointments.error} retry={appointments.reload} />
        ) : list.length ? (
          <AppointmentTable
            appointments={list}
            onChange={appointments.reload}
          />
        ) : (
          <Empty
            title={
              filter === "today"
                ? "Your schedule is clear today"
                : "No upcoming appointments"
            }
          >
            <p>New bookings will appear here.</p>
          </Empty>
        )}
      </section>
    </>
  );
}
