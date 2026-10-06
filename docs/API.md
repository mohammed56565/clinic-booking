# REST API

Base URL: `http://127.0.0.1:3001/api`. Send JSON with `Content-Type: application/json`. Protected endpoints require `Authorization: Bearer <token>`.

GET/PATCH/PUT/DELETE success responses use HTTP 200; POST success responses use HTTP 201. Errors have the form `{"statusCode":409,"message":"This appointment is no longer available. Please select another time."}`. Validation failures are 400, missing/expired credentials 401, forbidden role/ownership 403, missing records 404, scheduling/unique conflicts 409, and rate limits 429. Unexpected failures return a generic 500 message without stack traces or credentials.

IDs are UUIDs. Appointment timestamps include a timezone offset or `Z`; responses serialize UTC instants. Dates for slot lookup are local clinic dates in `YYYY-MM-DD` format. Weekly `dayOfWeek` is Sunday=0 through Saturday=6; working-window minutes are 0 through 1440.

## Authentication and account

| Method and path       | Access    | Body or result                                         |
| --------------------- | --------- | ------------------------------------------------------ |
| GET `/health`         | Public    | Database-backed health status                          |
| GET `/config`         | Public    | Clinic name, timezone, hold minutes, server time       |
| POST `/auth/register` | Public    | `{name,email,password}` → `{token,user}`; Patient only |
| POST `/auth/login`    | Public    | `{email,password}` → `{token,user}`                    |
| GET `/auth/me`        | Signed in | Current user and profile IDs                           |
| POST `/auth/logout`   | Signed in | Revokes all existing tokens for this user              |
| PATCH `/profile`      | Signed in | `{name}`; updates own basic profile                    |
| GET `/users`          | Admin     | Users without hashes/token metadata                    |
| PATCH `/users/:id`    | Admin     | `{isActive}`; cannot deactivate self                   |

Password length: 8–128 characters. Name: 1–100 trimmed characters. Emails are normalized to lowercase and unique case-insensitively. Public registration rejects `role`, `isActive`, and other unexpected fields.

## Catalog and doctors

| Method and path                | Access    | Body or result                                            |
| ------------------------------ | --------- | --------------------------------------------------------- |
| GET `/specialties`             | Signed in | Specialty list                                            |
| POST `/specialties`            | Admin     | `{name}`                                                  |
| PATCH `/specialties/:id`       | Admin     | `{name}`                                                  |
| GET `/appointment-types`       | Signed in | Active types; admin also sees inactive                    |
| POST `/appointment-types`      | Admin     | `{name,durationMinutes,isActive}`                         |
| PATCH `/appointment-types/:id` | Admin     | Same body as create                                       |
| GET `/doctors`                 | Signed in | Active doctors; admin also sees inactive                  |
| GET `/doctors/:id`             | Signed in | Specialty, supported types, weekly windows                |
| POST `/doctors`                | Admin     | `{name,email,password,specialtyId,appointmentTypeIds:[]}` |
| PATCH `/doctors/:id`           | Admin     | `{name,specialtyId,isActive,appointmentTypeIds:[]}`       |

Type duration must be an integer from 1 to 720 minutes. Doctor email is returned only to admins. No public doctor registration exists. Names for specialties/types are unique case-insensitively. Type edits never change historical start/end times. Confirmation rejects a held type whose duration has changed.

## Working hours and blocked time

| Method and path                                                 | Access             | Body or result                                  |
| --------------------------------------------------------------- | ------------------ | ----------------------------------------------- |
| GET `/doctors/:id/availability`                                 | Admin / own doctor | `{windows:[],blocks:[]}`                        |
| PUT `/doctors/:id/availability`                                 | Admin / own doctor | `{windows:[{dayOfWeek,startMinute,endMinute}]}` |
| POST `/doctors/:id/blocked-times`                               | Admin / own doctor | `{startAt,endAt,reason?}`                       |
| DELETE `/doctors/:id/blocked-times/:blockId`                    | Admin / own doctor | Deletes a future blocked period                 |
| GET `/doctors/:id/slots?appointmentTypeId=UUID&date=YYYY-MM-DD` | Patient            | `{serverNow,slots:[{startAt,endAt}]}`           |

PUT replaces the entire weekly pattern. Windows must have start < end and cannot overlap on the same day. At most 70 windows are accepted. Changes excluding a future/in-progress confirmed appointment or active hold are rejected. Blocks require a future start and cannot overlap appointments, active holds, or existing blocks. Cross-date blocks are allowed. Reasons are optional, at most 200 characters, and not exposed to patients.

Slot dates must be from today through 365 days ahead. Starts are aligned to the chosen duration from each working-window start. Complete duration must fit. Patient conflicts apply across doctors.

## Holds and appointments

| Method and path                     | Access                             | Body or result                                                                |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| POST `/holds`                       | Patient                            | `{doctorId,appointmentTypeId,startAt,rescheduleOfId?}` → hold and server time |
| GET `/holds`                        | Patient                            | `{serverNow,holds:[]}` for own unexpired active holds                         |
| DELETE `/holds/:id`                 | Owner patient                      | Releases the hold                                                             |
| POST `/appointments`                | Patient                            | `{holdId}` → confirmed appointment                                            |
| GET `/appointments`                 | Signed in                          | Patient's own / doctor's own / all for admin                                  |
| GET `/appointments/:id`             | Owner patient / own doctor / admin | One appointment                                                               |
| POST `/appointments/:id/cancel`     | Owner patient / admin              | Cancels future confirmed appointment                                          |
| POST `/appointments/:id/reschedule` | Owner patient                      | `{holdId}` bound to this original appointment                                 |
| POST `/appointments/:id/outcome`    | Own doctor / admin                 | `{status:"COMPLETED"}` or `{status:"NO_SHOW"}`                                |

Appointment responses include doctor name, basic patient name/email, booked specialty, appointment type, UTC start/end, status, and history links. Access is scoped before returning these fields. Appointment statuses are `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`; there is no pending state.

### Booking example

```text
1. GET /doctors
2. GET /doctors/{doctorId}/slots?appointmentTypeId={typeId}&date=2026-10-05
3. POST /holds
   {"doctorId":"…","appointmentTypeId":"…","startAt":"2026-10-05T07:00:00Z"}
4. POST /appointments
   {"holdId":"…"}
```

Use a returned slot instant exactly; invented or off-grid starts are rejected. The hold ends five minutes after server time at creation, not five minutes after the requested appointment start. At `now >= expiresAt`, confirmation fails and the hold ceases to block availability. There is no grace period or refresh-token flow.

### Reschedule example

Create a new hold with `rescheduleOfId` set to the current appointment ID, then send its `holdId` to `/appointments/{originalId}/reschedule`. The new period must not overlap the old one or any other reservation. Never cancel the original first. The API consumes the new hold and replaces the original in one atomic transaction. Calling normal confirmation on a reschedule hold is rejected. Repeating a successful confirmation returns the already-created appointment.

### Client conflict behavior

After a 409 on hold creation, refresh slots. After a confirmation is invalidated by a scheduling change, the UI releases the hold if possible, closes the confirmation, shows the server message, and refreshes slots. A countdown uses `serverNow` to compensate for the client clock. The backend remains authoritative regardless of the browser countdown.
