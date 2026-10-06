import { useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import luxonPlugin from "@fullcalendar/luxon3";
import { type Appointment } from "./api";
import { useAuth, formatDate } from "./context";
import { useData, PageHeading, Loading, ErrorBox, Modal, Badge } from "./ui";
import { AppointmentActions } from "./appointments";
export default function CalendarPage() {
  const { zone } = useAuth(),
    result = useData<Appointment[]>("/appointments"),
    [selected, setSelected] = useState<Appointment | null>(null);
  return (
    <>
      <PageHeading
        eyebrow="DOCTOR WORKSPACE"
        title="My calendar"
        description={`Your day and week at a glance. All times shown in ${zone}.`}
      />
      <section className="panel calendar-panel">
        {result.loading ? (
          <Loading text="Loading your schedule…" />
        ) : result.error ? (
          <ErrorBox message={result.error} retry={result.reload} />
        ) : (
          <FullCalendar
            plugins={[timeGridPlugin, luxonPlugin]}
            initialView="timeGridWeek"
            timeZone={zone}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridDay,timeGridWeek",
            }}
            buttonText={{ today: "Today", day: "Day", week: "Week" }}
            firstDay={0}
            allDaySlot={false}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            scrollTime="08:00:00"
            height={680}
            nowIndicator
            events={(result.data || []).map((a) => ({
              id: a.id,
              title: `${a.patient.user.name} · ${a.appointmentType.name} · ${a.status === "NO_SHOW" ? "No-show" : a.status.toLowerCase()}`,
              start: a.startAt,
              end: a.endAt,
              color:
                a.status === "CANCELLED"
                  ? "#7c8698"
                  : a.status === "COMPLETED"
                    ? "#137b66"
                    : a.status === "NO_SHOW"
                      ? "#b75d20"
                      : "#2554cf",
            }))}
            eventClick={(e) =>
              setSelected(result.data?.find((a) => a.id === e.event.id) || null)
            }
          />
        )}
      </section>
      {selected && (
        <Modal title="Appointment details" onClose={() => setSelected(null)}>
          <Badge status={selected.status} />
          <dl className="summary-list">
            <div>
              <dt>Patient</dt>
              <dd>{selected.patient.user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{selected.patient.user.email}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{selected.appointmentType.name}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>
                {formatDate(selected.startAt, zone, "ccc, d LLL · h:mm a")}
              </dd>
            </div>
          </dl>
          <AppointmentActions
            appointment={selected}
            onChange={() => {
              setSelected(null);
              result.reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
