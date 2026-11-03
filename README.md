# MedLog Backend

Express + TypeScript + MongoDB API for the MedLog clinical mobile app.

## Setup

```bash
cp .env.example .env
npm install
# optional local Mongo via repo root: docker compose up -d
npm run seed
npm run dev
```

Server: `http://localhost:4000`  
Health: `GET /api/v1/health`

### Seed users
| Email | Password | Role |
| --- | --- | --- |
| admin@medlog.app | Admin123! | admin |
| clinician@medlog.app | Clinician123! | clinician |

Verification codes are 4 digits. With `OTP_MODE=fixed` (the default, for testing) and in development, the code is the first 4 digits of `DEFAULT_OTP`, it isn't emailed, and the API returns it as `otpHint` so the app shows it. With `OTP_MODE=email` in production, codes are random and emailed (see `EMAIL_*`/`SMTP_*` in `.env.example`).

## Scripts
- `npm run dev` — watch mode
- `npm run build` / `npm start` — production
- `npm test` — Jest + mongodb-memory-server
- `npm run seed` — seed admin/clinician + specialties/protocols
- `npm run lint` — `tsc --noEmit`

## Modules
Auth, users, patients, admissions (+ discharge), clinical-parameters, medications (Hospital Medication), antibiotics (Previous Antibiotics), protocols, specialties, transfers, dashboard, AI extract stub (`POST /api/v1/ai/extract`).

See `../docs/api-documentation.md` for endpoint details.

## Deploy (Render free + MongoDB Atlas free)

The repo root contains `render.yaml`, a Render Blueprint for this backend.

1. **MongoDB Atlas:** create a free M0 cluster (Frankfurt to match `render.yaml`), add a database user, and allow network access from `0.0.0.0/0` (Render's free tier has no fixed outbound IPs). Copy the connection string and add the database name, e.g. `.../medlog?retryWrites=true&w=majority`.
2. **Email:** Render's free plan blocks SMTP ports, so Gmail SMTP (`SMTP_*`) only works locally or on a paid instance. On the free plan use Brevo (free, no domain needed): verify a sender email under *Senders* and create an API key under *SMTP & API → API Keys*. With Resend you need your own verified domain to email other people.
3. **Render:** push the repo to GitHub, then *New → Blueprint*, pick the repo, and fill in the prompted values: `MONGODB_URI`, `EMAIL_PROVIDER` (`brevo`), `EMAIL_API_KEY`, `EMAIL_FROM`. Leave `PUBLIC_API_URL` and the Stripe keys empty for the first deploy.
4. After the first deploy, set `PUBLIC_API_URL` to the service URL (e.g. `https://medlog-api.onrender.com`) and redeploy.
5. Seed the Atlas database once from your machine: `$env:MONGODB_URI="<atlas uri>"; npm run seed` (PowerShell).
6. Point the app at the API: set `extra.apiUrl` in `mobile/app.json` to `https://<service>.onrender.com/api/v1`.

Free-tier limits: the service sleeps after ~15 minutes idle (the first request then takes ~1 minute), and the disk is wiped on every restart or deploy, so uploaded Protocol and References PDFs are lost.
