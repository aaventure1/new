# Attendance Verification v2 - Implementation Status and Execution Plan

Last updated: 2026-02-22

## Platform Decision

For your goals (business growth, collaborators, reliability, and control), **keep the current custom stack**.

- WordPress is faster for a quick launch.
- Your current stack is better for product evolution, security controls, and clean contributor workflows.

Decision: **Continue with current stack** and do not migrate to WordPress.

## Current Status (Mapped to v2 Scope)

### 1) Data Model

- `AttendanceSubmission` model exists and includes:
  - `userId`, `meetingId`, `certificateId`, `submissionKey` (unique), `meetingDate`, `meetingTimeLabel`
  - `meetingTopic`, `meetingChairperson`, `participationNotes`
  - `attendeeFullName`, `attendeeEmail`
  - `sendAdditionalRecipient`, `additionalRecipientEmail`
  - `meetingIdDisplay`, `checkInAt`, `submittedAt`, `revision`, `status`, `emailLog`
- Indexes present:
  - unique `submissionKey`
  - `userId + submittedAt`
  - `certificateId`
- `Attendance` linkage fields exist:
  - `submissionId`
  - `attendeeFullNameMasked`
  - `verificationPublicNotes`

Status: **Done**

### 2) Backend API

- `POST /api/attendance/submit-verification-form` implemented.
  - Validation + normalization + deterministic `submissionKey`.
  - Upsert behavior (insert or revision increment).
  - Best-effort linkage to attendance/certificate by user + time window.
  - Async email queue triggered.
- `POST /api/attendance/helper-suggest` implemented.
  - Auth required.
  - Rate limited.
  - Non-persistent suggestions only.
- `GET /api/attendance/verify/:certificateId` returns masked identity (`attendeeNameMasked`).
- Admin endpoints implemented:
  - `GET /api/admin/attendance-submissions`
  - `GET /api/admin/attendance-submissions/:id`
  - `POST /api/admin/attendance-submissions/:id/retry-email`

Status: **Done**

### 3) Frontend

- Form wiring implemented in `public/js/app.js`:
  - calls submit API
  - shows validation/API errors
  - preserves values on server error
  - disables submit while pending
- Meeting ID display metadata endpoint usage implemented.
- Helper UI present for topic + participation suggestions with explicit apply action.
- Required copy strings and accessibility behavior are in place.

Status: **Done**

### 4) Email Queue and Reliability

- In-process async queue exists in `server/utils/attendanceEmailQueue.js`.
- Attendee + optional recipient delivery supported.
- Submission does not fail if email fails.
- Email result appended to `emailLog`.
- Status progression supports `submitted|linked|emailed|error`.

Status: **Done**

### 5) Security/Integrity Controls

- Auth required on helper/submit endpoints.
- Server-side validation and sanitization implemented with max lengths.
- Helper endpoint rate limited.
- Meeting ID anti-tamper check via session token.
- Public identity masking for verification endpoint implemented.

Status: **Done**

### 6) Rollout/Feature Flag

- Feature flag gate exists: `ATTENDANCE_VERIFICATION_FORM_V2` (enabled unless explicitly `false`).

Status: **Done**

## Remaining Gaps (High Value)

### 1) Automated Test Coverage for Attendance v2

Current test suite only has smoke tests. Attendance v2 needs targeted tests.

Add:
- Unit tests:
  - validation error map (exact phrases)
  - deterministic `submissionKey`
  - masking function behavior
  - helper no-persistence guarantee
- Integration tests:
  - successful submit persistence
  - duplicate upsert revision increment
  - additional recipient queue path
  - verify endpoint returns masked identity
  - email failure does not fail submit
  - admin list/detail/retry endpoints
- UI tests:
  - required-field banners
  - conditional recipient email field
  - helper suggestion apply flow

Priority: **P1**

### 2) Operational Monitoring Hooks

Add simple counters/log aggregation for:
- submit success/failure rate
- email success/failure rate
- duplicate upsert rate
- helper latency/error rate

Priority: **P2**

### 3) Optional Commercial Gate Alignment

If you want parity with 12step-online business model, add subscription checks on attendance form submission path.

Priority: **Business decision**

## Execution Order (Recommended)

1. Implement attendance v2 tests (unit + integration first).
2. Add minimal monitoring counters/log summaries.
3. Decide on subscription gate behavior for submit endpoint.
4. Run go-live checklist and deploy.

## Files In Scope

- `/Users/smk/dev/apps/aaventure/server/models/AttendanceSubmission.js`
- `/Users/smk/dev/apps/aaventure/server/models/Attendance.js`
- `/Users/smk/dev/apps/aaventure/server/routes/attendance.js`
- `/Users/smk/dev/apps/aaventure/server/routes/admin.js`
- `/Users/smk/dev/apps/aaventure/server/utils/attendanceEmailQueue.js`
- `/Users/smk/dev/apps/aaventure/server/utils/attendanceSubmissionUtils.js`
- `/Users/smk/dev/apps/aaventure/server/utils/attendanceHelperService.js`
- `/Users/smk/dev/apps/aaventure/public/js/app.js`
- `/Users/smk/dev/apps/aaventure/public/index.html`
- `/Users/smk/dev/apps/aaventure/public/css/style.css`
