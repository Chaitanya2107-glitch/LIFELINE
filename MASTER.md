# Lifeline — Master Project Document

> **Single source of truth.** Consolidates all project documentation:
> `BACKEND_EXPLAINER.md`, `LIFELINE_HANDOFF.md`, `backend/README.md`,
> `backend/INTEGRATION_PLAN.md`, `Lifeline-front/README.md`,
> `Lifeline-front/INTEGRATION_PLAN.md`, `docs/coding-conventions.md`,
> `docs/project-structure.md`
>
> **Last synced with code:** 2026-09-17 (Emergency QR, Pharmacy tier, patient-initiated appointments)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Backend — Directory Structure](#4-backend--directory-structure)
5. [Frontend — Directory Structure & Route Map](#5-frontend--directory-structure--route-map)
6. [API Endpoints (All 41 Routes)](#6-api-endpoints-all-41-routes)
7. [Database Schema](#7-database-schema)
8. [Auth & JWT](#8-auth--jwt)
9. [Key Features Explained](#9-key-features-explained)
10. [Security Model](#10-security-model)
11. [Environment Variables](#11-environment-variables)
12. [Integration Plan (BE-1, BE-2, FE-1, FE-2)](#12-integration-plan)
13. [Implementation Status](#13-implementation-status)
14. [Known Remaining Work](#14-known-remaining-work)
15. [Coding Conventions](#15-coding-conventions)
16. [Development Constraints](#16-development-constraints)
17. [Getting Started & Seed Data](#17-getting-started--seed-data)
18. [Key Numbers Reference](#18-key-numbers-reference)

---

## 1. Project Overview

**Lifeline** is an AI-assisted medical record management and emergency-response platform.

> Doctors securely upload patient medical reports → the backend reads and understands them using AI → patients view their health history, care plan and appointments, chat with an AI assistant (Vitalis), and carry an emergency QR code for first responders.

### What the backend provides

- Secure, role-separated medical record management (doctor / clerk / patient)
- Doctor/hospital-controlled record uploads (not patient-controlled)
- OCR + AI extraction pipeline for uploaded medical documents
- Original files stored in a private Supabase Storage bucket, served via signed URLs
- Doctor ↔ patient consent gating for record access
- Patient self-registration and password login using a unique patient code (`LFL-XXXXXX`)
- Patient profile (blood group, emergency contacts, conditions)
- Medical timeline, AI doctor summary, and Vitalis AI assistant
- Care plan auto-generated from report follow-ups
- Appointments with a patient-requests / doctor-confirms flow
- Public emergency QR page (minimal first-responder data)
- Pharmacy tier: pharmacists request patient consent, view prescriptions, and record dispensing
- Full audit trail via `access_logs`, with a per-user audit log endpoint
- CORS for frontend browser access and rate limiting on sensitive endpoints

### Upload pipeline (how it works)

```
Doctor/clerk uploads a PDF/image (+ optional report_type)
         │
         ▼
  [1] OCR — Tesseract primary; EasyOCR fallback if text < 20 chars,
            confidence < 0.7, or Tesseract errors
         │
         ▼
  [2] Duplicate check — SHA-256 hash; return existing record if already uploaded
         │
         ▼
  [3] AI extraction — Groq (openai/gpt-oss-20b) returns structured JSON
      (diagnoses, medicines, allergies, lab values, procedures, follow-ups)
         │
         ▼
  [4] Save record to DB + upload original to Supabase Storage
      bucket `medical-reports` at {patient_id}/{record_id}/{file_name}
         │
         ▼
  [5] Each follow-up becomes a `care_plan` item (source_record_id = record);
      if medicines were extracted, a `prescription_status` row ('prescribed') is created
         │
         ▼
  [6] Audit log written — who uploaded, when, for which patient
         │
         ▼
  Patient opens the app → timeline, care plan, labs, Vitalis chat
```

---

## 2. Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Language | Python 3.11+ (local venv runs 3.14) |
| Framework | FastAPI |
| Database | Supabase (PostgreSQL) |
| File storage | Supabase Storage (private bucket `medical-reports`) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| OCR | Tesseract (primary) via pytesseract + EasyOCR (fallback) |
| AI | Groq (`openai/gpt-oss-20b`); Gemini / OpenRouter engines present but inactive |
| Rate limiting | slowapi (in-process, per-IP) |
| Logging | Loguru |
| Settings | pydantic-settings |
| Deployment | Railway (Linux) |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Routing | React Router v7 |
| Icons | Lucide React v1.28 |
| PDF rendering | react-pdf / pdfjs-dist |
| QR codes | qrcode.react |
| API layer | `src/api/*` (fetch wrapper in `client.js`, JWT in `localStorage`) |
| State management | React Context + useState (no Redux) |

---

## 3. Architecture Overview

### Backend

```
HTTP Request
    │
    ▼
FastAPI (app/main.py)
 ├── CORSMiddleware (localhost:3000, localhost:5173)
 ├── SlowAPIMiddleware (rate limiting)
 └── Routers
      ├── auth_router          → /auth/*
      ├── audit_router         → /audit-logs
      ├── upload_router        → /upload, /medical-records, /records/{id}/file
      ├── timeline_router      → /timeline/
      ├── summary_router       → /summary/
      ├── vitalis_router       → /vitalis/chat
      ├── patients_router      → /patients/*          (staff)
      ├── patient_otp_router   → /patient/*           (patient auth + profile + QR;
      │                                                 name is historical — no OTP)
      ├── consent_router       → /consent/*
      ├── care_plan_router     → /care-plan
      ├── appointments_router  → /appointments
      ├── emergency_router     → /emergency/{token}   (public)
      └── pharmacy_router      → /pharmacy/*          (pharmacist)
```

### Frontend

```
BrowserRouter (App.jsx)
 ├── AppDataProvider  (legacy mock state — still mounted, mostly unused)
 └── AuthProvider     (currentUser, login, logout, session timeout)
      │
      ├── Public: /, /doctor/login, /doctor/register, /patient/login,
      │           /patient/register, /emergency/:token
      │
      ├── Patient Portal  (PatientLayout → PatientSidebar)
      │    └── ProtectedRoute (requiredRole="PATIENT")
      │
      ├── Doctor Portal   (DoctorLayout → DoctorSidebar)
      │    └── ProtectedRoute (requiredRole="DOCTOR")
      │
      └── Pharmacy Portal (PharmacyLayout → PharmacySidebar)
           └── ProtectedRoute (requiredRole="PHARMACIST")
```

---

## 4. Backend — Directory Structure

```
lifeline-backend/backend/
├── .env.example
├── requirements.txt
├── s.py                                 # ⚠ scratch file — safe to delete
├── migrations/
│   ├── 001_fresh_schema.sql             # full schema (all tables)
│   ├── 002_medical_records_be2_fields.sql
│   ├── 003_care_plan.sql
│   ├── 004_appointments.sql
│   ├── 005_emergency_qr_token.sql       # patients.emergency_qr_token
│   ├── 006_pharmacy.sql                 # pharmacist role, prescription_status, dispense_events
│   ├── 007_appointment_requests.sql     # appointments.reason, status default 'pending'
│   └── apply_002/003/004/006.py
├── tests/                               # mostly live-server integration scripts
│   ├── test_emergency_qr.py             # needs backend running on :8000
│   ├── test_pharmacy.py                 # offline (mocked Supabase) — 15 tests
│   ├── test_appointments_flow.py        # offline (mocked Supabase) — 20 tests
│   ├── test_ocr_fallback.py
│   ├── test_t22_t26.py, test_t22_t31.py
│   └── be1_*, smoke_*, validate_*       # BE-1 / BE-2 validation scripts
└── app/
    ├── main.py                          # FastAPI app + CORS + rate-limit + routers
    ├── config/settings.py               # pydantic-settings, .env loader
    ├── auth/
    │   ├── routes.py                    # /auth/register, /auth/login, /auth/me
    │   ├── audit_routes.py              # GET /audit-logs
    │   ├── schemas.py                   # RegisterRequest (med_reg_no required for doctors)
    │   ├── service.py
    │   └── security.py                  # JWT create/verify, require_doctor/staff/patient
    ├── models/                          # user.py, patient.py, consent.py (TypedDicts)
    ├── patients/
    │   ├── schemas.py
    │   ├── service.py                   # patient CRUD + emergency QR token logic
    │   └── routes.py                    # /patients/* (staff) + /patient/* (patient)
    ├── consent/                         # routes, schemas, service — 5 endpoints
    ├── care_plan/                       # routes, schemas, service
    ├── appointments/                    # routes, schemas, service (patient request → doctor confirm)
    ├── pharmacy/                        # routes, schemas, service (prescriptions + dispensing)
    ├── emergency/
    │   ├── routes.py                    # GET /emergency/{token} (public, 10/min)
    │   └── schemas.py                   # EmergencyInfoResponse (whitelisted fields)
    ├── services/
    │   ├── medical_record_service.py    # resolve_patient_id + check_doctor_consent
    │   └── audit_service.py             # write_access_log (silent-catch)
    ├── api/upload.py                    # /upload, /medical-records, /records/{id}/file
    ├── upload/                          # ⚠ RETIRED routes.py — never import
    ├── ai/
    │   ├── ocr_manager.py               # Tesseract → EasyOCR fallback
    │   ├── tesseract_engine.py, easyocr_engine.py
    │   ├── vision_engine.py, gemini_engine.py, openrouter_engine.py,
    │   │   fallback_engine.py           # present, not in active pipeline
    │   ├── ai_manager.py, prompts.py, parser.py, validator.py
    │   └── providers/groq_provider.py   # 3-retry Groq client
    ├── timeline/                        # GET /timeline/
    ├── summary/                         # GET /summary/
    ├── vitalis/                         # POST /vitalis/chat
    ├── middleware/                      # empty
    ├── schemas/medical_record.py        # AI extraction output schema
    ├── database/supabase.py             # singleton Supabase client
    └── utils/
        ├── limiter.py                   # slowapi Limiter singleton
        ├── logger.py                    # Loguru setup
        ├── hash.py                      # SHA-256 report dedup
        ├── date_validator.py
        ├── patient_code.py              # LFL-XXXXXX generator
        └── qr_token.py                  # secrets.token_urlsafe(32)
```

---

## 5. Frontend — Directory Structure & Route Map

```
Lifeline-front/src/
├── App.jsx                          # Root router
├── main.jsx
├── api/
│   ├── client.js                    # fetch wrapper, auth header, 401/429 handling
│   ├── auth.js                      # doctor auth
│   ├── patientAuth.js               # patient register/login/profile + emergency QR
│   ├── patients.js, records.js, consent.js
│   ├── appointments.js, carePlan.js
│   ├── timeline.js, vitalis.js
│   ├── pharmacy.js                  # pharmacist register, lookup, access, prescriptions, dispense
│   └── emergency.js                 # public GET /emergency/{token}
├── context/
│   ├── AppDataContext.jsx            # legacy mock state (still mounted in App.jsx)
│   ├── AuthContext.jsx               # session management, login/logout
│   └── ReportContext.jsx             # legacy, unused
├── layouts/                         # PatientLayout, DoctorLayout, PharmacyLayout
├── components/
│   ├── ProtectedRoute.jsx, SessionExpiredBanner.jsx
│   ├── Hero.jsx, Features.jsx, Navbar.jsx      # landing page
│   ├── dashboard/                   # legacy dashboard widgets
│   ├── patient/                     # PatientSidebar, LabChart, LabSparkline
│   ├── pharmacy/PharmacySidebar.jsx
│   └── doctor/DoctorSidebar.jsx
└── pages/
    ├── LandingPage.jsx
    ├── Dashboard.jsx, LoginPage.jsx, MedicalJourney.jsx,
    │   ReportViewer.jsx, ReportsPage.jsx      # legacy — routes redirect to /
    ├── public/EmergencyPublicPage.jsx
    ├── patient/                     # 16 pages (see route map)
    ├── doctor/                      # 11 pages (see route map)
    └── pharmacy/                    # 6 pages + pharmacyFormat.js helpers
```

### Route Map

| Path | Component | Access |
|---|---|---|
| `/` | `LandingPage` | Public |
| `/emergency/:token` | `EmergencyPublicPage` | Public |
| `/patient/login` | `PatientLoginPage` | Public |
| `/patient/register` | `PatientRegisterPage` | Public |
| `/doctor/login` | `DoctorLoginPage` | Public |
| `/doctor/register` | `DoctorRegisterPage` | Public |
| `/patient/dashboard` | `PatientDashboard` | PATIENT only |
| `/patient/reports` | `PatientReportsPage` | PATIENT only |
| `/patient/access-requests` | `PatientAccessRequestsPage` | PATIENT only |
| `/patient/notifications` | `PatientNotificationsPage` | PATIENT only |
| `/patient/profile` | `PatientProfilePage` | PATIENT only |
| `/patient/guide` | `PatientGuidePage` | PATIENT only |
| `/patient/journey` | `HealthJourneyPage` | PATIENT only |
| `/patient/vitalis` | `VitalisPage` | PATIENT only |
| `/patient/medications` | `MedicationsPage` | PATIENT only |
| `/patient/labs` | `LabTrendsPage` | PATIENT only |
| `/patient/care-plan` | `CarePlanPage` | PATIENT only |
| `/patient/visit-brief` | `VisitBriefPage` | PATIENT only |
| `/patient/appointments` | `AppointmentsPage` | PATIENT only |
| `/patient/emergency` | `EmergencyProfilePage` | PATIENT only |
| `/doctor/dashboard` | `DoctorDashboard` | DOCTOR only |
| `/doctor/patients` | `PatientSearchPage` | DOCTOR only |
| `/doctor/upload` | `UploadReportPage` | DOCTOR only |
| `/doctor/access-requests` | `DoctorAccessRequestsPage` | DOCTOR only |
| `/doctor/records` | `DoctorRecordsPage` | DOCTOR only |
| `/doctor/notifications` | `DoctorNotificationsPage` | DOCTOR only |
| `/doctor/audit` | `DoctorAuditPage` | DOCTOR only |
| `/doctor/profile` | `DoctorProfilePage` | DOCTOR only |
| `/doctor/appointments` | `DoctorAppointmentsPage` | DOCTOR only |
| `/pharmacy/login` | `PharmacyLoginPage` | Public |
| `/pharmacy/register` | `PharmacyRegisterPage` | Public |
| `/pharmacy/dashboard` | `PharmacyDashboard` | PHARMACIST only |
| `/pharmacy/access-requests` | `PharmacyAccessRequestsPage` | PHARMACIST only |
| `/pharmacy/prescriptions` | `PharmacyPrescriptionsPage` | PHARMACIST only |
| `/pharmacy/history` | `PharmacyHistoryPage` | PHARMACIST only |

Legacy paths `/login`, `/dashboard`, `/reports`, `/report-viewer`, `/medical-journey` and `*` redirect to `/`.

---

## 6. API Endpoints (All 41 Routes)

Route count verified from `app.openapi()` on 2026-09-17 (34 original + 6 pharmacy + 1 appointment doctor list).

### Authentication & Audit

| Method | Path | Auth | Rate limit | Purpose |
|---|---|---|---|---|
| POST | `/auth/register` | None | — | Register doctor, clerk or pharmacist (`med_reg_no` required for doctors; pharmacy licence in `med_reg_no` required for pharmacists) |
| POST | `/auth/login` | None | **10/min/IP** | Staff login; returns JWT; audits `doctor_login` / `clerk_login` |
| GET | `/auth/me` | JWT | — | JWT payload, enriched with name/email/specialization/phone/med_reg_no for staff |
| GET | `/audit-logs` | staff | — | Caller's own `access_logs` rows, newest first |

### Patients — staff (`/patients`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/patients/` | staff | Create patient; returns LFL-XXXXXX code |
| GET | `/patients/code/{patient_code}` | staff | Look up by LFL code (audited) |
| GET | `/patients/{patient_id}` | staff | Look up by UUID (audited) |

### Patient self-service (`/patient`)

| Method | Path | Auth | Rate limit | Purpose |
|---|---|---|---|---|
| POST | `/patient/register` | None | **3/min/IP** | Self-register (name, phone, DOB, password, email); 409 on duplicate phone; returns LFL code |
| POST | `/patient/login` | None | — | LFL code + password → 60-min patient JWT |
| GET | `/patient/profile` | patient | — | Full profile (no password hash) |
| PATCH | `/patient/profile` | patient | — | Update blood group, email, phone, emergency contacts, conditions |
| GET | `/patient/emergency-qr` | patient | — | Get (lazily create) QR token + public URL |
| POST | `/patient/emergency-qr/regenerate` | patient | — | New token; old QR stops working immediately |

### Upload & Medical Records

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/upload` | staff | Upload report (+ `report_type`); OCR → AI → save → storage → care plan → audit |
| GET | `/medical-records` | doctor (consent) or patient | Retrieve records |
| GET | `/records/{record_id}/file` | doctor (consent) or patient | Signed download URL (1 hour) |

### Timeline / Summary / Vitalis

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/timeline/` | doctor (consent) or patient | Medical timeline |
| GET | `/summary/` | doctor (consent) or patient | AI doctor summary |
| POST | `/vitalis/chat` | doctor (consent) or patient | Chat with Vitalis AI |

### Consent (`/consent`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/consent/request` | doctor | Request access to a patient's records |
| GET | `/consent/pending` | patient | Pending requests for this patient, with `requester_name` / `requester_role` / `requester_specialization` |
| GET | `/consent/my-access` | doctor | All of this doctor's consent requests |
| GET | `/consent/status/{patient_id}` | doctor | Whether doctor has approved, unexpired consent |
| POST | `/consent/{consent_id}/respond` | patient | Approve or deny |

### Care Plan (`/care-plan`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/care-plan` | doctor (consent, `?patient_id=`) or patient | List items |
| PATCH | `/care-plan/{item_id}` | doctor (consent) or patient (owner) | Update status: `pending` / `ongoing` / `completed` |

### Appointments (`/appointments`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/appointments/doctors` | patient | Doctors available to book (id, name, specialization) |
| GET | `/appointments` | doctor or patient | Own appointments, with `doctor_name` / `doctor_specialization` / `patient_name` / `patient_code` |
| POST | `/appointments` | patient (**10/min/IP**) | Request: `doctor_id`, preferred `date` (not past) + `time`, `type`, `reason` → `pending`. 404 unknown doctor, 409 already pending with that doctor |
| PATCH | `/appointments/{appt_id}` | owner | Doctor: `pending→upcoming` (date, time, location required), `pending→rejected` (`notes` = reason), `upcoming→completed`, cancel, edit date/time/location/notes. Patient: `cancelled` only |
| DELETE | `/appointments/{appt_id}` | owner | Cancel a `pending` / `upcoming` appointment (409 otherwise) |

### Emergency (public)

| Method | Path | Auth | Rate limit | Purpose |
|---|---|---|---|---|
| GET | `/emergency/{token}` | None | **10/min/IP** | Name, blood group, DOB, conditions, emergency contacts, allergies. 404 on bad token. Audited as `actor_role="public"` |

### Pharmacy (`/pharmacy`) — pharmacist only

| Method | Path | Purpose |
|---|---|---|
| GET | `/pharmacy/patients/code/{patient_code}` | Look up patient — returns only id, code, name (audited) |
| POST | `/pharmacy/access-request` | Request consent (shared `consent_requests`, audited as `pharmacist`) |
| GET | `/pharmacy/access-requests` | This pharmacist's consent requests |
| GET | `/pharmacy/prescriptions?patient_id=` | Prescriptions with medicines (consent required) |
| POST | `/pharmacy/dispense` | Mark dispensed + `dispense_events` row + `dispensed` audit. 403 no consent, 404 not this patient's, 409 already dispensed |
| GET | `/pharmacy/dispense-history` | This pharmacist's dispense events with patient name/code |

### Root / Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | `{"message": "Backend Running"}` |
| GET | `/health` | `{"status": "healthy"}` |
| GET | `/db-status` | Static "connected" response (does not actually query the DB) |

---

## 7. Database Schema

Full schema: `migrations/001_fresh_schema.sql` + `005_emergency_qr_token.sql`.

### `users` — doctors and clerks

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT identity PK | |
| `email` | TEXT UNIQUE NOT NULL | |
| `password_hash` | TEXT NOT NULL | bcrypt |
| `name` | TEXT NOT NULL | |
| `role` | TEXT NOT NULL | CHECK `doctor` / `clerk` / `pharmacist` (migration 006) |
| `specialization` | TEXT | |
| `med_reg_no` | TEXT | Nullable in DB; required for doctors by app |
| `phone` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

### `patients`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `patient_code` | TEXT UNIQUE NOT NULL | `LFL-XXXXXX`, backend-generated |
| `name` | TEXT NOT NULL | |
| `phone`, `email` | TEXT | |
| `password_hash` | TEXT | Set on self-registration |
| `date_of_birth` | DATE | |
| `blood_group` | TEXT | |
| `emergency_contacts` | JSONB default `[]` | `[{name, relation, phone}]` |
| `conditions` | JSONB default `[]` | |
| `emergency_qr_token` | TEXT UNIQUE NULL | Migration 005 |
| `created_by` | BIGINT FK → users.id | NULL = self-registered |
| `created_at` | TIMESTAMPTZ | |

### `medical_records`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `patient_id` | UUID FK → patients.id | |
| `uploaded_by` | BIGINT FK → users.id | |
| `uploader_name` | TEXT | Denormalised |
| `report_hash` | TEXT | SHA-256 dedup |
| `file_name`, `report_type`, `file_url` | TEXT | `file_url` = storage path |
| `status` | TEXT default `verified` | |
| `lab_values`, `diagnosis`, `medicines`, `allergies`, `procedures`, `follow_ups` | JSONB | AI-extracted |
| `created_at` | TIMESTAMPTZ | |

No legacy `user_id` column in the fresh schema.

### `consent_requests`

`id`, `doctor_id` (FK users), `patient_id` (FK patients), `status` (CHECK `pending`/`approved`/`denied`), `requested_at`, `responded_at`, `expires_at` (now + 7 days on approval).
Partial unique index `idx_consent_unique_pending` on `(doctor_id, patient_id) WHERE status='pending'`.

### `care_plan`

`id`, `patient_id`, `category` (default `Follow-up`), `title`, `description`, `due_date`, `status` (`pending`/`ongoing`/`completed`), `priority` (`low`/`medium`/`high`), `source_record_id` (FK medical_records), `created_at`.

### `appointments`

`id`, `patient_id`, `doctor_id`, `date`, `time` (TEXT), `location`, `type`, `reason` (migration 007, patient-written), `notes` (doctor-written), `status`, `created_at`.
While `pending`, `date`/`time` hold the patient's preferred slot (time may be e.g. "Morning (9 AM – 12 PM)"); on confirmation the doctor sets the exact `HH:MM` time and location.
Statuses: `pending` → `upcoming` / `rejected`; `upcoming` → `completed`; `pending`/`upcoming` → `cancelled`.

### `prescription_status` (migration 006)

`id`, `medical_record_id` (UNIQUE FK medical_records), `status` (`prescribed` / `sent_to_pharmacy` / `dispensed`), `created_at`, `updated_at`.
Created by `POST /upload` when medicines are extracted; the migration backfills existing records. No flow sets `sent_to_pharmacy` yet.

### `dispense_events` (migration 006)

`id`, `prescription_status_id`, `pharmacist_id` (FK users), `patient_id`, `items` JSONB, `dispensed_at`.

### `access_logs`

`id`, `actor_user_id`, `actor_patient_id`, `actor_role` (`doctor`/`clerk`/`pharmacist`/`patient`/`public`), `action`, `patient_id`, `metadata` JSONB, `created_at`.
Actions include `record_uploaded`, `records_accessed`, `record_file_downloaded`, `patient_searched`, `consent_requested`, `doctor_login`, `clerk_login`, `pharmacist_login`, `emergency_qr_accessed`, `dispensed`.

### Unused tables

- `otp_sessions` — still created by migration 001, but the OTP system was removed from code (commit `b65e541`).
- `reports` — legacy table in the old database; nothing reads or writes it.

---

## 8. Auth & JWT

### JWT Payload — Doctor / Clerk

```json
{ "sub": "user@email.com", "user_id": 123, "role": "doctor", "exp": 1234567890 }
```

### JWT Payload — Patient

```json
{ "sub": "LFL-A1B2C3", "patient_id": "uuid-here", "role": "patient", "exp": 1234567890 }
```

Both expire after `JWT_EXPIRE_MINUTES` (**60 min**). Patients get their token from `POST /patient/login` (LFL code + password). `PATIENT_JWT_EXPIRE_MINUTES` still exists in settings but is no longer used.

### Roles & Permissions

| Role | Sign-up | Create patients | Upload | Read records | Consent | Appointments |
|---|---|---|---|---|---|---|
| `doctor` | `POST /auth/register` | ✅ | ✅ | ✅ with consent | request | confirm / decline requests, complete, reschedule, cancel |
| `clerk` | `POST /auth/register` | ✅ | ✅ | ❌ 403 | ❌ | ❌ 403 |
| `pharmacist` | `POST /auth/register` | — | — | prescriptions only, with consent | request (`/pharmacy/access-request`) | — |
| `patient` | `POST /patient/register` | — | — | ✅ own only | approve / deny | request, withdraw, cancel |
| public | — | — | — | emergency QR data only | — | — |

### FastAPI Dependencies

| Dependency | Allows |
|---|---|
| `get_current_user` | Any valid JWT |
| `require_doctor` | `role == "doctor"` |
| `require_staff` | `role in {"doctor", "clerk"}` |
| `require_patient` | `role == "patient"` |
| `require_pharmacist` | `role == "pharmacist"` |

### Access Control Gate — `resolve_patient_id()`

Used by medical-records, file download, timeline, summary, Vitalis and care plan (`app/services/medical_record_service.py`):

- **patient token** → own `patient_id`
- **doctor token** → requires `patient_id` param + `check_doctor_consent()`, else 403
- **clerk / unknown role** → 403

---

## 9. Key Features Explained

### Smart Upload (OCR → AI → Store)

1. **OCR** — Tesseract; falls back to EasyOCR on error, < 20 chars, or confidence < 0.7
2. **Duplicate check** — SHA-256 hash; returns the existing record
3. **AI extraction** — Groq, strict "return only JSON, do not invent" prompt
4. **Storage** — record saved to DB; original file to private bucket `medical-reports` (upload failure leaves `file_url` null, record still saved)
5. **Care plan** — one item per extracted follow-up
6. **Audit log** — after every new save (not on duplicates)

### Consent System

- `pending` → `approved` / `denied`; approval sets `expires_at = now + CONSENT_ACCESS_DURATION_DAYS` (**7 days**)
- `check_doctor_consent()` runs on every record access
- `request_consent` is idempotent (returns existing pending row)

### Appointments (patient requests, doctor confirms)

1. Patient picks a doctor from `GET /appointments/doctors`, a visit type, a preferred date and time slot, and a reason → `POST /appointments` → `pending` (one pending request per doctor)
2. Doctor sees it under **Appointment Requests** and either confirms it with the exact date, time and location (`upcoming`, with an optional note) or declines it with a reason (`rejected`)
3. Patient sees the confirmed details under **Upcoming Appointments**, or the doctor's reason under **Past & Closed**
4. Doctor marks the visit `completed` or reschedules it; either side can cancel a pending or upcoming appointment

No consent is needed to request or confirm an appointment — confirming doesn't give the doctor access to records.

### Vitalis AI Assistant

- Builds context from the patient's records and AI summary
- **Patient-specific questions** → answered only from the records; says so if data is missing
- **General medical questions** → may use general medical knowledge, but must never present it as a fact about this patient (commit `938a5f4`)

### Emergency QR *(uncommitted — in progress)*

- Patient page `/patient/emergency` shows a QR code (qrcode.react) for `FRONTEND_BASE_URL/emergency/{token}`
- Token: `secrets.token_urlsafe(32)` (~192 bits), created lazily, rotatable via regenerate
- Public page `/emergency/:token` calls `GET /emergency/{token}` and shows only: name, blood group, DOB, conditions, emergency contacts, allergies (deduplicated from all records)
- Rate-limited 10/min/IP; same 404 for any bad token; every access audited (token itself never logged)
- Patients can edit emergency contacts and conditions from the UI (commit `f069966`)

### Pharmacy *(uncommitted — integrated from the `lifeline-backend (2)` fork)*

1. Pharmacist registers (`role=pharmacist`, licence in `med_reg_no`) and signs in at `/pharmacy/login` (shared `/auth/login`)
2. Looks up the patient by LFL code and sends an access request
3. Patient sees "<name> — Pharmacist" on their Access Requests page and approves (7 days)
4. Pharmacist opens Prescriptions — one card per record with medicines — ticks medicines and marks them dispensed
5. Status becomes `dispensed`; a `dispense_events` row and a `dispensed` audit row are written

Pharmacist consent reuses `consent_requests` (`doctor_id` holds the pharmacist's users.id), so grants stay separate per user. A pharmacist token is rejected by all doctor record endpoints (`resolve_patient_id` only accepts doctor/patient).

### Timeline & Summary

Timeline returns records sorted by date. Summary is an AI-written, doctor-ready overview that must not invent anything.

---

## 10. Security Model

| Concern | Mitigation |
|---|---|
| Doctor seeing another doctor's patient | Consent check on every record access |
| Token used on wrong endpoint | `role` claim checked explicitly on every endpoint |
| Emergency QR scanning | 192-bit token, 10/min/IP, uniform 404, rotatable, whitelisted response schema |
| Emergency data exposure | `EmergencyInfoResponse` excludes id, patient code, email, phone, and all record details except allergies |
| Original file access | Private bucket; 1-hour signed URLs issued only after the access check |
| Passwords | bcrypt for staff and patients; hashes stripped from profile responses |
| Secrets in audit logs | Never logged: passwords, JWTs, QR tokens |
| Rate limiting | Staff login 10/min; patient register 3/min; emergency lookup 10/min — per IP |
| Secrets | pydantic-settings reads `.env`; `.env` is never committed |

⚠ `POST /patient/login` has **no rate limit** (staff login does). See §14.

---

## 11. Environment Variables

Backend (`settings.py`; documented in `.env.example`):

```
APP_NAME=Lifeline Backend
ENVIRONMENT=development
SUPABASE_URL=                       # required
SUPABASE_KEY=                       # required
JWT_SECRET_KEY=                     # required — openssl rand -hex 32
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
PATIENT_JWT_EXPIRE_MINUTES=15       # unused since OTP removal
CONSENT_ACCESS_DURATION_DAYS=7
FRONTEND_BASE_URL=http://localhost:5173   # used to build QR URLs — not yet in .env.example
LOG_LEVEL=INFO
AI_PROVIDER=groq
GROQ_API_KEY=                       # required for AI features (client created lazily; clear error if missing)
GROQ_MODEL=openai/gpt-oss-20b
GEMINI_API_KEY=                     # optional, inactive
OPENROUTER_API_KEY=                 # optional, inactive
GOOGLE_VISION_API_KEY=              # optional; vision_engine falls back to EasyOCR when unset
```

Frontend `.env.local` (not committed):

```
VITE_API_URL=http://localhost:8000
```

---

## 12. Integration Plan

The original four tracks (BE-1 → FE-1, BE-2 → FE-2) are **implemented**. Shared API contract still applies:

- Status values lowercase (`pending`, `approved`, `denied`, `upcoming`, `completed`, `cancelled`, `rejected`)
- `Authorization: Bearer <jwt>`; token in `localStorage` key `lifeline_token`
- Base URL `import.meta.env.VITE_API_URL` (default `http://localhost:8000`)
- Patient UUID string; patient code `LFL-XXXXXX`; doctor/clerk id integer

| Track | Status | Delivered | Deviations from original plan |
|---|---|---|---|
| **BE-1** | ✅ Done | Schema columns, doctor fields on register, `/auth/me` enrichment, patient register/login/profile, consent = 7 days | No `medical_registry` table or `GET /auth/verify-registration` — `med_reg_no` is required but **not validated** against a registry. Patient register is self-service (generates a new LFL code) instead of claiming an existing one |
| **BE-2** | ✅ Done | New `medical_records` fields, storage bucket, signed file URLs, `uploader_name`, care plan, appointments | Appointments gained a `pending` → patient-approval step (replaced the OTP / `appt_auth` token) |
| **FE-1** | ✅ Done | `src/api/*`, real doctor auth, doctor pages wired | `DoctorAuditPage` uses `GET /audit-logs` (a stale comment still mentions AppDataContext) |
| **FE-2** | ✅ Done | Patient auth, profile, Vitalis, timeline, care plan, appointments wired | `AppDataContext` not yet removed |

### Things Not to Touch Without Reason

- `app/consent/` — complete and tested
- `app/auth/security.py` — JWT logic
- `app/api/upload.py` OCR → AI → parse → validate chain
- `LabChart.jsx`, `LabSparkline.jsx`
- `ProtectedRoute.jsx`

---

## 13. Implementation Status

| Step / Track | Status | Description |
|---|---|---|
| Steps 1–7 | ✅ Complete | Schema, role auth, patient identity, role-aware records, consent, hardening + audit, CORS + rate limiting |
| BE-1 / BE-2 / FE-1 / FE-2 | ✅ Complete | See §12 |
| OTP removal | ✅ Complete | Replaced by password login + appointment approval (`b65e541`) |
| Groq model migration | ✅ Complete | `llama-3.1-8b-instant` → `openai/gpt-oss-20b` (`82ef78f`) |
| Vitalis general Q&A | ✅ Complete | `938a5f4` |
| Emergency contacts / conditions edit UI | ✅ Complete | `f069966` |
| **Patient-initiated appointments** | 🟡 Built, **uncommitted** | Reversed flow, migration 007, 20 offline tests, both appointment pages rewritten. Migration 007 must be run in Supabase |
| **Pharmacy tier** | 🟡 Built, **uncommitted** | Backend module, migration 006, 15 offline tests, pharmacy portal (6 pages). Migration 006 must be run in Supabase |
| **Emergency QR** | 🟡 Built, **uncommitted** | Backend module, migration 005, tests, patient + public pages. Migration 005 must be run in Supabase |
| **Step 8** | ❌ Not started | Scope undefined — see §14 |

**Verification (2026-09-17):**
- Backend imports cleanly and starts; OpenAPI lists **41 routes**
- `tests/test_pharmacy.py` 15/15 and `tests/test_appointments_flow.py` 20/20 pass (offline)
- `tests/smoke_items_11_12.py` / `validate_items_11_12.py` (live scripts) still exercise the old doctor-creates flow and will fail until updated
- Frontend `npm run build` succeeds (JS bundle ~495 kB)
- `tests/test_emergency_qr.py` needs a running backend on `:8000` plus a live Supabase DB — it was not run against a live server during this sync

---

## 14. Known Remaining Work

### Step 8 — Not started

No scope defined. **Plan → approval → validation → implementation.**

### Open items

| Item | Notes |
|---|---|
| Commit Emergency QR + Pharmacy + Appointment work | And run `005_emergency_qr_token.sql`, `006_pharmacy.sql`, `007_appointment_requests.sql` in Supabase |
| Forgot password | Not implemented — needs an email provider (reset link) or a staff-assisted reset for patients; decision pending |
| Appointment notifications | Doctors/patients only see changes when they open the page — no email/SMS |
| Pharmacy: `sent_to_pharmacy` unused | No flow for a doctor to explicitly send a prescription |
| Pharmacy: patient can't see dispense status | Could be shown on MedicationsPage |
| Pharmacy fork contains secrets | Its `tests/test_pharmacy.py` hardcodes a Supabase key / JWT secret and it has a `.env` — rotate if that repo is public |
| Stray `lifeline-backend (2)/` folder in repo root | Pharmacy fork — now integrated; delete once confirmed |
| Rate-limit `POST /patient/login` | Staff login is limited, patient login is not |
| Medical registry validation | `med_reg_no` is accepted without checking a registry |
| Add `FRONTEND_BASE_URL` to `.env.example` | Needed for correct QR URLs in production |
| Add production frontend URL to CORS | `allow_origins` in `app/main.py` |
| Remove `PATIENT_JWT_EXPIRE_MINUTES` | Unused since OTP removal |
| Drop `otp_sessions` table | Unused since OTP removal — needs explicit approval |
| Retire `reports` table | Orphaned |
| Remove `AppDataContext` / `ReportContext` and legacy pages | `Dashboard`, `LoginPage`, `MedicalJourney`, `ReportViewer`, `ReportsPage`, `components/dashboard/*` |
| Rename `patient_otp_router` | Name is historical; it no longer handles OTP |
| `/db-status` does not query the DB | Always reports "connected" |
| Delete `backend/s.py` | Scratch file |
| Test suite | Mostly live-server scripts; no offline unit tests / CI |
| Parental / guardian support | Not designed |

---

## 15. Coding Conventions

### Python Style

- PEP 8, 4-space indentation, max line length 88
- `snake_case` functions/variables, `PascalCase` classes, `UPPER_CASE` constants

### Folder Responsibilities

| Folder | Purpose |
|---|---|
| `<feature>/routes.py` | HTTP endpoints — no business logic |
| `<feature>/service.py`, `services/` | Business logic |
| `database/` | Database client |
| `<feature>/schemas.py`, `schemas/` | Pydantic request & response models |
| `models/` | TypedDict DB models |
| `config/` | Settings only |
| `utils/` | Shared helpers |

### Rules

- Routes call services; services call the database
- Use Loguru `logger`, never `print()`
- Never hardcode secrets, URLs or keys — use `settings.FIELD_NAME`
- Raise `HTTPException` for errors
- Commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`
- Never push to `main` without testing

---

## 16. Development Constraints

1. **Do not redesign the architecture.**
2. **Do not refactor working code** unless explicitly instructed.
3. **Preserve existing behaviour** with every change.
4. **Make changes incrementally.** App must stay runnable.
5. **No destructive DB operations without explicit approval.** Show SQL before DROP / DELETE / TRUNCATE.
6. **No secrets in code or committed files.**
7. **Validate every step** — syntax, imports, route count, behaviour.
8. **Stop after each step and wait for approval.**
9. **Check existing APIs and DB models before adding new ones.**
10. **Do not start Step 8** without a plan and explicit approval.

---

## 17. Getting Started & Seed Data

### Backend

```bash
cd lifeline-backend/backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in Supabase, JWT, Groq keys
# Run migrations/001, 005, 006 and 007 in Supabase SQL Editor
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

Tesseract must be installed on the machine for OCR.

### Frontend

```bash
cd Lifeline-front
npm install
npm run dev       # http://localhost:5173
npm run build
```

### Accounts

The real app has no hard-coded demo users:

- **Doctor** — register at `/doctor/register` (any `med_reg_no` is accepted), then log in with email + password
- **Patient** — register at `/patient/register`, note the generated `LFL-XXXXXX` code, then log in with code + password

The old mock accounts (`PT-200001`, `DR-100001`, `MED-REG-00x`, `RPT-00x`) live only in the legacy `AppDataContext.jsx` and do **not** work against the backend.

---

## 18. Key Numbers Reference

| Setting | Value |
|---|---|
| Staff JWT expiry | 60 min |
| Patient JWT expiry | 60 min |
| Signed file URL expiry | 1 hour |
| Consent access duration | 7 days |
| Emergency QR token | 32 bytes (43 chars, ~192 bits) |
| Staff login rate limit | 10/min/IP |
| Patient register rate limit | 3/min/IP |
| Emergency lookup rate limit | 10/min/IP |
| Appointment request rate limit | 10/min/IP |
| OCR fallback threshold | < 20 chars or confidence < 0.7 |
| Groq retries | 3 |
| Backend API routes | 41 |
| Migrations | 7 |
