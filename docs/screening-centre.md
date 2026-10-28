# Mental Health Screening Centre

The Screening Centre is a governed registry for mental health screens. It is separate from the older visit-questionnaire tables (`ScreeningResponse`, `ScreeningAnswer`, `ScreeningResponseVersion`). Those tables are kept so existing rows are not deleted. They are not offered to patients.

## What patients, clinicians, and administrators can do

Patients open Screening Centre, read the purpose and limits, and can start a questionnaire only when that instrument is active. A result explains the stored score and states that it is not a diagnosis. Patients can review their own history and book an appointment. Submitted answers cannot be edited.

Doctors see submitted assessments only for patients who already have an appointment with them. They can read answers and the automated score, compare earlier results when the scoring algorithm version matches, write a clinical interpretation, record a follow-up recommendation, and add an amendment note. The interpretation is not released as a patient summary. An amendment does not change answers or the score.

Administrators see the instrument registry, version labels, approval and licensing status, and aggregate counts. They do not see patient answers. A super administrator can record licensing and clinical-approval status. That action cannot install questions or scoring thresholds, and it cannot force an instrument active while a blocker remains.

## Why instruments are inactive

Each candidate is registered without question text and without a scoring specification:

- Depression: PHQ-9
- Bipolar disorder: MDQ
- Mania: ASRM
- Anxiety: GAD-7
- Psychosis-related symptoms: no instrument selected
- Cognitive impairment: AD8 or another approved screen
- Substance use: WHO ASSIST or another validated instrument
- OCD: OCI-R or another approved instrument
- Personality: no instrument selected

These names are candidates. The application does not reproduce the questionnaires.

An instrument becomes available only when all of the following are true:

- Clinical approval is `CLINICALLY_APPROVED`
- Licensing status is `CLEARED_FOR_CLINICAL_USE`
- The current version stores a question set and a `SUM` scoring specification
- A required safety protocol is marked approved
- Verified local support contacts are stored in the `SCREENING_SAFETY_CONTACTS` platform setting
- The instrument is not retired

The server recalculates availability. A database flag of `ACTIVE` is not enough if any rule above fails.

## Scoring

Scoring runs on the server from the stored specification for that version. The supported shape is a sum of integer answers, inclusive bands, and an optional safety item. A score that does not fall in a stored band is rejected. The application does not invent thresholds, and it does not use a model to choose them.

Install a scoring specification only through a reviewed change after the clinical lead has approved the exact rules and the license allows the question text to be stored. Do not type thresholds into the administration form. There is no control for that.

Historical results keep the question text copied at submission and the algorithm version, so a later instrument change does not rewrite them.

## Safety

Every current candidate requires a safety protocol, and none is approved. Until that protocol and verified contacts exist, patients cannot start the affected screen.

If a submitted answer meets a stored safety rule and contacts are configured, the result page shows those contacts and says a clinician has not automatically been notified. If contacts are missing, submission is refused. The application does not send screening answers or scores by email, SMS, or WhatsApp.

`SCREENING_SAFETY_CONTACTS` is optional JSON on `PlatformSetting`:

```json
{
  "region": "Freetown",
  "lines": [{ "label": "Emergency", "value": "A verified local number" }]
}
```

Use contacts the clinical lead has verified for the operating area. Do not invent a hotline.

## Privacy and permissions

- Patients can read and submit only their own assessments.
- A doctor needs an existing appointment with that patient. A guessed identifier returns not found and writes an access denial.
- Doctor interpretations stay on the clinician record.
- Administration analytics are counts only.
- Audit events record the action, instrument code, and version. They do not record answer text.
- Starting and submitting are rate limited.
- Partial answers are not stored in the browser and are not written until a valid submission.

Consent for a screen is stored as `ScreeningConsent` version `2026-10-26`.

## Migration

Apply the existing migrations, including `20261026073000_screening_centre`, with the project's migrate command when a deployment is authorized. Do not reset the database. The new migration only creates the registry tables and inserts inactive candidates.

The screening registry is not clinically validated because the tests pass. Tests use a synthetic two-item specification. They do not certify PHQ-9, GAD-7, or any other named instrument.

## Still outstanding

- Clinical approval of each instrument and its exact scoring rules
- Licensing or a decision not to reproduce each questionnaire
- Translation, if a language other than English is required
- A written safety protocol and verified local contacts
- Which psychosis and personality instruments the clinical lead will use
- Who may mark `safetyProtocolApproved` after that protocol exists; the administration form does not set that flag
