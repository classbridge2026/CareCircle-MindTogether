# Notifications setup

CareCircle MindTogether keeps an in-app notice for each person and, when configured, sends email through the existing Gmail SMTP path. Text messages are not sent. A sent email status means Gmail accepted the message. It does not mean the mailbox confirmed delivery.

## Environment variables

Email, read by the existing Nodemailer adapter:

- `SMTP_HOST` must be `smtp.gmail.com`
- `SMTP_PORT` must be `465`
- `SMTP_USER`
- `SMTP_PASS` is a Google App Password
- `EMAIL_FROM`
- `APP_BASE_URL` is the public origin used in links, with no trailing slash

Scheduler:

- `CRON_SECRET` authorizes `GET` or `POST /api/jobs/appointment-clock`

Do not commit real values. Do not prefix these names with `NEXT_PUBLIC_`.

## Gmail

Set every SMTP variable, then run `node scripts/send-test-email.mjs recipient@example.com` outside production. If a variable is missing, appointment email is recorded as `not_configured` and is not retried. The in-app notice remains.

Gmail accepting a message is recorded as sent. A later bounce is not tracked.

## Scheduler

`/api/jobs/appointment-clock` expires overdue unpaid holds, sends the day-before and hour-before reminders, and retries eligible temporary delivery failures. Call it at least once an hour with `Authorization: Bearer <CRON_SECRET>`.

Vercel Cron is declared in `vercel.json` as an hourly job. Vercel sends the bearer token when `CRON_SECRET` is set on the project.

Africa/Freetown does not observe daylight saving time. Appointment times are stored as timestamps and shown in that zone. Reminder windows are 22–26 hours and 15–90 minutes so an hourly run still catches each visit once.

`npm run db:expire-holds` only expires holds. It does not send reminders.

## Status meanings

- `QUEUED` means a retry has claimed the row and has not finished.
- `SENT` means the in-app row was stored, or Gmail accepted the email.
- `FAILED` means the provider rejected the message, or the channel is not configured (`errorCode` `not_configured`).
- `SUPPRESSED` means the person turned off that optional reminder channel.
- `CANCELLED` is reserved for a withdrawn reminder.
- `READ` is the older in-app read marker. New reads use `readAt` and leave a failed delivery as failed.

There is no delivered state. Gmail acceptance does not confirm that the mailbox received the message.

## Retry policy

Temporary `provider_failed` attempts are retried up to 3 times, about 5 minutes, then 15 minutes, then 45 minutes, plus up to 30 seconds of jitter. `not_configured`, `invalid_destination`, and `suppressed` are not retried.

Password reset and email verification are not retried from this queue. The person requests a new message. Those flows still do not reveal whether an account exists.

An administrator can retry an eligible failed email from `/admin/notifications`. The action is audited as `notification.retry` and does not copy the message body into the audit log.

## Preferences

Patients can turn email appointment reminders on or off under Profile, Account settings. In-app reminders remain. Verification and password recovery emails cannot be disabled.

## Migration

`prisma/migrations/20261024230000_notification_delivery/migration.sql` adds delivery columns, attempt rows, and reminder preferences. It has not been applied to Neon. Do not run `npm run db:migrate` until that is explicitly approved.

Until it is applied, new tracking fields fall back to the older notification row when the database reports a missing column. Attempt history, suppression, and admin retry then stay unavailable.

## Manual checks

1. Book, move, and cancel a visit. Confirm an in-app notice for the patient and the doctor. With SMTP set, confirm Gmail accepted the mail. Confirm no text was sent.
2. Call the appointment clock twice in the same hour. Confirm the reminder is not sent twice.
3. Cancel a visit that is inside a reminder window, then run the clock. Confirm no reminder is sent.
4. Request a password reset for an unknown address and a known address. Confirm the response does not say which one exists.
5. Approve or reject a doctor. Confirm the doctor gets a profile decision without the free-text review note.
6. Open `/admin/notifications` as an administrator. Confirm provider secrets are absent and failed rows show only an error code.
7. Inspect server logs after a failed email. Confirm they contain `smtp_send_failed` and not the password or message body.
