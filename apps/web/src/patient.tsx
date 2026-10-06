import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { DateTime } from "luxon";
import { send, type Doctor, type Hold, type Specialty } from "./api";
import { formatDate, today, useAuth } from "./context";
import {
  Avatar,
  Empty,
  ErrorBox,
  Field,
  Icon,
  Loading,
  Modal,
  PageHeading,
  useData,
  useToast,
} from "./ui";
export function DoctorsPage() {
  const doctors = useData<Doctor[]>("/doctors"),
    specialties = useData<Specialty[]>("/specialties");
  const [search, setSearch] = useState(""),
    [specialty, setSpecialty] = useState("");
  const { user } = useAuth();
  const matches = (doctors.data || []).filter(
    (d) =>
      (!specialty || d.specialtyId === specialty) &&
      d.user.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="LET’S MAKE TIME FOR YOUR HEALTH"
        title="Find your doctor"
        description={`Hello, ${user!.name.split(" ")[0]}. The right care starts with the right doctor.`}
      />
      <section className="search-panel">
        <div className="search-input">
          <Icon name="search" />
          <input
            aria-label="Search doctors by name"
            placeholder="Search by doctor’s name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="icon-button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        <label className="specialty-select">
          <Icon name="heart" />
          <select
            aria-label="Filter by specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            <option value="">All specialties</option>
            {specialties.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <div className="filter-chips">
        <button
          className={!specialty ? "selected" : ""}
          onClick={() => setSpecialty("")}
        >
          All doctors
        </button>
        {specialties.data?.map((s) => (
          <button
            key={s.id}
            className={specialty === s.id ? "selected" : ""}
            onClick={() => setSpecialty(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="section-heading">
        <h2>
          Our care team <span className="count">{matches.length}</span>
        </h2>
        <span className="muted">In-clinic appointments</span>
      </div>
      {doctors.loading ? (
        <Loading text="Loading doctors…" />
      ) : doctors.error ? (
        <ErrorBox message={doctors.error} retry={doctors.reload} />
      ) : matches.length === 0 ? (
        <Empty title="No doctors found">
          <p>Try a different name or specialty.</p>
        </Empty>
      ) : (
        <div className="doctor-grid">
          {matches.map((d, i) => (
            <article className="doctor-card" key={d.id}>
              <div className="doctor-card-top">
                <Avatar name={d.user.name} large color={i} />
                <span className="specialty-icon">
                  <Icon
                    name={d.specialty.name === "Cardiology" ? "heart" : "plus"}
                    size={18}
                  />
                </span>
              </div>
              <Link className="doctor-name" to={`/doctors/${d.id}`}>
                <h3>{d.user.name}</h3>
              </Link>
              <p className="doctor-specialty">{d.specialty.name}</p>
              <div className="doctor-card-info">
                <span>
                  <Icon name="pin" size={16} />
                  Clearwell Clinic
                </span>
                <span>
                  <Icon name="clock" size={16} />
                  {d.appointmentTypes
                    .filter((t) => t.appointmentType.isActive)
                    .map((t) => `${t.appointmentType.durationMinutes} min`)
                    .filter((x, i, a) => a.indexOf(x) === i)
                    .join(" / ") || "No appointment types"}
                </span>
              </div>
              <div className="doctor-card-bottom">
                <span>
                  {new Set(d.availability.map((w) => w.dayOfWeek)).size} days a
                  week
                </span>
                <Link className="button small" to={`/book?doctor=${d.id}`}>
                  View times
                  <Icon name="arrow" size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="booking-note">
        <span className="note-icon">
          <Icon name="shield" size={22} />
        </span>
        <div>
          <strong>A little time to make your plans</strong>
          <p>
            Choose an available time and we’ll reserve it for 5 minutes while
            you confirm.
          </p>
        </div>
      </div>
    </>
  );
}
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const minuteText = (value: number) =>
  value === 1440
    ? "24:00"
    : `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
export function DoctorDetail() {
  const { id } = useParams(),
    { zone } = useAuth();
  const result = useData<Doctor>(`/doctors/${id}`);
  if (result.loading) return <Loading text="Loading doctor…" />;
  if (result.error || !result.data)
    return <ErrorBox message={result.error} retry={result.reload} />;
  const d = result.data;
  return (
    <>
      <Link className="back-link" to="/doctors">
        <Icon name="back" size={16} />
        All doctors
      </Link>
      <PageHeading
        title={d.user.name}
        description={d.specialty.name}
        action={
          <Link className="button" to={`/book?doctor=${d.id}`}>
            Book an appointment
            <Icon name="arrow" size={18} />
          </Link>
        }
      />
      <div className="detail-grid">
        <section className="panel">
          <h2>Appointment types</h2>
          {d.appointmentTypes
            .filter((t) => t.appointmentType.isActive)
            .map((t) => (
              <div className="detail-row" key={t.appointmentTypeId}>
                <span>{t.appointmentType.name}</span>
                <span className="muted">
                  {t.appointmentType.durationMinutes} minutes
                </span>
              </div>
            ))}
          <p className="muted">
            All appointments take place at Clearwell Clinic.
          </p>
        </section>
        <section className="panel">
          <h2>Weekly working hours</h2>
          <p className="muted">
            {zone}. Available times also account for existing bookings and
            blocked periods.
          </p>
          {dayNames.map((day, i) => (
            <div className="detail-row" key={day}>
              <strong>{day}</strong>
              <span>
                {d.availability
                  .filter((w) => w.dayOfWeek === i)
                  .map(
                    (w) =>
                      `${minuteText(w.startMinute)}–${minuteText(w.endMinute)}`,
                  )
                  .join(", ") || "Closed"}
              </span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function HoldConfirmation({
  hold,
  onClose,
  onExpired,
  onInvalid,
}: {
  hold: Hold;
  onClose: () => void;
  onExpired: () => void;
  onInvalid: (message: string) => void;
}) {
  const { zone } = useAuth(),
    navigate = useNavigate(),
    toast = useToast();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [remaining, setRemaining] = useState(300);
  const offset = useRef(Date.parse(hold.serverNow) - Date.now()),
    expired = useRef(false);
  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil(
          (Date.parse(hold.expiresAt) - Date.now() - offset.current) / 1000,
        ),
      );
      setRemaining(seconds);
      if (seconds === 0 && !expired.current) {
        expired.current = true;
        onExpired();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hold.expiresAt, onExpired]);
  const release = async () => {
    setBusy(true);
    try {
      await send(`/holds/${hold.id}`, undefined, "DELETE");
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={
        hold.rescheduleOfId
          ? "Confirm your new appointment"
          : "Confirm your appointment"
      }
      onClose={() => {
        if (!busy) void release();
      }}
      busy={busy}
    >
      <div className={`hold-timer ${remaining < 60 ? "urgent" : ""}`}>
        <Icon name="clock" size={24} />
        <div>
          <strong>This time is reserved for you</strong>
          <span>Confirm before your reservation expires.</span>
        </div>
        <b aria-label={`${remaining} seconds remaining`}>
          {Math.floor(remaining / 60)
            .toString()
            .padStart(2, "0")}
          :{(remaining % 60).toString().padStart(2, "0")}
        </b>
      </div>
      <div className="hold-doctor">
        <Avatar name={hold.doctor.user.name} />
        <div>
          <h3>{hold.doctor.user.name}</h3>
          <p>{hold.doctor.specialty.name}</p>
        </div>
      </div>
      <dl className="summary-list">
        <div>
          <dt>Appointment</dt>
          <dd>{hold.appointmentType.name}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(hold.startAt, zone)}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {formatDate(hold.startAt, zone, "h:mm a")} –{" "}
            {formatDate(hold.endAt, zone, "h:mm a")}
          </dd>
        </div>
        <div>
          <dt>Timezone</dt>
          <dd>{zone}</dd>
        </div>
      </dl>
      {hold.rescheduleOfId && (
        <p className="inline-note">
          Your current appointment stays confirmed until this change succeeds.
          The new time must not overlap your current visit.
        </p>
      )}
      {error && <ErrorBox message={error} />}
      <button
        className="button full"
        disabled={busy || remaining === 0}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const result = await send(
              hold.rescheduleOfId
                ? `/appointments/${hold.rescheduleOfId}/reschedule`
                : "/appointments",
              { holdId: hold.id },
            );
            toast(
              hold.rescheduleOfId
                ? "Appointment rescheduled successfully."
                : "Appointment booked successfully.",
            );
            navigate(`/my-appointments/${result.id}`);
          } catch (e) {
            const failure = e as Error & { status?: number };
            if (failure.status === 409 || failure.status === 400) {
              await send(`/holds/${hold.id}`, undefined, "DELETE").catch(
                () => {},
              );
              onInvalid(failure.message);
            } else setError(failure.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Please wait…"
          : hold.rescheduleOfId
            ? "Confirm reschedule"
            : "Confirm appointment"}
        <Icon name="check" size={18} />
      </button>
      <button
        className="text-button full"
        disabled={busy}
        onClick={() => void release()}
      >
        Release this time and go back
      </button>
    </Modal>
  );
}
export function BookingPage() {
  const [params] = useSearchParams(),
    { zone } = useAuth();
  const doctors = useData<Doctor[]>("/doctors"),
    toast = useToast();
  const [doctorId, setDoctorId] = useState(params.get("doctor") || ""),
    [typeId, setTypeId] = useState(params.get("type") || ""),
    [date, setDate] = useState(today(zone)),
    [hold, setHold] = useState<Hold | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const doctor = doctors.data?.find((d) => d.id === doctorId),
    types =
      doctor?.appointmentTypes.filter((t) => t.appointmentType.isActive) || [];
  const slots = useData<{ slots: { startAt: string; endAt: string }[] }>(
    doctorId && typeId
      ? `/doctors/${doctorId}/slots?appointmentTypeId=${typeId}&date=${date}`
      : null,
  );
  const recovered = useData<{ serverNow: string; holds: Hold[] }>(
    params.get("hold") ? "/holds" : null,
  );
  useEffect(() => {
    if (doctors.data && !doctorId && doctors.data.length)
      setDoctorId(doctors.data[0].id);
  }, [doctors.data, doctorId]);
  useEffect(() => {
    if (doctor && !types.some((t) => t.appointmentTypeId === typeId))
      setTypeId(types[0]?.appointmentTypeId || "");
  }, [doctor, typeId]);
  useEffect(() => {
    if (recovered.data) {
      const h = recovered.data.holds.find((h) => h.id === params.get("hold"));
      if (h) setHold({ ...h, serverNow: recovered.data.serverNow });
      else
        setError(
          "Your reservation time expired. Please select an available appointment again.",
        );
    }
  }, [recovered.data, params]);
  useEffect(() => {
    if (hold || !typeId) return;
    const timer = setInterval(slots.reload, 20000);
    return () => clearInterval(timer);
  }, [hold, typeId, slots.reload]);
  const currentType = types.find(
    (t) => t.appointmentTypeId === typeId,
  )?.appointmentType;
  const baseDay = DateTime.fromISO(date, { zone });
  const weekStart =
    baseDay < DateTime.fromISO(today(zone), { zone }).plus({ days: 6 })
      ? DateTime.fromISO(today(zone), { zone })
      : baseDay;
  return (
    <>
      <Link
        className="back-link"
        to={
          params.get("reschedule")
            ? `/my-appointments/${params.get("reschedule")}`
            : "/doctors"
        }
      >
        <Icon name="back" size={16} />
        {params.get("reschedule") ? "Your current appointment" : "All doctors"}
      </Link>
      <PageHeading
        eyebrow="YOUR NEXT APPOINTMENT"
        title={
          params.get("reschedule")
            ? "Choose a new time"
            : "Let’s find a time that works"
        }
        description="Select your appointment, then choose an available time."
      />
      <div className="booking-steps">
        <span className="active">
          <b>1</b>Choose a time
        </span>
        <i />
        <span className={hold ? "active" : ""}>
          <b>2</b>Confirm appointment
        </span>
      </div>
      {doctors.error && (
        <ErrorBox message={doctors.error} retry={doctors.reload} />
      )}
      <div className="booking-layout">
        <section className="panel booking-main">
          <div className="form-grid">
            <Field label="Doctor">
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                disabled={busy}
              >
                <option value="">Select a doctor</option>
                {doctors.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user.name} · {d.specialty.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Appointment type">
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                disabled={!doctor || busy}
              >
                <option value="">Select a type</option>
                {types.map((t) => (
                  <option key={t.appointmentTypeId} value={t.appointmentTypeId}>
                    {t.appointmentType.name} ·{" "}
                    {t.appointmentType.durationMinutes} min
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="date-heading">
            <h2>Select a date</h2>
            <input
              aria-label="Appointment date"
              type="date"
              min={today(zone)}
              max={
                DateTime.now().setZone(zone).plus({ days: 365 }).toISODate()!
              }
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </div>
          <div className="date-strip">
            {Array.from({ length: 7 }, (_, i) =>
              weekStart.plus({ days: i }),
            ).map((d) => (
              <button
                key={d.toISODate()}
                className={d.toISODate() === date ? "selected" : ""}
                onClick={() => setDate(d.toISODate()!)}
                aria-label={d.toFormat("cccc, d LLLL")}
                aria-pressed={d.toISODate() === date}
              >
                <span>{d.toFormat("ccc")}</span>
                <b>{d.toFormat("dd")}</b>
                <small>{d.toFormat("LLL")}</small>
              </button>
            ))}
          </div>
          <div className="section-heading">
            <h2>Available times</h2>
            <span className="muted">{zone}</span>
          </div>
          {error && <ErrorBox message={error} />}
          <div aria-live="polite">
            {!typeId ? (
              <Empty title="Choose a doctor and appointment type" />
            ) : slots.loading ? (
              <Loading text="Checking availability…" />
            ) : slots.error ? (
              <ErrorBox message={slots.error} retry={slots.reload} />
            ) : !slots.data?.slots.length ? (
              <Empty title="No appointments available on this date">
                <p>Choose another day to see more times.</p>
              </Empty>
            ) : (
              <div className="time-grid">
                {slots.data.slots.map((s) => (
                  <button
                    className="time-button"
                    key={s.startAt}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        setHold(
                          await send("/holds", {
                            doctorId,
                            appointmentTypeId: typeId,
                            startAt: s.startAt,
                            ...(params.get("reschedule")
                              ? { rescheduleOfId: params.get("reschedule") }
                              : {}),
                          }),
                        );
                      } catch (e) {
                        setError((e as Error).message);
                        slots.reload();
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {formatDate(s.startAt, zone, "h:mm a")}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="small-note">
            <Icon name="clock" size={16} />
            Availability refreshes automatically. Selecting a time reserves it
            for 5 minutes.
          </p>
        </section>
        <aside className="booking-summary">
          <span className="eyebrow">APPOINTMENT SUMMARY</span>
          {doctor ? (
            <>
              <Avatar name={doctor.user.name} large />
              <h2>{doctor.user.name}</h2>
              <p>{doctor.specialty.name}</p>
              <div className="summary-divider" />
              <div className="summary-item">
                <Icon name="calendar" />
                <div>
                  <small>Date</small>
                  <strong>{formatDate(date, zone)}</strong>
                </div>
              </div>
              <div className="summary-item">
                <Icon name="clock" />
                <div>
                  <small>Appointment type</small>
                  <strong>{currentType?.name || "Choose a type"}</strong>
                  <span>
                    {currentType
                      ? `${currentType.durationMinutes} minutes`
                      : ""}
                  </span>
                </div>
              </div>
              <div className="summary-item">
                <Icon name="pin" />
                <div>
                  <small>Location</small>
                  <strong>Clearwell Clinic</strong>
                  <span>In-person appointment</span>
                </div>
              </div>
            </>
          ) : (
            <p>Select a doctor to get started.</p>
          )}
          <div className="summary-callout">
            <Icon name="shield" />
            <p>
              Your appointment is booked once you confirm your reserved time.
            </p>
          </div>
        </aside>
      </div>
      {hold && (
        <HoldConfirmation
          hold={hold}
          onInvalid={(message) => {
            setHold(null);
            setError(message);
            slots.reload();
          }}
          onClose={() => {
            setHold(null);
            slots.reload();
          }}
          onExpired={() => {
            setHold(null);
            setError(
              "Your reservation time expired. Please select an available appointment again.",
            );
            slots.reload();
            toast("Reservation expired. Please choose another time.");
          }}
        />
      )}
    </>
  );
}
