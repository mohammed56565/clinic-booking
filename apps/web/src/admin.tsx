import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DateTime } from "luxon";
import {
  send,
  type AppointmentType,
  type Doctor,
  type Specialty,
  type User,
  type Window,
} from "./api";
import { formatDate, useAuth } from "./context";
import {
  Avatar,
  Badge,
  Confirm,
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
import { minuteText } from "./patient";
export function CatalogPage({ types = false }: { types?: boolean }) {
  const path = types ? "/appointment-types" : "/specialties",
    result = useData<(Specialty & Partial<AppointmentType>)[]>(path),
    toast = useToast();
  const [editing, setEditing] = useState<
      (Specialty & Partial<AppointmentType>) | "new" | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const item = editing && editing !== "new" ? editing : null;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await send(
        `${path}${item ? `/${item.id}` : ""}`,
        {
          name: String(form.get("name")),
          ...(types
            ? {
                durationMinutes: Number(form.get("duration")),
                isActive: form.get("active") === "on",
              }
            : {}),
        },
        item ? "PATCH" : "POST",
      );
      toast(
        `${types ? "Appointment type" : "Specialty"} ${item ? "updated" : "created"}.`,
      );
      setEditing(null);
      result.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="CLINIC SETTINGS"
        title={types ? "Appointment types" : "Specialties"}
        description={
          types
            ? "Set the services and durations available for booking."
            : "Organize your care team by medical specialty."
        }
        action={
          <button
            className="button"
            onClick={() => {
              setEditing("new");
              setError("");
            }}
          >
            <Icon name="plus" size={18} />
            Add {types ? "appointment type" : "specialty"}
          </button>
        }
      />
      <section className="panel no-padding">
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorBox message={result.error} retry={result.reload} />
        ) : !result.data?.length ? (
          <Empty
            title={`No ${types ? "appointment types" : "specialties"} yet`}
          >
            <p>Add the first one to get started.</p>
          </Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  {types && (
                    <>
                      <th>Duration</th>
                      <th>Status</th>
                    </>
                  )}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    {types && (
                      <>
                        <td>{s.durationMinutes} minutes</td>
                        <td>
                          <Badge status={s.isActive ? "ACTIVE" : "INACTIVE"} />
                        </td>
                      </>
                    )}
                    <td>
                      <button
                        className="button secondary small"
                        onClick={() => {
                          setEditing(s);
                          setError("");
                        }}
                      >
                        <Icon name="edit" size={15} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <Modal
          title={`${item ? "Edit" : "Add"} ${types ? "appointment type" : "specialty"}`}
          onClose={() => setEditing(null)}
          busy={busy}
        >
          <form onSubmit={submit}>
            <Field label="Name">
              <input
                name="name"
                defaultValue={item?.name || ""}
                required
                maxLength={100}
                autoFocus
              />
            </Field>
            {types && (
              <>
                <Field label="Duration in minutes">
                  <input
                    type="number"
                    name="duration"
                    defaultValue={item?.durationMinutes || 30}
                    min={1}
                    max={720}
                    step={1}
                    required
                  />
                </Field>
                <label className="checkbox">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={item?.isActive ?? true}
                  />
                  Available for new bookings
                </label>
                <p className="small-note">
                  Duration changes apply to new bookings. Existing appointment
                  times remain unchanged.
                </p>
              </>
            )}
            {error && <ErrorBox message={error} />}
            <div className="dialog-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function AdminDoctors() {
  const result = useData<Doctor[]>("/doctors"),
    specialties = useData<Specialty[]>("/specialties"),
    types = useData<AppointmentType[]>("/appointment-types"),
    toast = useToast();
  const [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Doctor | "new" | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<any>(null);
  const item = editing && editing !== "new" ? editing : null;
  const save = async (data: any) => {
    setBusy(true);
    setError("");
    try {
      await send(
        `/doctors${item ? `/${item.id}` : ""}`,
        data,
        item ? "PATCH" : "POST",
      );
      setEditing(null);
      result.reload();
      toast(item ? "Doctor updated." : "Doctor account created.");
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = {
      name: String(f.get("name")),
      specialtyId: String(f.get("specialty")),
      appointmentTypeIds: f.getAll("types").map(String),
      ...(item
        ? { isActive: f.get("active") === "on" }
        : {
            email: String(f.get("email")),
            password: String(f.get("password")),
          }),
    };
    if (item?.user.isActive && f.get("active") !== "on") setPending(data);
    else await save(data).catch(() => {});
  };
  const matches =
    result.data?.filter((d) =>
      `${d.user.name} ${d.specialty.name} ${d.user.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <PageHeading
        eyebrow="YOUR CARE TEAM"
        title="Doctors"
        description="Manage doctor accounts, specialties, and the appointments they offer."
        action={
          <button
            className="button"
            onClick={() => {
              setEditing("new");
              setError("");
            }}
          >
            <Icon name="plus" size={18} />
            Add doctor
          </button>
        }
      />
      <section className="panel no-padding">
        <div className="table-filters">
          <div className="search-input">
            <Icon name="search" />
            <input
              aria-label="Search doctors"
              placeholder="Search your care team"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="muted">{matches.length} doctors</span>
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorBox message={result.error} retry={result.reload} />
        ) : !matches.length ? (
          <Empty title="No doctors found" />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Appointment types</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={d.user.name} />
                        <div>
                          <strong>{d.user.name}</strong>
                          <small>{d.user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{d.specialty.name}</td>
                    <td>
                      {d.appointmentTypes.map((t) => (
                        <small key={t.appointmentTypeId}>
                          {t.appointmentType.name}
                        </small>
                      ))}
                    </td>
                    <td>
                      <Badge status={d.user.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="button secondary small"
                          onClick={() => {
                            setEditing(d);
                            setError("");
                          }}
                        >
                          Edit
                        </button>
                        <Link
                          className="text-button"
                          to={`/admin/doctors/${d.id}/availability`}
                        >
                          Schedule
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <Modal
          title={item ? "Edit doctor" : "Add a doctor"}
          onClose={() => setEditing(null)}
          busy={busy}
        >
          <form onSubmit={submit}>
            <Field label="Doctor’s name">
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={item?.user.name || ""}
                autoFocus
              />
            </Field>
            {!item && (
              <>
                <Field label="Email address">
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Initial password"
                  hint="Share this password with the doctor through a secure channel."
                >
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                  />
                </Field>
              </>
            )}
            <Field label="Specialty">
              <select
                name="specialty"
                required
                defaultValue={item?.specialtyId || ""}
              >
                <option value="">Select a specialty</option>
                {specialties.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="checkbox-list">
              <legend>Offered appointment types</legend>
              {types.data?.map((t) => (
                <label className="checkbox" key={t.id}>
                  <input
                    type="checkbox"
                    name="types"
                    value={t.id}
                    defaultChecked={
                      item?.appointmentTypes.some(
                        (a) => a.appointmentTypeId === t.id,
                      ) || false
                    }
                  />
                  {t.name}
                  <small>
                    {t.durationMinutes} min{!t.isActive ? " · Inactive" : ""}
                  </small>
                </label>
              ))}
            </fieldset>
            {item && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={item.user.isActive}
                />
                Active doctor account
              </label>
            )}
            {error && <ErrorBox message={error} />}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : item ? "Save changes" : "Create doctor"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {pending && (
        <Confirm
          title="Deactivate this doctor?"
          description="They will no longer be able to sign in or receive new bookings. Existing appointments remain on the schedule for you to manage."
          label="Deactivate doctor"
          danger
          onClose={() => setPending(null)}
          action={() => save(pending)}
        />
      )}
    </>
  );
}
export function UsersPage() {
  const result = useData<User[]>("/users"),
    { user } = useAuth(),
    toast = useToast();
  const [selected, setSelected] = useState<User | null>(null),
    [search, setSearch] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="ACCESS MANAGEMENT"
        title="User accounts"
        description="Control access for patients, doctors, and administrators."
      />
      <section className="panel no-padding">
        <div className="table-filters">
          <div className="search-input">
            <Icon name="search" />
            <input
              aria-label="Search users"
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {result.loading ? (
          <Loading />
        ) : result.error ? (
          <ErrorBox message={result.error} retry={result.reload} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {result.data
                  ?.filter((u) =>
                    `${u.name} ${u.email}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <small>{u.email}</small>
                      </td>
                      <td>{u.role[0] + u.role.slice(1).toLowerCase()}</td>
                      <td>
                        <Badge status={u.isActive ? "ACTIVE" : "INACTIVE"} />
                      </td>
                      <td>
                        {u.id !== user!.id ? (
                          <button
                            className="button secondary small"
                            onClick={() => setSelected(u)}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                        ) : (
                          <span className="muted">Your account</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <Confirm
          title={`${selected.isActive ? "Deactivate" : "Activate"} ${selected.name}?`}
          description={
            selected.isActive
              ? "This user will be signed out and unable to sign in. Existing appointments remain on the schedule."
              : "This user will be able to sign in again."
          }
          label={selected.isActive ? "Deactivate account" : "Activate account"}
          danger={selected.isActive}
          onClose={() => setSelected(null)}
          action={async () => {
            await send(
              `/users/${selected.id}`,
              { isActive: !selected.isActive },
              "PATCH",
            );
            result.reload();
            toast("Account status updated.");
          }}
        />
      )}
    </>
  );
}
type Block = { id: string; startAt: string; endAt: string; reason?: string };
export function AvailabilityPage() {
  const { user, zone } = useAuth(),
    { id } = useParams(),
    doctorId = id || user!.doctor!.id,
    result = useData<{ windows: Window[]; blocks: Block[] }>(
      `/doctors/${doctorId}/availability`,
    ),
    doctor = useData<Doctor>(`/doctors/${doctorId}`),
    toast = useToast();
  const [windows, setWindows] = useState<Window[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [blockOpen, setBlockOpen] = useState(false),
    [blockError, setBlockError] = useState(""),
    [remove, setRemove] = useState<Block | null>(null);
  useEffect(() => {
    if (result.data)
      setWindows(
        result.data.windows.map(({ dayOfWeek, startMinute, endMinute }) => ({
          dayOfWeek,
          startMinute,
          endMinute,
        })),
      );
  }, [result.data]);
  const setMinute = (
    index: number,
    field: "startMinute" | "endMinute",
    text: string,
  ) => {
    if (!text) return;
    const [h, m] = text.split(":").map(Number),
      minute = h * 60 + m;
    setWindows((v) =>
      v.map((w, i) =>
        i === index
          ? {
              ...w,
              [field]: field === "endMinute" && minute === 0 ? 1440 : minute,
            }
          : w,
      ),
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="SCHEDULE SETTINGS"
        title="Working hours & time off"
        description={`${doctor.data?.user.name || "Your schedule"} · All times in ${zone}`}
      />
      {result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorBox message={result.error} retry={result.reload} />
      ) : (
        <div className="availability-layout">
          <section className="panel">
            <div className="section-heading">
              <h2>Weekly working hours</h2>
              <span className="badge active">Repeats weekly</span>
            </div>
            <p className="muted">
              Add one or more periods per day. Leave a day empty when you’re not
              available.
            </p>
            {[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((day, dayOfWeek) => (
              <div className="working-day" key={day}>
                <strong>{day}</strong>
                <div className="working-windows">
                  {windows.map(
                    (w, index) =>
                      w.dayOfWeek === dayOfWeek && (
                        <div className="working-window" key={index}>
                          <input
                            type="time"
                            aria-label={`${day} start time ${index + 1}`}
                            value={minuteText(w.startMinute)}
                            onChange={(e) =>
                              setMinute(index, "startMinute", e.target.value)
                            }
                          />
                          <span>to</span>
                          <input
                            type="time"
                            aria-label={`${day} end time ${index + 1}`}
                            value={
                              w.endMinute === 1440
                                ? "00:00"
                                : minuteText(w.endMinute)
                            }
                            onChange={(e) =>
                              setMinute(index, "endMinute", e.target.value)
                            }
                          />
                          <button
                            className="icon-button"
                            aria-label={`Remove ${day} period ${index + 1}`}
                            onClick={() =>
                              setWindows((v) => v.filter((_, i) => i !== index))
                            }
                          >
                            <Icon name="close" size={17} />
                          </button>
                        </div>
                      ),
                  )}
                  {!windows.some((w) => w.dayOfWeek === dayOfWeek) && (
                    <span className="muted">Unavailable</span>
                  )}
                </div>
                <button
                  className="icon-button"
                  aria-label={`Add ${day} working period`}
                  onClick={() =>
                    setWindows((v) => [
                      ...v,
                      { dayOfWeek, startMinute: 540, endMinute: 1020 },
                    ])
                  }
                >
                  <Icon name="plus" size={18} />
                </button>
              </div>
            ))}
            {error && <ErrorBox message={error} />}
            <div className="panel-footer">
              <span className="small-note">
                Existing bookings must still fit within your hours.
              </span>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await send(
                      `/doctors/${doctorId}/availability`,
                      { windows },
                      "PUT",
                    );
                    toast("Availability updated.");
                    result.reload();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Save working hours"}
              </button>
            </div>
          </section>
          <section className="panel blocked-panel">
            <div className="section-heading">
              <h2>Blocked time</h2>
              <button
                className="button secondary small"
                onClick={() => {
                  setBlockOpen(true);
                  setBlockError("");
                }}
              >
                <Icon name="plus" size={16} />
                Add
              </button>
            </div>
            <p className="muted">
              Reserve time for breaks, leave, or other commitments.
            </p>
            {!result.data?.blocks.length ? (
              <Empty title="No blocked periods">
                <p>Your regular working hours apply.</p>
              </Empty>
            ) : (
              result.data.blocks.map((b) => (
                <div className="block-item" key={b.id}>
                  <strong>{b.reason || "Unavailable"}</strong>
                  <span>
                    {formatDate(b.startAt, zone, "d LLL, h:mm a")} –{" "}
                    {formatDate(b.endAt, zone, "d LLL, h:mm a")}
                  </span>
                  {new Date(b.startAt) > new Date() && (
                    <button
                      className="text-button danger-text"
                      onClick={() => setRemove(b)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      )}
      {blockOpen && (
        <Modal
          title="Add blocked time"
          onClose={() => setBlockOpen(false)}
          busy={busy}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const start = DateTime.fromISO(String(f.get("start")), { zone }),
                end = DateTime.fromISO(String(f.get("end")), { zone });
              if (!start.isValid || !end.isValid) {
                setBlockError("Choose valid dates and times.");
                return;
              }
              setBusy(true);
              setBlockError("");
              try {
                await send(`/doctors/${doctorId}/blocked-times`, {
                  startAt: start.toISO(),
                  endAt: end.toISO(),
                  reason: String(f.get("reason")),
                });
                setBlockOpen(false);
                result.reload();
                toast("Blocked time added.");
              } catch (e) {
                setBlockError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Start" hint={zone}>
              <input name="start" type="datetime-local" required />
            </Field>
            <Field label="End">
              <input name="end" type="datetime-local" required />
            </Field>
            <Field label="Reason (optional)">
              <input
                name="reason"
                placeholder="e.g. Annual leave"
                maxLength={200}
              />
            </Field>
            {blockError && <ErrorBox message={blockError} />}
            <div className="dialog-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => setBlockOpen(false)}
              >
                Cancel
              </button>
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Block time"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Confirm
          title="Remove this blocked period?"
          description="This time will become available for bookings within your working hours."
          label="Remove blocked time"
          danger
          onClose={() => setRemove(null)}
          action={async () => {
            await send(
              `/doctors/${doctorId}/blocked-times/${remove.id}`,
              undefined,
              "DELETE",
            );
            result.reload();
            toast("Blocked time removed.");
          }}
        />
      )}
    </>
  );
}
