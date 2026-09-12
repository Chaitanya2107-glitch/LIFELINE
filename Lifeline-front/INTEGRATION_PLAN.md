# Lifeline — Frontend ↔ Backend Integration Plan

## Overview

The frontend is a complete UI prototype running entirely on in-memory mock data.
The backend is a fully tested FastAPI + Supabase API with 31/31 integration tests passing.

This plan divides the integration work across **4 members**:
- **BE-1** — Backend developer 1 (database + auth + patient profile)
- **BE-2** — Backend developer 2 (AI extraction + file storage + care plan + appointments)
- **FE-1** — Frontend developer 1 (auth rebuild + doctor portal API wiring)
- **FE-2** — Frontend developer 2 (patient portal API wiring + health intelligence pages)

### Coordination contract

The backend tasks must be completed and merged **before** the corresponding frontend
tasks begin. The ordering within each side is strict — later tasks depend on earlier ones.

The shared API contract (field names, status casing, endpoint paths) is defined in
this document. Both sides must follow it exactly so that when code is merged there
are no field-name or casing mismatches.

---

## API Contract (shared reference — both teams must follow this)

### Status / enum casing
All status values use **lowercase** (matching the existing backend):
- consent: `"pending"` `"approved"` `"denied"`
- appointments: `"upcoming"` `"completed"` `"cancelled"`
- care_plan: `"pending"` `"ongoing"` `"completed"`

### Auth headers
Every authenticated request sends:
```
Authorization: Bearer <jwt_token>
```
Token stored in `localStorage` under key `lifeline_token`.

### Base URL
Frontend reads from `import.meta.env.VITE_API_URL` (default `http://localhost:8000`).

### ID formats
- Patient UUID: standard UUID string e.g. `"d07a5673-b987-4138-b814-1393071110d3"`
- Patient code: `"LFL-J6MTOC"` format
- User (doctor/clerk) id: integer
- All other records: UUID

---

## BE-1 — Database foundations + Auth + Patient profile

### Intent
Everything the frontend needs to authenticate real users and display patient profiles.
This unblocks FE-1 and FE-2 entirely — no frontend API wiring can start until tokens
exist and patient data is real.

### Expected outcomes
- Patients can register (claim their account with LFL code + password)
- Patients can log in with LFL code + password and receive a JWT
- Doctors can register with specialization + medRegNo (validated against registry)
- `GET /auth/me` returns specialization for doctors
- Patient profile endpoint returns blood group, email, emergency contacts, conditions
- Patient can update their own profile
- Consent duration is 7 days

### Todo list

1. **Supabase schema — patients table**
   Add columns:
   - `password_hash TEXT` (nullable — null means unclaimed)
   - `blood_group TEXT` (nullable)
   - `email TEXT` (nullable)
   - `emergency_contacts JSONB` (nullable, default `[]`)
   - `conditions JSONB` (nullable, default `[]`)

2. **Supabase schema — users table**
   Add columns:
   - `specialization TEXT` (nullable)
   - `med_reg_no TEXT` (nullable, unique)
   - `phone TEXT` (nullable)

3. **Supabase schema — medical_registry table** (new table)
   Columns:
   - `reg_no TEXT PRIMARY KEY`
   - `claimed BOOLEAN DEFAULT false`
   Pre-populate with at least 10 valid registration numbers for testing.

4. **Update `POST /auth/register`**
   - Accept optional fields: `specialization`, `med_reg_no`, `phone`
   - When role is `doctor`: validate `med_reg_no` exists in `medical_registry` and
     is not yet claimed; if valid, mark it as claimed
   - Store all new fields on the `users` row
   - Return 400 if `med_reg_no` is invalid or already claimed

5. **Add `GET /auth/verify-registration?med_reg_no=XXX`** (public, no auth)
   - Returns `{"valid": true/false, "reason": "string or null"}`
   - Used by the frontend register form to give instant feedback before submit

6. **Update `GET /auth/me`**
   - Include `specialization`, `phone` in the returned user payload for doctors

7. **Add `POST /patient/register`** (public, no auth)
   - Body: `{ "lfl_code": "LFL-XXXXXX", "password": "string" }`
   - Look up patient by `lfl_code`
   - If not found: 404
   - If `password_hash` already set: 409 "Account already claimed"
   - Hash the password and save to `password_hash`
   - Return the patient object (without `password_hash`)

8. **Add `POST /patient/login`** (public, no auth)
   - Body: `{ "lfl_code": "LFL-XXXXXX", "password": "string" }`
   - Look up patient by `lfl_code`
   - Verify password against `password_hash`
   - On success: issue a JWT with the same payload as OTP verify
     (`sub=patient_code`, `patient_id=UUID`, `role="patient"`)
   - Expiry: `JWT_EXPIRE_MINUTES` (60 min, same as staff — not the 15-min OTP token)
   - Return: `{ "access_token": "...", "token_type": "bearer" }`
   - On failure: 401

9. **Add `GET /patient/profile`** (requires patient JWT)
   - Returns full patient row: id, patient_code, name, phone, email,
     date_of_birth, blood_group, emergency_contacts, conditions, created_at
   - Uses `current_user["patient_id"]` from JWT — no query param

10. **Add `PATCH /patient/profile`** (requires patient JWT)
    - Body: any subset of `{ blood_group, email, phone, emergency_contacts, conditions }`
    - Updates only the fields provided
    - Returns updated patient object

11. **Change `.env` / settings**
    - Set `CONSENT_ACCESS_DURATION_DAYS=7`

### Relevant files
- `app/auth/routes.py` — register and login
- `app/auth/schemas.py` — RegisterRequest, LoginRequest
- `app/auth/security.py` — create_access_token, hash_password, verify_password
- `app/patients/routes.py` — patient_otp_router (add new routes here or new file)
- `app/patients/service.py` — patient lookup helpers
- `app/patients/schemas.py` — add new request/response schemas
- `app/config/settings.py` — CONSENT_ACCESS_DURATION_DAYS
- `app/database/supabase.py` — supabase client (already configured)

### Status
[ ] pending

---

## BE-2 — AI extraction + File storage + Medical record fields + Care plan + Appointments

### Intent
Enrich the medical record pipeline so that uploaded reports produce structured,
frontend-ready data. Add file persistence so the frontend can display original
documents. Add the two new feature domains (appointments, care plan).

### Expected outcomes
- Uploaded records return structured medications, lab values, procedures, follow-ups
- `medical_records` rows include `file_name`, `report_type`, `status`, `file_url`
- `GET /medical-records` returns `uploader_name` (joined from users)
- Original files are stored in Supabase Storage and accessible via signed URL
- `GET /records/{record_id}/file` returns a signed download URL
- Care plan items are auto-created from follow-ups at upload time
- `GET /care-plan` and `PATCH /care-plan/{id}` work
- `GET`, `POST`, `PATCH /appointments` work

### Todo list

1. **Update AI extraction prompt** (`app/ai/prompts.py` or equivalent)
   Change the extraction prompt to return this JSON shape:
   ```json
   {
     "doctor": "string or null",
     "hospital": "string or null",
     "dates": ["YYYY-MM-DD"],
     "diagnosis": ["string"],
     "medicines": [
       {"name": "string", "dosage": "string", "frequency": "string", "duration": "string"}
     ],
     "allergies": ["string"],
     "lab_values": [
       {"name": "string", "value": "string", "unit": "string", "date": "YYYY-MM-DD or null", "normal": true/false}
     ],
     "procedures": ["string"],
     "follow_ups": ["string"]
   }
   ```
   The `normal` flag for lab values: ask the model to set it based on
   standard reference ranges. If uncertain, default to `true`.

2. **Update `validate_medical_record`** (`app/ai/validator.py`)
   Update the Pydantic model to match the new extraction shape:
   - `medicines`: list of `MedicineItem` objects
   - `lab_values`: list of `LabValueItem` objects
   - `procedures`: list of strings (new field)
   - `follow_ups`: list of strings (new field)

3. **Update `parse_ai_response`** (`app/ai/parser.py`)
   Ensure the parser handles and passes through the new fields without dropping them.

4. **Supabase schema — medical_records table**
   Add columns:
   - `file_name TEXT` (nullable)
   - `report_type TEXT` (nullable)
   - `status TEXT DEFAULT 'verified'`
   - `file_url TEXT` (nullable)
   - `procedures JSONB` (nullable, default `[]`)
   - `follow_ups JSONB` (nullable, default `[]`)
   Note: `medicines` and `lab_values` columns already exist as JSONB —
   the shape of the stored data changes but the column type stays the same.

5. **Supabase Storage — create bucket**
   - Bucket name: `medical-reports`
   - Access: private (no public URLs — use signed URLs)
   - RLS: service key has full access (backend handles auth)

6. **Update upload pipeline** (`app/api/upload.py`)
   After OCR and before deleting the local file:
   - Upload the file to Supabase Storage bucket `medical-reports`
     with path `{patient_id}/{record_id}/{file_name}`
   - Store the storage path (not the signed URL — generate signed URLs on demand)
   - Add `file_name`, `report_type`, `status="verified"`, `file_url` (storage path)
     to the record dict before calling `save_medical_record`
   - Accept `report_type` as a new form field on the upload endpoint
   - After saving the record, loop through `follow_ups` and insert a care plan row
     for each one (call the care plan service)

7. **Update `GET /medical-records`** (`app/api/upload.py`)
   - Join `users` table to get uploader name
   - Return `uploader_name` as an additional field on each record

8. **Add `GET /records/{record_id}/file`** (requires doctor or patient JWT with consent)
   - Look up the record's `file_url` (storage path)
   - Generate a Supabase Storage signed URL (e.g. 1-hour expiry)
   - Return `{ "signed_url": "https://...", "expires_in": 3600 }`
   - Apply same consent-based access control as `GET /medical-records`

9. **Supabase schema — care_plan table** (new table)
   Columns:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `patient_id UUID FK → patients.id`
   - `category TEXT DEFAULT 'Follow-up'`
   - `title TEXT`
   - `description TEXT`
   - `due_date DATE` (nullable)
   - `status TEXT DEFAULT 'pending'`
   - `priority TEXT DEFAULT 'medium'`
   - `source_record_id UUID FK → medical_records.id` (nullable)
   - `created_at TIMESTAMPTZ DEFAULT now()`

10. **Add care plan service + routes** (`app/care_plan/`)
    - `GET /care-plan` — query param `patient_id` (optional, same resolve logic as
      `GET /medical-records`). Patient gets own, doctor gets with consent, clerk 403.
    - `PATCH /care-plan/{item_id}` — patient or doctor can update `status` only.
      Patient can only update their own items.
    - Internal `create_care_plan_item(patient_id, description, source_record_id)`
      called from the upload pipeline.

11. **Supabase schema — appointments table** (new table)
    Columns:
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `patient_id UUID FK → patients.id`
    - `doctor_id INTEGER FK → users.id`
    - `date DATE`
    - `time TEXT`
    - `location TEXT` (nullable)
    - `type TEXT`
    - `notes TEXT` (nullable)
    - `status TEXT DEFAULT 'upcoming'`
    - `created_at TIMESTAMPTZ DEFAULT now()`

12. **Add appointments service + routes** (`app/appointments/`)
    - `GET /appointments` — patient gets own (JWT), doctor gets their own appointments
    - `POST /appointments` — doctor creates appointment for a patient (requires consent)
    - `PATCH /appointments/{id}` — update `status`, `notes`, `location`
    - `DELETE /appointments/{id}` — cancel (sets status to `cancelled`)

### Relevant files
- `app/ai/prompts.py` — AI prompts
- `app/ai/ai_manager.py` — Groq call
- `app/ai/validator.py` — Pydantic validation
- `app/ai/parser.py` — response parsing
- `app/api/upload.py` — upload pipeline and `GET /medical-records`
- `app/services/medical_record_service.py` — `resolve_patient_id`, `check_doctor_consent`
- `app/main.py` — router registration
- New: `app/care_plan/routes.py`, `app/care_plan/service.py`, `app/care_plan/schemas.py`
- New: `app/appointments/routes.py`, `app/appointments/service.py`, `app/appointments/schemas.py`

### Status
[ ] pending

---

## FE-1 — Auth rebuild + Doctor portal API wiring

### Dependency
**Must start after BE-1 is merged.** Requires the real login endpoints to exist.

### Intent
Replace the mock auth system with real JWT-based auth. Wire every doctor-facing
page to the real API. The doctor portal is fully functional after this task.

### Expected outcomes
- Doctor register and login hit real backend endpoints
- JWT stored in localStorage, sent on every request
- Doctor dashboard, patient search, upload, records, consent, audit, notifications
  all read from and write to the real backend
- No mock data is used anywhere in the doctor portal
- Session expiry still works (frontend inactivity timer remains, but now clears real token)

### Todo list

1. **Create `src/api/client.js`** — central axios (or fetch) wrapper
   - Reads base URL from `import.meta.env.VITE_API_URL`
   - Attaches `Authorization: Bearer <token>` header from localStorage automatically
   - On 401 response: clears token and redirects to login
   - On 429 response: shows a "too many requests" toast

2. **Create `src/api/auth.js`**
   - `loginDoctor(email, password)` → `POST /auth/login`
   - `registerDoctor(name, email, phone, specialization, medRegNo, password)` → `POST /auth/register`
   - `verifyRegistration(medRegNo)` → `GET /auth/verify-registration?med_reg_no=`
   - `getMe()` → `GET /auth/me`

3. **Rebuild `AuthContext.jsx`**
   - On login: store JWT in `localStorage` under key `lifeline_token`
   - `currentUser` state populated from `GET /auth/me` response (not hardcoded shape)
   - On logout: remove token from localStorage
   - Keep the existing 15-min inactivity timeout logic — just also clear localStorage

4. **Update `DoctorLoginPage.jsx`**
   - Replace `authenticateDoctor()` mock call with `loginDoctor(email, password)`
   - Change the login field from "Doctor ID" to "Email"
   - On success: store token, call `getMe()`, set `currentUser`, navigate to dashboard

5. **Update `DoctorRegisterPage.jsx`**
   - Replace `registerDoctor()` mock call with real API calls
   - Add real-time `medRegNo` validation using `verifyRegistration()`
   - On success: show the doctor their new integer ID (from `GET /auth/me`)

6. **Create `src/api/patients.js`**
   - `searchPatients(query)` → `GET /patients/code/{code}` (search by LFL code)
   - `getPatientById(id)` → `GET /patients/{id}`
   - `createPatient(name, phone, dob)` → `POST /patients/`

7. **Update `PatientSearchPage.jsx`**
   - Replace `patients` mock array + filter with `searchPatients(query)` API call
   - Search is by LFL code (not by name — backend only supports code and UUID lookup)
   - Note for team: name search is not in the backend — search by LFL code only for now

8. **Create `src/api/records.js`**
   - `getRecords(patientId)` → `GET /medical-records?patient_id=`
   - `uploadRecord(patientId, file, reportType)` → `POST /upload` (multipart)
   - `getFileUrl(recordId)` → `GET /records/{record_id}/file`

9. **Update `UploadReportPage.jsx`**
   - Replace `uploadReport()` mock with `uploadRecord()` API call
   - Remove the local OTP step (the backend's upload does not require patient OTP —
     that was a frontend-only mock. Upload just requires staff JWT.)
   - Handle the `file_url` in the response for immediate viewing

10. **Update `DoctorRecordsPage.jsx`**
    - Replace mock data with `getRecords(patientId)` API call
    - Map backend field names to what the component expects:
      - `report.id` (was `reportId`)
      - `report.file_name` (was `fileName`)
      - `report.report_type` (was `reportType`)
      - `report.uploader_name` (was `uploaderName`)
      - `report.diagnosis` (was `extracted.diagnoses`)
      - `report.medicines` (was `extracted.medications`)
      - `report.lab_values` (was `extracted.labValues`)
      - `report.procedures` (was `extracted.procedures`)
      - `report.follow_ups` (was `extracted.followUps`)
    - Use `getFileUrl(record.id)` to get signed URL when doctor clicks "View Report"

11. **Create `src/api/consent.js`**
    - `requestConsent(patientId)` → `POST /consent/request`
    - `getMyAccess()` → `GET /consent/my-access`
    - `getConsentStatus(patientId)` → `GET /consent/status/{patient_id}`

12. **Update `DoctorAccessRequestsPage.jsx`**
    - Replace `createAccessRequest()` / `accessRequests` mock with consent API calls
    - Map status values: backend returns lowercase (`"approved"`) —
      update all status comparisons from `"APPROVED"` to `"approved"`

13. **Update `DoctorNotificationsPage.jsx`**
    - Replace mock `accessRequests` with `getMyAccess()` API call
    - Same status casing fix as above

14. **Update `DoctorAuditPage.jsx`**
    - Replace in-memory `auditLogs` with `GET /audit-logs` API call
    - If the audit log endpoint is not yet ready, show empty state gracefully

15. **Update `DoctorDashboard.jsx`**
    - Replace all mock data counts (reports, patients, pending consents) with
      real API calls
    - Pending consent count: `getMyAccess()` filtered to `status === "pending"`

16. **Create `src/api/appointments.js`** (doctor side)
    - `getAppointments()` → `GET /appointments`
    - `createAppointment(data)` → `POST /appointments`
    - `updateAppointment(id, data)` → `PATCH /appointments/{id}`

17. **Add `.env.local`** (not committed — add to `.gitignore`)
    ```
    VITE_API_URL=http://localhost:8000
    ```
    Add `.env.local.example` (committed) with the same content as a template.

### Relevant files
- `src/context/AuthContext.jsx`
- `src/context/AppDataContext.jsx` — will be partially gutted (doctor functions replaced)
- `src/pages/doctor/*` — all doctor pages
- `src/components/ProtectedRoute.jsx` — update to check localStorage token
- New: `src/api/client.js`, `src/api/auth.js`, `src/api/patients.js`,
  `src/api/records.js`, `src/api/consent.js`, `src/api/appointments.js`

### Status
[ ] pending

---

## FE-2 — Patient portal API wiring + Health intelligence pages

### Dependency
**Must start after BE-1 and BE-2 are both merged.** Requires patient login, profile,
care plan, appointments, and enriched medical records endpoints.

### Intent
Wire every patient-facing page to the real backend. Replace the local Vitalis keyword
matcher with the real Groq API. After this task the patient portal is fully functional
with real data.

### Expected outcomes
- Patient register and login hit real backend endpoints
- All patient portal pages read real data from the backend
- Vitalis chat uses the real `POST /vitalis/chat` endpoint
- Lab trends, medications, care plan, appointments all show real data
- Emergency profile (blood group, contacts) reads from and writes to patient profile
- No mock data is used anywhere in the patient portal

### Todo list

1. **Create `src/api/patientAuth.js`**
   - `registerPatient(lflCode, password)` → `POST /patient/register`
   - `loginPatient(lflCode, password)` → `POST /patient/login`
   - `getPatientProfile()` → `GET /patient/profile`
   - `updatePatientProfile(data)` → `PATCH /patient/profile`

2. **Update `PatientLoginPage.jsx`**
   - Replace `authenticatePatient()` mock with `loginPatient(lflCode, password)`
   - Change the login field from "Patient ID" to "Lifeline Code (LFL-XXXXXX)"
   - On success: store JWT in localStorage, set `currentUser`, navigate to dashboard

3. **Update `PatientRegisterPage.jsx`**
   - Replace `registerPatient()` mock with `registerPatient(lflCode, password)`
   - The form changes: first field is "Your Lifeline Code" (given by clinic),
     then name, email, phone, password — but name/email/phone are collected here
     and sent to `PATCH /patient/profile` immediately after register succeeds
   - On success: show confirmation, redirect to login

4. **Update `AuthContext.jsx`** (patient side)
   - `currentUser` for patients uses JWT payload: `patient_id` (UUID), `role="patient"`,
     `sub=patient_code`
   - On first login call `getPatientProfile()` and merge into `currentUser` state
     so components can access `name`, `blood_group`, `email` etc.

5. **Create `src/api/vitalis.js`**
   - `chatWithVitalis(question, patientId)` → `POST /vitalis/chat?patient_id=`
   - For patient token: no `patient_id` param needed (JWT carries it)
   - For doctor token: pass `patient_id` as query param

6. **Update `VitalisPage.jsx`**
   - Remove the entire local `vitalisRespond()` function and `buildContext()` helper
   - Replace with `chatWithVitalis(question)` API call
   - Keep the chat UI exactly as-is — just replace the response source
   - Show a loading spinner while waiting for Groq response

7. **Create `src/api/timeline.js`**
   - `getTimeline(patientId)` → `GET /timeline/` (no param for patient, with param for doctor)
   - `getSummary(patientId)` → `GET /summary/`

8. **Update `HealthJourneyPage.jsx`**
   - Replace `getPatientTimeline()` mock with `getTimeline()` API call
   - Map backend timeline event shape to component:
     - `event.date` → same
     - `event.title` → same
     - `event.doctor` → same
     - `event.hospital` → same
     - `event.diagnosis` → same
     - `event.type` — not returned by backend, default to `"Medical Report"`
     - `event.eventId` — not returned, use `index` as key

9. **Update `PatientReportsPage.jsx`**
   - Replace `getPatientReports()` mock with `getRecords()` API call (from `src/api/records.js`)
   - Map backend field names (same mapping as FE-1 step 10)
   - Use `getFileUrl(record.id)` for the view/download button

10. **Update `MedicationsPage.jsx`**
    - Replace `getPatientMedications()` mock with `getRecords()` API call
    - Extract `medicines` array from each record (now structured objects)
    - Field mapping: `medicine.name`, `medicine.dosage`, `medicine.frequency`,
      `medicine.duration` — these now come directly from the backend

11. **Update `LabTrendsPage.jsx`**
    - Replace `getPatientLabTrends()` mock with `getRecords()` API call
    - Extract `lab_values` array from each record (now structured objects with
      `name`, `value`, `unit`, `date`, `normal`)
    - Build the trend map on the frontend: group by `lab_value.name` across all records,
      sort by `date` — same logic as the mock, just with real data

12. **Create `src/api/carePlan.js`**
    - `getCarePlan()` → `GET /care-plan`
    - `updateCarePlanItem(id, status)` → `PATCH /care-plan/{id}`

13. **Update `CarePlanPage.jsx`**
    - Replace `getPatientCarePlan()` / `updateCarePlanItem()` mock with API calls
    - Map status values to lowercase (`"pending"`, `"ongoing"`, `"completed"`)

14. **Update `AppointmentsPage.jsx`**
    - Replace `getPatientAppointments()` mock with `getAppointments()` API call
    - Map status values to lowercase (`"upcoming"`, `"completed"`, `"cancelled"`)

15. **Update `EmergencyProfilePage.jsx`**
    - Replace `getEmergencyProfile()` / `getFamilyMembers()` mock with
      `getPatientProfile()` API call
    - Blood group, conditions, emergency contacts come from `patient.blood_group`,
      `patient.conditions`, `patient.emergency_contacts`
    - Family members are NOT in the backend — show the family member section as
      "Coming soon" or hide it for now (do not break the page)
    - Let patients update blood group and emergency contacts via `updatePatientProfile()`

16. **Update `PatientProfilePage.jsx`**
    - Replace mock patient data with `getPatientProfile()` API call
    - Wire the edit/save flow to `updatePatientProfile()`

17. **Update `PatientAccessRequestsPage.jsx`**
    - Replace `getAccessRequestsForPatient()` / `respondToAccessRequest()` mock
      with consent API calls:
      - `GET /consent/pending` → pending requests
      - `POST /consent/{id}/respond` → approve or deny
    - Map status values to lowercase

18. **Update `PatientNotificationsPage.jsx`**
    - Replace mock access requests with `GET /consent/pending` +
      previously responded requests from `GET /consent/pending`
    - Note: there is no "all consent history" endpoint for patients —
      show pending items only, or show a static "no new notifications" for resolved ones

19. **Update `PatientDashboard.jsx`**
    - Replace all mock counts with real API calls:
      - Reports count: `getRecords()`
      - Pending access requests: `GET /consent/pending`
      - Upcoming appointments: `getAppointments()` filtered to `status === "upcoming"`
      - Active medications: from `getRecords()` medicines array
    - Remove `findPatient()` mock call — use `getPatientProfile()` instead

20. **Update `VisitBriefPage.jsx`**
    - Replace `getPatientVisitBrief()` mock with real data assembled from
      `getRecords()` + `getPatientProfile()`
    - Diagnoses, allergies, medications, lab highlights are derived from records
    - Emergency contacts come from patient profile

21. **Remove `AppDataContext.jsx`** (or gut it completely)
    - Once all pages are wired to real API calls, the mock context is no longer needed
    - Remove all mock data arrays (MOCK_DOCTORS, MOCK_PATIENTS, INITIAL_REPORTS etc.)
    - Keep only the audit log client-side (until a real audit endpoint is ready)

### Relevant files
- `src/context/AuthContext.jsx`
- `src/context/AppDataContext.jsx` — being replaced
- `src/pages/patient/*` — all patient pages
- `src/components/patient/*` — LabChart, LabSparkline (keep as-is, just feed real data)
- New: `src/api/patientAuth.js`, `src/api/vitalis.js`, `src/api/timeline.js`,
  `src/api/carePlan.js`
- Reuse from FE-1: `src/api/client.js`, `src/api/records.js`, `src/api/appointments.js`

### Status
[ ] pending

---

## Merge Order

```
BE-1 ──► FE-1
          ▲
BE-2 ──► FE-2
```

1. BE-1 merges first
2. BE-2 merges second (can be worked in parallel with BE-1)
3. FE-1 merges after BE-1 is on main
4. FE-2 merges after both BE-1 and BE-2 are on main

BE-1 and BE-2 can be developed in parallel on separate branches.
FE-1 and FE-2 can be developed in parallel once their backend dependencies are merged,
but FE-2 should not merge until FE-1's `src/api/client.js` and `src/api/records.js`
are available (FE-2 reuses them).

---

## Things Neither Team Should Touch

- `app/consent/` — consent logic is complete and tested (31 tests pass). Do not modify.
- `app/auth/security.py` — JWT creation/verification works. BE-1 only adds new routes,
  does not change existing auth logic.
- `app/api/upload.py` OCR pipeline — BE-2 extends it but does not change the
  OCR → AI → parse → validate chain.
- `src/components/patient/LabChart.jsx` and `LabSparkline.jsx` — chart components
  are complete. FE-2 just feeds them real data.
- `src/components/ProtectedRoute.jsx` — FE-1 updates this once, FE-2 does not touch it.
