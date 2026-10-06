# Prepared local demo

Open **http://127.0.0.1:5173** while the local processes are running.

| Role    | Email                 | Password              |
| ------- | --------------------- | --------------------- |
| Patient | `patient@clinic.test` | `ClearwellDemo!2026`  |
| Doctor  | `ahmed@clinic.test`   | `ClearwellDemo!2026`  |
| Admin   | `admin@clinic.test`   | `ClearwellAdmin!2026` |

These are fictional demo accounts, not production credentials. The configured local database is bound to loopback at port 55432; the API is on port 3001. The database files live in this chat's `work/postgres` directory, outside the source project. They are not included in the source archive.

The generated `apps/api/.env` contains a random JWT secret and local connection settings. It is ignored by Git and excluded from the source archive. On another machine, follow the README and create your own environment file.

For restarting this particular prepared environment, run this project's `Start-Local.ps1` from PowerShell. For a standard setup on another machine, use `npm run dev` after following the README.
