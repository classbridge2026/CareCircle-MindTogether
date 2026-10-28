# Verification

Ordinary checks do not need production secrets and do not connect to a database.

```bash
npm ci
npx prisma generate
npx prisma validate
npm run typecheck
npm run lint
npm test
npm audit --omit=dev --audit-level=critical
npm audit --audit-level=high
```

The production audit is the release gate. The full audit currently exits with known high and critical findings in the Prisma CLI and in Vitest, Happy DOM, and Tinypool. Those fixes require major upgrades and were not applied.

`npm test` runs Vitest. It does not include `src/**/*.integration.test.ts`.

## Isolated PostgreSQL

Integration tests refuse any database that is not on localhost or whose name does not contain `test`. Do not point them at Neon or a shared development database.

```bash
docker run --name carecircle-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=carecircle_test -p 54329:5432 -d postgres:16
```

Set these only in the shell for the commands below. Do not write them into `.env`.

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/carecircle_test
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/carecircle_test
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/carecircle_test
```

Then:

```bash
npx prisma migrate deploy
npm run test:integration
```

Clear `SMTP_HOST` and `SMTP_PASS` before the integration run so appointment notices are stored and not emailed. The integration file also clears those variables for its own process.

The integration suite uses real PostgreSQL transactions. It checks the appointment exclusion constraint with two overlapping inserts at the same time, expired-hold release, payment confirmation, clinical summary access, and audit immutability. It does not call a payment provider, send SMS or WhatsApp, or open a LiveKit room.

GitHub Actions workflow `.github/workflows/verify.yml` runs the unit job on every push and pull request, and runs the integration job against a Postgres 16 service.

## Not part of the automated suite

No payment provider is integrated, so webhook delivery from a live provider is not executed. Signature checks in unit tests use a local HMAC secret. Browser end-to-end tests are not installed. Appointment booking in the application confirms the catalog price without a payment hold because capture is not available.
