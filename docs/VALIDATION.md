# Validation record

Verified locally on September 28–29, 2026, on Windows with Node.js 24.19.0, PostgreSQL 18.6, Prisma 6.19.0, and Vite 7.3.6.

## Build and database

| Check                                                                     | Result |
| ------------------------------------------------------------------------- | ------ |
| API TypeScript production compilation                                     | Passed |
| Frontend TypeScript compilation and Vite production build                 | Passed |
| Prisma schema validation                                                  | Passed |
| Initial schema and integrity migrations on application and test databases | Passed |
| Final immutable-history migration on both databases                       | Passed |
| Seed administrator, initial types, specialties, and optional demo data    | Passed |
| API database-backed `/api/health`                                         | Passed |
| Workspace-local restart helper with services already running              | Passed |

Frontend output uses a separate lazy-loaded calendar bundle. The final build completed without the previous large-chunk warning: main JavaScript approximately 390 KB / 121 KB gzip; calendar approximately 224 KB / 67 KB gzip.

## Automated tests: 55 passed

`npm test`: **6 passed** (slot-generation unit tests).

`npm run test:integration`: **49 passed**, using Supertest through the NestJS HTTP application and a dedicated real PostgreSQL database. No in-memory scheduling substitute is used.

Covered cases include:

- Patient registration, duplicate emails, role injection, whitespace validation, valid/invalid login, disabled accounts, missing tokens, and logout revocation.
- Admin doctor/type creation, invalid duration, inactive/unassigned types, scoped access, doctor ownership, and forbidden patient outcome changes.
- Working windows, full-duration fitting, off-grid starts, blocked time, five-minute holds, expiry, ownership, release, and confirmation revalidation.
- Doctor overlaps, patient overlaps across doctors, active hold conflicts, adjacent periods, and direct database protection.
- Simultaneous attempts for one slot yield exactly one successful hold and one confirmed appointment; simultaneous confirmation retries return the same booking.
- Future cancellation and released availability; forbidden ownership and past cancellation.
- Bound replacement holds, successful rescheduling, expiry/occupied-slot failures, original-slot retention, and a forced insertion failure after cancellation inside the transaction. The forced failure verifies both the original appointment and new hold roll back intact.
- Conflicting availability edits and blocked periods, doctor completion/no-show, future-outcome rejection, and immutable terminal history.
- Timezone conversion and DST slot generation.

These are correctness checks for a single clinic, not a sustained-load benchmark or an independent security audit.

## Browser verification

Verified through the local application's actual UI:

- Patient sign-in, doctor directory, date selection, available times, five-minute reservation countdown, and confirmed booking.
- Mobile reschedule confirmation and successful replacement; cancellation dialog and final cancelled status.
- Doctor dashboard, week calendar, day calendar, working-hours save, blocked-time creation, and removal with confirmation. The temporary test block was removed.
- Admin dashboard, doctor list/edit/save, supported appointment type assignments, appointment type listing, and registration screen rendering.
- The admin replacement-history label no longer links to the patient-only route.
- Desktop (1440×1000), tablet (820×1180), and mobile (390×844) layouts. Tablet directory had no horizontal document overflow. Mobile appointment and reservation dialogs remained usable.
- No browser console errors were reported in the final checked session.

Screenshots are saved in `docs/screenshots/`. Fictional sample data and cancelled browser-test appointment history remain in the local demo. Temporary holds expire normally.

## Delivery boundaries

The application runs locally and the source is initialized as a Git repository. No remote GitHub repository, public deployment, external notifications, or live patient data has been created. The archive excludes `.env`, database files, installed dependencies, build output, and Git internals. A fresh machine must provide Node/npm/PostgreSQL and follow `README.md`.

Operational choices not specified by the BRD are documented in the README: booking horizon, active-hold cap, non-overlapping reschedules, outcome timing, split working windows, and DST behavior.
