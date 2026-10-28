# CareCircle MindTogether

Appointments and online consultations. Import this repository into Vercel to run a production test.

## Deploy

1. In Vercel, import `classbridge2026/CareCircle-MindTogether`. Leave the framework as Next.js. The build command is `npm run build`. That generates the Prisma client, applies database migrations, then builds the app.
2. Add the Production environment variables below, then redeploy. The build needs a reachable database, so set the variables before the first successful deployment.
3. Open the deployed site and register as a patient. Sign-in email only works after the SMTP variables are set.

Use a database that does not already hold real patient records. Anyone with the site address can create an account.

## Environment variables

Copy the names from `.env.example`. Set real values in Vercel only.

| Name | Required for |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres URL. On Neon the host includes `-pooler`, with `sslmode=require` and `pgbouncer=true`. |
| `DIRECT_URL` | Direct Postgres URL, without the pooler. Migrations use this. |
| `APP_BASE_URL` | Public site origin, such as `https://your-project.vercel.app`, with no trailing slash. |
| `VERIFICATION_PEPPER` | Long random string. Production refuses to start account verification without it. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Account email. Use `smtp.gmail.com`, port `465`, and a Google App Password. `EMAIL_FROM` must use the same Gmail address. Mark `SMTP_PASS` sensitive. |
| `CRON_SECRET` | Lets Vercel Cron run the appointment clock. Mark it sensitive. |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Video and voice visits. `LIVEKIT_URL` must start with `wss://`. Mark the secret sensitive. |

Clinical file uploads need the S3 settings in `.env.example`. Vercel does not keep files written to local disk.

`vercel.json` runs the appointment clock once a day at 08:00 UTC so a Hobby project can deploy. On Vercel Pro, change that schedule to `0 * * * *` so day-before and hour-before reminders are not missed.

## Administrator account

The administrator password is not in this repository. If the production database is new, create the account once from your machine:

```bash
SEED_ADMIN_EMAIL="you@example.com" SEED_ADMIN_PASSWORD="choose-a-private-password" npm run db:seed
```

Point `DATABASE_URL` and `DIRECT_URL` at the production database for that command. Re-running the seed changes that account's password.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the same variables. Local development can omit `VERIFICATION_PEPPER`.
