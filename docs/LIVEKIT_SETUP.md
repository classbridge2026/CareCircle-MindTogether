# LiveKit consultations

CareCircle MindTogether uses LiveKit for online audio and video. In-person appointments never open a LiveKit room.

This feature does not add a database migration. Appointment status remains the booking record. `Encounter.startedAt` and `Encounter.endedAt` record the clinical interval when a doctor starts and completes a visit. The LiveKit room name is derived from the appointment id. Access tokens are not stored.

## 1. Create a LiveKit Cloud project

1. Sign in at [LiveKit Cloud](https://cloud.livekit.io/).
2. Create a project, or open the project you want to use.
3. This repository does not include a self-hosted LiveKit server. Use LiveKit Cloud unless you later point `LIVEKIT_URL` at a LiveKit server you operate yourself.

## 2. Copy the connection values

In the LiveKit project settings, copy:

- The WebSocket URL. For LiveKit Cloud this starts with `wss://`.
- The API key.
- The API secret.

The server turns `wss://` into `https://` for LiveKit room APIs. Do not put the API secret in a `NEXT_PUBLIC_` variable.

## 3. Local environment

Copy the LiveKit lines from `.env.example` into `.env`:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_TOKEN_TTL_SECONDS=600
LIVEKIT_JOIN_WINDOW_MINUTES=15
```

Leave the TTL and join window blank to use the defaults: 10 minutes and 15 minutes. Allowed ranges are 60–900 seconds and 5–120 minutes. A browser request cannot raise the token lifetime.

Rejoin grace is fixed at 30 minutes after the scheduled end for confirmed or checked-in visits. A visit already marked in progress can be rejoined until the doctor completes, cancels, or marks a no-show. A dropped connection does not complete the appointment.

## 4. Vercel

In the Vercel project, open Settings, then Environment Variables. Add the same names for Production and Preview:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_TOKEN_TTL_SECONDS`
- `LIVEKIT_JOIN_WINDOW_MINUTES`

Mark `LIVEKIT_API_SECRET` as sensitive. Redeploy after saving. The application reads these only on the server.

## 5. Server-only variables

Never create:

- `NEXT_PUBLIC_LIVEKIT_API_SECRET`
- `NEXT_PUBLIC_LIVEKIT_API_KEY`
- `NEXT_PUBLIC_LIVEKIT_URL`

The browser receives the WebSocket URL and a short-lived token only after the server accepts `POST /api/appointments/[appointmentId]/consultation/token`. The token is kept in memory for that page. It is not placed in the URL, local storage, email, or SMS.

## 6. Install packages

From `carecircle-mindtogether`:

```bash
npm install
```

The consultation code uses:

- `livekit-server-sdk`
- `livekit-client`
- `@livekit/components-react`
- `@livekit/components-styles`

## 7. Start the app

```bash
npm run dev
```

Open `http://localhost:3000`. Localhost is a secure context, so Chrome, Edge, Firefox, and Safari can prompt for the camera and microphone. A deployed site must use HTTPS. The app does not ask for the camera or microphone until the person chooses **Test devices** on the pre-join screen.

## 8. Two-browser test

You need one active patient account and one approved doctor account. The doctor must be assigned to the appointment.

1. As the patient, book an **online** appointment and complete the existing payment confirmation so the status is Confirmed.
2. Sign in as the patient in one browser and as the doctor in another browser, or use a private window for the second account.
3. Open the same appointment in each portal.
4. During the join window (15 minutes before the start, unless you changed it), each person opens the appointment and chooses **Join consultation**. The patient does not have to wait for the doctor to place a call. If the doctor is already connected, the patient can also accept the incoming call.
5. On **Ready for your consultation?**, choose **Test devices**, then join. The page requests the camera and microphone only after that choice.
6. Confirm each side can see and hear the other. This repository cannot prove that two-way media works until you do this with real LiveKit credentials and two signed-in browsers.
7. As the doctor, check in, then choose **Start visit** or **Start encounter**. Joining the room does not start the clinical record.
8. Write a private working note in the clinical workspace. Save a patient summary as a draft, then release it with the confirmation checkbox. Private notes are not released with the summary.
9. Choose **Complete consultation** and confirm the checkbox. That completes the appointment and asks LiveKit to close that appointment's room. **Leave** does not do this.
10. As the patient, leave the room with **Leave consultation**. Leaving does not complete the appointment. Rejoining remains available while the appointment rules allow it.
11. Confirm the patient can see a released summary and cannot see the private working note.

Screen sharing is not offered. Participant tokens publish only camera and microphone, or microphone alone for audio-only. Do not enable LiveKit screen share unless a later reviewed change adds it to the token grants.

Repeat with an **in-person** appointment. The page must show the saved clinic address, or “Location details have not been provided yet.” It must not show Join consultation, a camera preview, or a LiveKit room.

## 9. Permission checks

- Sign out and confirm the token URL returns 401.
- Open another patient's appointment id and confirm it is not found.
- Sign in as a different doctor and confirm that doctor's portal does not list the appointment.
- Cancel the appointment and confirm a new token is refused.
- Use a confirmed appointment outside the join window and confirm the page explains that the room is not open yet.

## 10. Camera and microphone

If the browser blocks access:

1. Use the lock or camera icon in the address bar.
2. Allow the camera and microphone for this site.
3. Choose **Test devices** again.

If no camera is available, select **Join with audio only**. That option still connects through LiveKit and publishes the microphone only. There is no separate video-only appointment mode. Online appointments can continue with audio when a camera is missing or declined.

**Play test tone** plays a short generated tone. It reports that the tone was played. It does not claim a speaker passed a test the browser could not run. Speaker switching uses the browser audio-output API when that API exists.

If the page is not localhost and not HTTPS, the browser will refuse media devices.

## 11. Connection problems

The room shows Connecting, Connected, Waiting, or Reconnecting. A reconnect does not complete the appointment. If the connection fails, the page shows a recoverable message and the person can request a new token. Empty rooms close after about five minutes. A brief departure waits about 60 seconds before LiveKit closes an empty room. The next eligible join creates the same room name again.

## 12. Recording

Recording and egress are not enabled. Participant tokens set `roomRecord` to false and do not grant room administration. Do not turn on LiveKit Cloud egress or auto-recording for this project unless a later, reviewed change adds consent and storage rules. This phase stores no audio or video files.

## 13. Tokens and secrets

After `npm run build`, search the client output for the API secret and confirm it is absent. Server logs for this feature use fixed messages such as `livekit_token_failed`. They do not print tokens or secrets. Audit metadata records the role, audio-only choice, and token lifetime, not the token.

## 14. Tests

```bash
npm test
npx tsc --noEmit
npx eslint src/lib/consultations src/lib/livekit src/components/consultation src/app/api/appointments src/app/patient/appointments src/app/doctor
npx prisma validate
```

`prisma validate` checks the schema. It does not apply a migration. Do not run `npm run db:migrate` against Neon for this phase. No migration was added.

Automated tests mock LiveKit's room API. They do not open a real call.

## 15. Before real calls work

Create the LiveKit Cloud project, set the three required variables locally and on Vercel, and use two signed-in browsers. Until those credentials exist, eligible users see that video and audio are unavailable and the appointment is unchanged.

These controls are not a legal, privacy, or clinical certification. Before launch, review consent, telehealth rules for Sierra Leone, retention, and whether any recording feature should exist at all.
