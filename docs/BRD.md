# Business Requirements Document (BRD)
# Clinic Appointment Booking System

**Version:** 1.0  
**Document Status:** Approved Development Baseline  
**Date:** September 28, 2026  
**Project Type:** Full-Stack Clinic Appointment Scheduling Web Application  
**Primary Interface Language:** English  
**Clinic Model:** Single Clinic  
**Project Owner:** To Be Defined

---

# 1. Executive Summary

The Clinic Appointment Booking System is a full-stack web application designed to allow patients to discover doctors, view real-time availability, temporarily hold appointment slots, book appointments, cancel appointments, and reschedule appointments.

The system also allows doctors to manage their availability, block unavailable periods, view their schedules, and update the outcome of appointments.

Administrators manage doctors, specialties, appointment types, doctor schedules, and user accounts.

The central technical and business challenge of the system is to provide reliable scheduling while preventing:

- Double booking of doctors
- Double booking of patients
- Booking unavailable periods
- Booking blocked periods
- Booking expired temporary holds
- Race conditions when multiple patients attempt to reserve the same time simultaneously

The booking experience should behave similarly to airline or cinema reservation systems.

When a patient selects an available appointment slot, the system temporarily reserves that slot for **5 minutes**.

During this period, other patients must not be able to book the same slot.

If the patient confirms the booking before the hold expires, the hold becomes a confirmed appointment.

If the patient does not complete the booking within 5 minutes, the hold expires automatically and the slot becomes available again.

The system must enforce booking integrity at both the backend and database level.

---

# 2. Business Objectives

The system aims to:

1. Allow patients to register and book appointments online.
2. Provide accurate doctor availability.
3. Prevent double booking.
4. Temporarily reserve appointment slots during the booking process.
5. Allow doctors to define their working availability.
6. Allow doctors to block unavailable periods.
7. Support different appointment types with different durations.
8. Allow patients to cancel future appointments.
9. Allow patients to reschedule future appointments safely.
10. Allow doctors to manage appointment outcomes.
11. Provide Admin control over doctors, specialties, schedules, and appointment types.
12. Provide a responsive and professional booking experience.
13. Maintain clear role-based permissions.
14. Provide automated tests for critical scheduling and booking rules.
15. Produce a portfolio-ready full-stack application with meaningful business logic.

---

# 3. Project Scope

## 3.1 In Scope

Version 1 includes:

### Authentication

- Patient registration
- Login
- Logout
- Email and password authentication
- JWT authentication
- Password hashing

### Patient Management

- Patient self-registration
- Patient profile
- View upcoming appointments
- View past appointments
- Book appointments
- Cancel appointments
- Reschedule appointments

### Doctor Management

- Admin-created Doctor accounts
- Doctor profiles
- Doctor specialties
- Doctor availability
- Doctor blocked time
- Doctor appointment calendar
- Appointment completion
- No-show marking

### Specialties

- Create specialties
- Edit specialties
- Assign doctors to specialties
- Search or filter doctors by specialty

### Appointment Types

- Create appointment types
- Define appointment duration
- Assign appointment types to Doctors
- Enable or disable appointment types

Initial appointment types:

```text
General Consultation — 30 minutes
Follow-up — 15 minutes
```

These are initial data only.

Appointment types must not be hardcoded permanently.

Admin can create additional appointment types later.

### Scheduling

- Weekly Doctor working hours
- Doctor-specific availability
- Blocked time
- Slot generation
- Availability calculation
- Temporary Slot Holds
- Appointment booking
- Conflict detection

### Appointment Management

- Confirmed appointments
- Completed appointments
- Cancelled appointments
- No-show appointments
- Rescheduling

### Calendar

- Doctor Day View
- Doctor Week View
- Calendar-based appointment display

### User Experience

- Responsive Design
- Loading states
- Empty states
- Error states
- Confirmation dialogs
- Toast feedback

---

# 4. Out of Scope

Version 1 does not include:

- Medical Records
- Patient Medical History
- Diagnoses
- Prescriptions
- Medications
- Laboratory Results
- Insurance
- Billing
- Payments
- Invoices
- Pharmacy Management
- File Attachments
- Video Consultation
- Real-Time Chat
- AI Features
- AI Chatbot
- Email Notifications
- SMS Notifications
- WhatsApp Integration
- Google Calendar Integration
- Outlook Integration
- Reports Module
- PDF Export
- CSV Export
- Excel Export
- Profile Images
- Native Mobile Application
- Multiple Clinics
- Multiple Branches
- Recurring Appointments
- Waiting List
- Dark Mode
- Docker
- Nginx
- GitHub Actions

These may be considered in future versions if needed.

---

# 5. User Roles

The system contains three roles:

1. Admin
2. Doctor
3. Patient

---

# 6. Admin

The Admin has system-wide management permissions.

Admin can:

- Create Doctor accounts
- Edit Doctor accounts
- Activate or deactivate Doctors
- Manage Specialties
- Manage Appointment Types
- Assign Appointment Types to Doctors
- Manage Doctor working hours
- View all appointments
- Cancel appointments when necessary
- Manage user accounts
- View system scheduling information

Patients are not created manually by Admin under normal operation because Patients can register themselves.

---

# 7. Doctor

Doctors can:

- Login
- View their appointment calendar
- View today's appointments
- View upcoming appointments
- View basic Patient booking information
- View their own Availability
- Modify their own Availability
- Add Blocked Time
- Remove future Blocked Time where allowed
- Mark appointments as Completed
- Mark appointments as No-show

Doctors cannot:

- Create Admin accounts
- Create other Doctor accounts
- Manage Specialties
- Manage global Appointment Types
- Access another Doctor's schedule management
- Access unrelated appointments

---

# 8. Patient

Patients can:

- Register
- Login
- Manage basic profile information
- Browse Doctors
- Filter Doctors by Specialty
- Select Appointment Type
- View available appointment slots
- Create a Temporary Hold
- Confirm an appointment
- View upcoming appointments
- View past appointments
- Cancel future appointments
- Reschedule future appointments

Patients cannot:

- Access Doctor administration
- Access other Patients' appointments
- Modify Doctor schedules
- Modify Appointment Types
- Mark appointments Completed
- Mark appointments No-show

---

# 9. Permission Matrix

| Action | Admin | Doctor | Patient |
|---|---|---|---|
| Manage Doctors | Yes | No | No |
| Manage Specialties | Yes | No | No |
| Manage Appointment Types | Yes | No | No |
| Manage Doctor Appointment Types | Yes | No | No |
| Manage Any Doctor Schedule | Yes | No | No |
| Manage Own Availability | N/A | Yes | No |
| Create Blocked Time | Yes | Own Schedule | No |
| View All Appointments | Yes | No | No |
| View Own Doctor Appointments | Yes | Yes | No |
| View Own Patient Appointments | Yes | No | Yes |
| Book Appointment | No | No | Yes |
| Cancel Own Appointment | N/A | No | Yes |
| Cancel Any Appointment | Yes | No | No |
| Reschedule Own Appointment | No | No | Yes |
| Mark Completed | Yes | Yes | No |
| Mark No-show | Yes | Yes | No |

Backend authorization must enforce all permissions.

Frontend visibility alone must never be treated as a security mechanism.

---

# 10. Authentication

## FR01 – Patient Registration

Patients can create their own accounts.

Required information:

- Name
- Email
- Password

### Acceptance Criteria

- Name is required.
- Email is required.
- Email must be valid.
- Email must be unique.
- Password must meet minimum password rules.
- Successful registration creates a Patient account.
- Patient role is assigned automatically.
- Users cannot choose their own role.

---

# 11. Doctor Account Creation

## FR02 – Create Doctor

Doctor accounts are created by Admin.

Doctor registration is not public.

Doctor information includes:

- Name
- Email
- Specialty
- Account Status

### Acceptance Criteria

- Only Admin can create Doctor accounts.
- Doctor email must be unique.
- Specialty must exist.
- Doctor account must receive the Doctor role.
- Doctor cannot assign themselves another role.

---

# 12. Login

## FR03 – User Login

Users authenticate using:

- Email
- Password

The system uses JWT for authenticated sessions.

### Acceptance Criteria

- Invalid credentials are rejected.
- Disabled accounts cannot login.
- Successful login returns valid authentication credentials.
- Passwords are never returned by the API.
- Protected APIs reject unauthenticated requests.

---

# 13. Password Security

Passwords must be hashed using:

**Argon2**

Plain-text passwords must never be stored.

---

# 14. Specialties

## FR04 – Specialty Management

Admin can create and edit medical specialties.

Examples:

```text
General Medicine
Dermatology
Cardiology
Orthopedics
```

Each Doctor belongs to one Specialty in Version 1.

### Acceptance Criteria

- Specialty Name is required.
- Duplicate Specialty Names should be prevented.
- A Doctor must reference an existing Specialty.

---

# 15. Appointment Types

## FR05 – Appointment Type Management

Appointment Types define the nature and duration of appointments.

Each Appointment Type contains:

- ID
- Name
- Duration in Minutes
- Active Status
- Created At
- Updated At

Initial data:

```text
General Consultation — 30 minutes
Follow-up — 15 minutes
```

### Acceptance Criteria

- Name is required.
- Duration must be greater than zero.
- Inactive Appointment Types cannot be selected for new bookings.
- Historical appointments remain linked to inactive Appointment Types.

---

# 16. Doctor Appointment Types

Not every Doctor must provide every Appointment Type.

Admin determines which Appointment Types each Doctor provides.

Example:

```text
Dr. Ahmed

General Consultation — Yes
Follow-up — Yes
```

Another Doctor may provide only:

```text
General Consultation
```

Patients must only see Appointment Types supported by the selected Doctor.

---

# 17. Doctor Working Hours

## FR06 – Doctor Availability

Doctors have weekly working hours.

Example:

```text
Sunday
09:00 – 14:00

Monday
09:00 – 14:00

Tuesday
12:00 – 18:00
```

Admin can configure working hours for any Doctor.

Doctors can modify their own future Availability.

### Acceptance Criteria

- Start Time must be before End Time.
- Invalid time ranges are rejected.
- Availability belongs to exactly one Doctor.
- Availability changes must affect future generated slots.

---

# 18. Blocked Time

## FR07 – Doctor Blocked Time

Blocked Time represents a period during which the Doctor cannot accept appointments.

Examples:

- Meeting
- Personal Leave
- Training
- Break
- Unavailable Period

Blocked Time contains:

- Doctor
- Start Date and Time
- End Date and Time
- Optional Reason

### Acceptance Criteria

- Start must be before End.
- Blocked periods cannot generate available slots.
- Existing Confirmed Appointments must not silently disappear when Blocked Time is created.
- Conflicting existing appointments must be handled explicitly rather than overwritten.

---

# 19. Slot Generation

The system does not permanently create every possible appointment slot in advance.

Available slots are generated using:

```text
Doctor Working Hours
-
Confirmed Appointments
-
Active Temporary Holds
-
Blocked Time
```

The selected Appointment Type determines the required duration.

Example:

Doctor Availability:

```text
09:00 – 11:00
```

For:

```text
General Consultation — 30 minutes
```

possible slots may include:

```text
09:00
09:30
10:00
10:30
```

For:

```text
Follow-up — 15 minutes
```

possible slots may include:

```text
09:00
09:15
09:30
09:45
10:00
10:15
10:30
10:45
```

A slot must only be displayed when the complete appointment duration fits inside available time.

---

# 20. Slot Availability Rules

A slot is Available only if:

1. The Doctor is working during the complete appointment period.
2. The Doctor has no Confirmed Appointment overlapping the period.
3. The Doctor has no active Temporary Hold overlapping the period.
4. The Doctor has no Blocked Time overlapping the period.
5. The requested Appointment Type is supported by the Doctor.
6. The Patient does not already have an overlapping Confirmed Appointment.
7. The Patient does not already have an overlapping active Temporary Hold.

---

# 21. Temporary Slot Hold

## FR08 – Create Temporary Hold

When a Patient selects an available slot, the system temporarily reserves it.

Temporary Hold duration:

**5 minutes**

Example:

```text
Doctor: Dr. Ahmed
Appointment Type: General Consultation
Date: October 5
Time: 10:00 AM

Hold Expires:
10:05 AM
```

A Temporary Hold is not an Appointment Status.

It is a separate temporary scheduling record.

---

# 22. Temporary Hold Rules

An active Temporary Hold must prevent:

- Other Patients from holding the same Doctor period
- Other Patients from booking the same Doctor period
- The same Patient from creating an overlapping booking

When the hold expires:

```text
Held
↓
Expired
↓
Slot Available Again
```

Expired holds must not affect future availability.

---

# 23. Temporary Hold Expiration

The system must consider a Hold expired when:

```text
Current Time >= Hold Expiration Time
```

Expired holds do not need to remain active.

The implementation may remove expired records or mark them expired.

The business result must remain the same:

> Expired holds no longer block availability.

---

# 24. Appointment Booking

## FR09 – Confirm Appointment

A Patient can confirm an active Temporary Hold.

Appointment information contains:

- ID
- Patient
- Doctor
- Specialty
- Appointment Type
- Start Date and Time
- End Date and Time
- Status
- Created At
- Updated At

### Acceptance Criteria

- Hold must exist.
- Hold must belong to the Patient.
- Hold must not be expired.
- Slot must still satisfy booking integrity rules.
- Appointment Type must remain valid for the Doctor.
- Successful confirmation creates one Confirmed Appointment.
- Temporary Hold must no longer remain active afterward.

---

# 25. Appointment Statuses

Version 1 uses only:

```text
Confirmed
Completed
Cancelled
No-show
```

There is no:

```text
Pending
```

status.

Temporary Hold is handled separately.

---

# 26. Appointment Status Rules

Standard outcomes:

```text
Confirmed → Completed
```

or:

```text
Confirmed → Cancelled
```

or:

```text
Confirmed → No-show
```

Completed, Cancelled, and No-show are terminal appointment states in Version 1.

---

# 27. Double Booking Prevention

## BR01 – Doctor Double Booking Is Prohibited

A Doctor cannot have two Confirmed Appointments whose time ranges overlap.

Example:

Existing:

```text
10:00 – 10:30
```

Invalid booking:

```text
10:15 – 10:45
```

This must be rejected.

---

# 28. Patient Double Booking Prevention

## BR02 – Patient Double Booking Is Prohibited

A Patient cannot have overlapping appointments even if the appointments are with different Doctors.

Example:

Patient already has:

```text
Dr. Ahmed
10:00 – 10:30
```

The same Patient cannot book:

```text
Dr. Sara
10:15 – 10:45
```

---

# 29. Concurrency Protection

The application must handle situations where multiple Patients attempt to book the same slot simultaneously.

Example:

```text
Patient A ──┐
            ├── Dr. Ahmed — 10:00
Patient B ──┘
```

Only one booking may succeed.

The other request must fail cleanly.

Example response:

```text
This appointment is no longer available.
```

The frontend must not be the only protection.

The Backend and PostgreSQL database must enforce booking integrity.

---

# 30. Database Booking Integrity

Appointment confirmation must occur using a safe database operation.

The system must protect against race conditions.

A race condition occurs when two requests attempt to modify the same scheduling state almost simultaneously.

The system must guarantee:

```text
One Doctor
+
One overlapping time period
=
Maximum one valid booking
```

The same principle applies to overlapping Patient appointments.

The exact database strategy may use:

- Transactions
- Database locking
- Constraints
- Conflict detection

The implementation must guarantee the business rule regardless of strategy.

---

# 31. Booking Conflict Response

When booking fails because another Patient obtained the slot first:

Recommended HTTP response:

```text
409 Conflict
```

Recommended user-facing message:

```text
This appointment is no longer available.
Please select another time.
```

The frontend must refresh availability after such a conflict.

---

# 32. Cancellation

## FR10 – Cancel Appointment

Patients may cancel their own future Confirmed Appointments.

Admin may cancel any future Confirmed Appointment when required.

### Cancellation Rules

Patient cancellation is allowed while:

```text
Current Time < Appointment Start Time
```

No cancellation penalties are included.

No financial rules are included.

### Acceptance Criteria

- Patient must own the Appointment.
- Appointment must be Confirmed.
- Appointment must not have started.
- Cancelled Appointment becomes read-only.
- Cancelled time becomes available again unless blocked by another rule.
- Cancellation requires Confirmation Dialog.

---

# 33. Rescheduling

## FR11 – Reschedule Appointment

A Patient may reschedule a future Confirmed Appointment.

Rescheduling must not immediately remove the original appointment.

The process is:

```text
Existing Appointment
        ↓
Select New Slot
        ↓
Create Temporary Hold on New Slot
        ↓
Confirm Reschedule
        ↓
New Appointment Time Confirmed
        ↓
Old Slot Released
```

---

# 34. Rescheduling Safety Rule

The existing appointment remains valid until the new slot is successfully secured.

This prevents the Patient from losing the original appointment if the new slot becomes unavailable.

Example:

```text
Current:
Oct 5 — 10:00

Requested:
Oct 6 — 11:00
```

If `Oct 6 — 11:00` becomes unavailable before confirmation:

```text
Reschedule fails
Original Oct 5 — 10:00 appointment remains unchanged
```

---

# 35. Doctor Calendar

## FR12 – Calendar View

Doctors can view their appointments using a Calendar.

Required views:

- Day View
- Week View

The Calendar should display:

- Appointment Time
- Patient Name
- Appointment Type
- Appointment Status

The Calendar is primarily a visual representation.

Scheduling logic remains in the Backend.

---

# 36. Calendar Library

The frontend may use:

**FullCalendar**

to display calendar views.

FullCalendar is responsible for UI rendering such as:

- Days
- Time grid
- Week View
- Day View
- Appointment event blocks

FullCalendar must not be responsible for:

- Double booking prevention
- Slot availability logic
- Temporary Hold rules
- Authentication
- Authorization
- Rescheduling integrity

These remain application Backend responsibilities.

---

# 37. Doctor Appointment Actions

Doctors may update their own Confirmed Appointments to:

```text
Completed
```

or:

```text
No-show
```

Doctors cannot modify appointments belonging to another Doctor.

---

# 38. Patient Appointment Views

Patient Dashboard must provide:

### Upcoming Appointments

Future Confirmed Appointments.

### Past Appointments

Appointments with statuses:

```text
Completed
Cancelled
No-show
```

or appointments whose appointment time has passed where appropriate.

---

# 39. Doctor Dashboard

Doctor Dashboard should display:

- Today's Appointments
- Upcoming Appointments
- Completed Today
- No-shows Today

The Dashboard should remain operational and simple.

Large analytics sections are not required.

---

# 40. Admin Dashboard

Admin Dashboard may display:

- Today's Appointments
- Total Active Doctors
- Total Patients
- Appointments by Status

The Dashboard is not a Reports Module.

No exporting functionality is included.

---

# 41. Search and Filtering

Patients should be able to search or filter Doctors by:

- Doctor Name
- Specialty

Appointment screens may filter by:

- Doctor
- Date
- Appointment Status
- Appointment Type

Admin lists may include appropriate search and filtering.

---

# 42. Main Application Pages

The frontend should include at least:

```text
/login
/register

/doctors
/doctors/:id
/book

/my-appointments
/my-appointments/:id

/doctor/dashboard
/doctor/calendar
/doctor/availability

/admin/dashboard
/admin/doctors
/admin/specialties
/admin/appointment-types
/admin/appointments

/profile
```

Exact route naming may vary during implementation.

---

# 43. Patient Booking Flow

Recommended flow:

```text
Browse Doctors
      ↓
Select Doctor
      ↓
Select Appointment Type
      ↓
Select Date
      ↓
View Available Slots
      ↓
Select Slot
      ↓
5-Minute Temporary Hold
      ↓
Confirm Booking
      ↓
Confirmed Appointment
```

---

# 44. Appointment Booking UI

The booking interface should clearly show:

- Doctor
- Specialty
- Appointment Type
- Duration
- Date
- Available Times

Unavailable times must not appear as selectable.

When a Temporary Hold is created, the interface should clearly communicate the remaining hold time.

Example:

```text
This appointment time is reserved for you for 04:32.
```

---

# 45. Hold Expiration UX

If the Temporary Hold expires before booking confirmation:

The user must see a clear message:

```text
Your reservation time expired.
Please select an available appointment again.
```

The application must refresh the available slot list.

---

# 46. Loading States

Screens that load data must display loading feedback.

Examples:

```text
Loading doctors...
```

```text
Checking availability...
```

Preferred UI may use Skeleton Loaders where appropriate.

---

# 47. Empty States

Examples:

```text
No appointments available on this date.
```

```text
You have no upcoming appointments.
```

```text
No doctors found for this specialty.
```

Empty states must provide useful context rather than blank pages.

---

# 48. Error States

Examples:

### Booking Conflict

```text
This appointment is no longer available.
```

### Authorization

```text
You do not have permission to access this page.
```

### API Failure

```text
Unable to load appointments.
Please try again.
```

### Not Found

```text
The requested appointment could not be found.
```

---

# 49. Confirmation Dialogs

Confirmation Dialogs are required for actions such as:

- Cancel Appointment
- Reschedule Appointment Confirmation
- Deactivate Doctor
- Remove Blocked Time when appropriate

Example:

```text
Are you sure you want to cancel this appointment?

Keep Appointment | Cancel Appointment
```

---

# 50. Toast Feedback

Successful actions should provide short feedback.

Examples:

```text
Appointment booked successfully.
```

```text
Appointment cancelled.
```

```text
Appointment rescheduled successfully.
```

```text
Availability updated.
```

---

# 51. Responsive Design

The application must support:

- Desktop
- Tablet
- Mobile

Desktop may remain the primary Doctor/Admin experience.

Patient booking must work comfortably on mobile screens.

---

# 52. Main Data Entities

The system will include the following primary entities:

```text
User
PatientProfile
DoctorProfile
Specialty
AppointmentType
DoctorAppointmentType
DoctorAvailability
BlockedTime
TemporaryHold
Appointment
```

The technical implementation may introduce supporting entities where necessary.

---

# 53. User Entity

Suggested data:

```text
id
name
email
password_hash
role
is_active
created_at
updated_at
```

---

# 54. Doctor Profile

Suggested data:

```text
id
user_id
specialty_id
created_at
updated_at
```

---

# 55. Appointment Type

Suggested data:

```text
id
name
duration_minutes
is_active
created_at
updated_at
```

---

# 56. Doctor Appointment Type

Defines which Appointment Types a Doctor provides.

Suggested data:

```text
doctor_id
appointment_type_id
```

---

# 57. Doctor Availability

Suggested data:

```text
id
doctor_id
day_of_week
start_time
end_time
```

---

# 58. Blocked Time

Suggested data:

```text
id
doctor_id
start_at
end_at
reason
created_at
```

---

# 59. Temporary Hold

Suggested data:

```text
id
patient_id
doctor_id
appointment_type_id
start_at
end_at
expires_at
created_at
```

Temporary Holds are temporary booking-control records.

They are not Appointments.

---

# 60. Appointment

Suggested data:

```text
id
patient_id
doctor_id
appointment_type_id
start_at
end_at
status
created_at
updated_at
cancelled_at
completed_at
```

---

# 61. Date and Time Rules

Appointments contain:

- Start Date and Time
- End Date and Time

The system uses a single Clinic Timezone.

Technical timestamps must be stored consistently in PostgreSQL.

Recommended standard:

**UTC**

The frontend displays appointment times using the configured Clinic Timezone.

---

# 62. Clinic Timezone

Version 1 supports one Clinic Timezone.

The system does not maintain separate Patient or Doctor timezone preferences.

Example:

```text
Clinic Timezone:
Asia/Riyadh
```

The exact timezone should be configurable.

---

# 63. Approved Technical Stack

## Frontend

```text
React
TypeScript
Vite
React Router
Tailwind CSS
FullCalendar
```

Icons are not a required dependency.

---

# 64. Backend

```text
Node.js
NestJS
TypeScript
```

NestJS is responsible for:

- REST API
- Business Logic
- Authentication
- Authorization
- Scheduling rules
- Availability logic
- Temporary Holds
- Appointment booking
- Conflict detection
- Database operations

---

# 65. Database

```text
PostgreSQL
```

PostgreSQL is responsible for persistent data storage and forms the final protection layer for scheduling integrity.

---

# 66. ORM

```text
Prisma
```

Prisma is used between NestJS and PostgreSQL for:

- Data access
- Database models
- Queries
- Database migrations

---

# 67. Authentication Technology

Authentication uses:

```text
Email
Password
JWT
Argon2
```

Refresh Tokens are not required in Version 1.

---

# 68. Testing

Backend testing uses:

```text
Jest
Supertest
```

Jest is the test framework.

Supertest is used to send HTTP requests to the NestJS API during automated tests.

---

# 69. Package Management

The project uses:

```text
npm
```

npm manages JavaScript and TypeScript dependencies.

Examples include:

- React
- NestJS
- Prisma
- FullCalendar
- Jest
- Supertest

---

# 70. Version Control

The project uses:

```text
Git
GitHub
```

Git maintains:

- Change history
- Commits
- Code versions
- Ability to compare changes
- Ability to revert changes

GitHub hosts the repository publicly or privately.

VS Code Source Control may be used instead of manually typing Git commands.

---

# 71. System Architecture

```text
React + TypeScript + Vite
            │
            │ HTTP / JSON
            ↓
     NestJS REST API
            │
            ↓
          Prisma
            │
            ↓
       PostgreSQL
```

FullCalendar operates inside the React frontend as a Calendar UI component.

---

# 72. Backend Modules

Recommended logical modules:

```text
auth
users
patients
doctors
specialties
appointment-types
availability
blocked-times
holds
appointments
```

This describes logical code separation.

Microservices are not required.

---

# 73. Frontend Structure

Recommended logical separation:

```text
pages
components
api
auth
hooks
types
utils
features
```

Reusable components should be used where appropriate.

---

# 74. Security Requirements

The application must:

- Hash passwords using Argon2
- Authenticate protected requests
- Enforce role permissions in Backend
- Validate API input
- Prevent unauthorized appointment access
- Prevent Patients from modifying other Patients' appointments
- Prevent Doctors from modifying other Doctors' schedules
- Protect database credentials
- Keep secrets outside source code

---

# 75. Input Validation

Examples:

```text
Name:
Required

Email:
Valid email format

Password:
Minimum 8 characters

Appointment Type Duration:
Greater than 0

Availability Start:
Must be before Availability End

Blocked Time Start:
Must be before Blocked Time End
```

Whitespace-only required values are invalid.

---

# 76. API Error Handling

API errors must be clear and consistent.

Examples:

```json
{
  "message": "Appointment not found"
}
```

```json
{
  "message": "This appointment is no longer available"
}
```

The API must not expose:

- Stack traces
- Passwords
- JWT secrets
- Database credentials
- Sensitive configuration

---

# 77. Required Automated Tests

## Authentication

- Patient Registration
- Duplicate Email Rejected
- Valid Login
- Invalid Login
- Disabled User Cannot Login
- Protected Route Rejects Missing Token

## Authorization

- Patient Cannot Create Doctor
- Patient Cannot Access Other Patient Appointment
- Doctor Cannot Modify Another Doctor Availability
- Patient Cannot Mark Appointment Completed

## Appointment Types

- Valid Appointment Type Creation
- Invalid Duration Rejected
- Inactive Appointment Type Cannot Be Booked

## Availability

- Generate Slots Inside Working Hours
- Do Not Generate Slots Outside Working Hours
- Appointment Duration Fits Entirely Inside Availability
- Blocked Time Removes Availability

## Temporary Holds

- Create Hold for Available Slot
- Hold Blocks Other Patient
- Expired Hold No Longer Blocks Slot
- Patient Cannot Confirm Another Patient's Hold
- Expired Hold Cannot Be Confirmed

## Double Booking

- Two Patients Cannot Book Same Doctor at Same Time
- Overlapping Doctor Appointments Rejected
- Patient Cannot Book Overlapping Appointments with Different Doctors

## Booking Concurrency

A concurrency test must verify that simultaneous booking attempts for the same slot cannot produce two Confirmed Appointments.

## Cancellation

- Patient Can Cancel Own Future Appointment
- Patient Cannot Cancel Another Patient's Appointment
- Patient Cannot Cancel Appointment After Start Time
- Cancelled Slot Becomes Available Again

## Rescheduling

- New Slot Must Be Available
- New Slot Must Be Held Before Rescheduling
- Failed Reschedule Preserves Original Appointment
- Successful Reschedule Releases Old Time
- Double Booking Rules Still Apply

## Doctor Actions

- Doctor Can Mark Own Appointment Completed
- Doctor Can Mark Own Appointment No-show
- Doctor Cannot Update Another Doctor's Appointment

---

# 78. Main Booking Integrity Rules

The following rules are mandatory:

1. Doctor double booking is prohibited.
2. Patient double booking is prohibited.
3. Temporary Holds last 5 minutes.
4. Active Holds block overlapping bookings.
5. Expired Holds do not block availability.
6. Appointment Type determines appointment duration.
7. Appointment must fit completely inside Doctor Availability.
8. Blocked Time removes availability.
9. Only Appointment Types assigned to a Doctor can be booked with that Doctor.
10. Rescheduling must secure the new slot before releasing the old appointment.
11. Frontend checks are not sufficient for booking integrity.
12. Backend and database must enforce scheduling rules.

---

# 79. Development Phases

## Phase 1 – Project Setup

- Git Repository
- React + TypeScript frontend
- NestJS backend
- PostgreSQL
- Prisma
- Environment configuration

## Phase 2 – Authentication and Users

- User Model
- Patient Registration
- Login
- JWT
- Argon2
- Role Permissions
- Admin Account Setup

## Phase 3 – Doctors and Specialties

- Doctor Profiles
- Specialty Management
- Doctor Management

## Phase 4 – Appointment Types

- Appointment Types
- Duration Rules
- Doctor Appointment Type Assignment
- Seed Initial Appointment Types

## Phase 5 – Availability

- Weekly Availability
- Doctor Schedule Management
- Blocked Time
- Availability Calculation

## Phase 6 – Temporary Holds

- Hold Creation
- 5-Minute Expiration
- Conflict Detection
- Availability Integration

## Phase 7 – Appointment Booking

- Appointment Confirmation
- Double Booking Protection
- Patient Conflict Protection
- Concurrency Handling

## Phase 8 – Appointment Management

- Upcoming Appointments
- Past Appointments
- Cancellation
- Rescheduling
- Completed
- No-show

## Phase 9 – Calendar

- FullCalendar Integration
- Doctor Day View
- Doctor Week View

## Phase 10 – UI Completion

- Responsive Design
- Loading States
- Empty States
- Error States
- Confirmation Dialogs
- Toast Feedback

## Phase 11 – Testing

- Authentication Tests
- Authorization Tests
- Scheduling Tests
- Hold Tests
- Double Booking Tests
- Concurrency Tests
- Rescheduling Tests

## Phase 12 – Documentation

- README
- Setup Instructions
- Architecture Overview
- Database ERD
- Screenshots
- API Documentation

---

# 80. GitHub README Requirements

The final README should contain:

1. Project Title
2. Project Overview
3. Core Features
4. Technology Stack
5. Architecture
6. Database ERD
7. User Roles
8. Booking Workflow
9. Temporary Hold Explanation
10. Double Booking Protection
11. Installation Instructions
12. Environment Variables
13. Database Setup
14. Backend Startup Instructions
15. Frontend Startup Instructions
16. Testing Instructions
17. Screenshots
18. Project Structure
19. Future Improvements

---

# 81. Recommended Screenshots

The README should ideally include:

- Login
- Patient Registration
- Doctor Search
- Doctor Details
- Available Appointment Slots
- Booking Hold Screen
- Patient Appointments
- Doctor Dashboard
- Doctor Calendar
- Availability Management
- Admin Doctor Management
- Appointment Type Management

---

# 82. Project Deliverables

The completed project should include:

- React TypeScript Frontend
- NestJS TypeScript Backend
- PostgreSQL Integration
- Prisma Models
- Prisma Migrations
- Authentication
- Role-Based Authorization
- Patient Registration
- Doctor Management
- Specialties
- Appointment Types
- Doctor Appointment Type Assignment
- Doctor Availability
- Blocked Time
- Dynamic Slot Generation
- 5-Minute Temporary Holds
- Appointment Booking
- Doctor Double Booking Protection
- Patient Double Booking Protection
- Concurrency Protection
- Cancellation
- Safe Rescheduling
- Doctor Day Calendar
- Doctor Week Calendar
- Responsive UI
- Automated Tests
- README
- Database ERD
- API Documentation

---

# 83. Final Acceptance Criteria

Version 1 is complete when:

1. Patients can register successfully.
2. Users can login securely.
3. Admin can create Doctor accounts.
4. Admin can manage Specialties.
5. Admin can manage Appointment Types.
6. Appointment Types support configurable durations.
7. Initial General Consultation and Follow-up types exist.
8. Doctors can be assigned selected Appointment Types.
9. Doctor weekly Availability works correctly.
10. Doctors can create Blocked Time.
11. Available slots are generated correctly.
12. Appointment duration is respected during slot generation.
13. Confirmed appointments remove conflicting availability.
14. Blocked Time removes conflicting availability.
15. Temporary Holds last 5 minutes.
16. Active Holds block conflicting bookings.
17. Expired Holds release availability.
18. Patients can confirm active Holds.
19. Expired Holds cannot be confirmed.
20. Doctor double booking is prevented.
21. Patient double booking is prevented.
22. Simultaneous booking attempts cannot produce duplicate appointments.
23. Booking conflicts return a clear response.
24. Confirmed Appointments are created correctly.
25. No Pending Appointment Status exists.
26. Patients can view upcoming appointments.
27. Patients can view appointment history.
28. Patients can cancel future appointments.
29. Cancelled appointment time becomes available again.
30. Patients can reschedule future appointments.
31. Rescheduling secures the new slot before releasing the old one.
32. Failed rescheduling preserves the original appointment.
33. Doctors can view their schedule.
34. Doctor Day Calendar works.
35. Doctor Week Calendar works.
36. Doctors can mark appointments Completed.
37. Doctors can mark appointments No-show.
38. Unauthorized appointment access is prevented.
39. Responsive layout works on Desktop.
40. Responsive layout works on Tablet.
41. Responsive layout works on Mobile.
42. Loading states exist.
43. Empty states exist.
44. Error states exist.
45. Confirmation dialogs exist.
46. Core automated tests pass.
47. Concurrency booking tests pass.
48. Frontend and Backend integrate successfully.
49. Database migrations work correctly.
50. README provides sufficient setup instructions.
51. The project can be run on a new development machine by following the documentation.
52. No known Critical booking-integrity defects remain.

---

# 84. Definition of Project Success

The Clinic Appointment Booking System is considered successful when it provides a reliable appointment scheduling experience with correct availability and strong protection against booking conflicts.

The project should demonstrate:

- Full-Stack Development
- React with TypeScript
- NestJS Backend Development
- PostgreSQL Database Design
- Prisma ORM
- Authentication
- Role-Based Authorization
- Time-Based Business Logic
- Dynamic Availability Calculation
- Temporary Reservation Holds
- Database Transactions
- Concurrency Handling
- Double Booking Prevention
- Safe Rescheduling
- Calendar Integration
- Automated Testing

The goal is not to build a complete Hospital Management System.

The goal is to build a focused and technically strong appointment scheduling system whose main value comes from correct scheduling behavior, booking integrity, and concurrency-safe reservation logic.