# Lifeline — Master Project Document

> **Single source of truth.** Consolidates all project documentation:
> `BACKEND_EXPLAINER.md`, `LIFELINE_HANDOFF.md`, `backend/README.md`,
> `backend/INTEGRATION_PLAN.md`, `Lifeline-front/README.md`,
> `Lifeline-front/INTEGRATION_PLAN.md`, `docs/coding-conventions.md`,
> `docs/project-structure.md`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Backend — Directory Structure](#4-backend--directory-structure)
5. [Frontend — Directory Structure & Route Map](#5-frontend--directory-structure--route-map)
6. [API Endpoints (All 21 Routes)](#6-api-endpoints-all-21-routes)
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
17. [Demo Credentials & Seed Data](#17-demo-credentials--seed-data)
18. [Key Numbers Reference](#18-key-numbers-reference)

---

## 1. Project Overview

**Lifeline** is an AI-assisted medical record management and emergency-response platform.

> Doctors securely upload patient medical reports → the backend reads and understands them using AI → patients can chat with an AI assistant (Vitalis) about their own medical history.

### What the backend provides

- Secure, role-separated medical record management
- Doctor/hospital-controlled record uploads (not patient-controlled)
- OCR + AI extraction pipeline for uploaded medical documents
- Doctor ↔ patient consent gating for record access
- Patient identification via unique patient codes (`LFL-XXXXXX`) + OTP sessions
- Medical timeline, AI doctor summary, and Vitalis AI assistant
- Full audit trail via `access_logs`
- CORS for frontend browser access
- Rate limiting on brute-force-sensitive endpoints

### Upload pipeline (how it works)

```
Doctor uploads a PDF/image
         │
         ▼
  [1] OCR — read text out of the file (Tesseract primary, EasyOCR fallback)
         │
         ▼
  [2] Duplicate check — SHA-256 hash; return existing record if already uploaded
         │
         ▼
  [3] AI extraction — Groq LLaMA returns structured JSON
      (diagnoses, medicines, allergies, lab results, procedures, follow-ups)
         │
         ▼
  [4] Save structured record to database + upload original file to Supabase Storage
         │
         ▼
  [5] Audit log written — who uploaded, when, for which patient
         │
         ▼
  Patient opens the app → views timeline, care plan, chat with Vitalis
```

---

## 2. Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Framework | FastAPI |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| OTP | bcrypt-hashed 6-digit codes stored in `otp_sessions` |
| OCR | Tesseract (primary) via pytesseract + EasyOCR (fallback) |
| AI | Groq (llama-3.1-8b-instant), optional Gemini / OpenRouter |
| Rate limiting | slowapi 0.1.9 (in-process, per-IP) |
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
| State management | React Context + useState (no Redux) |
| Data persistence | In-memory only (integration pending — see §12) |

---

## 3. Architecture Overview

### Backend

```
HTTP Request
    │
    ▼
FastAPI (app/main.py)
 ├── CORSMiddleware
 ├── SlowAPIMiddleware (rate limiting)
 └── Routers
      ├── auth_router        → /auth/*
      ├── patients_router    → /patients/*
      ├── patient_otp_router → /patient/*
      ├── upload_router      → /upload, /medical-records
      ├── timeline_router    → /timeline/
      ├── summary_router     → /summary/
      ├── vitalis_router     → /vitalis/chat
      └── consent_router     → /consent/*
```

### Frontend

```
BrowserRouter (App.jsx)
 ├── AppDataProvider  (global state — all mock data + mutations)
 └── AuthProvider     (currentUser, login, logout, 15-min session timeout)
      │
      ├── Patient Portal  (PatientLayout → PatientSidebar)
      │    └── All routes wrapped by ProtectedRoute (requiredRole="PATIENT")
      │
      └── Doctor Portal   (DoctorLayout → DoctorSidebar)
           └── All routes wrapped by ProtectedRoute (requiredRole="DOCTOR")

Public routes: /, /patient/login, /doctor/login, /patient/register, /doctor/register
```

---

## 4. Backend — Directory Structure

```
backend/
├── .env.example                         # all 16 keys documented
├── requirements.txt
├── app/
│   ├── main.py                          # FastAPI app + CORS + rate-limit + routers
│   ├── config/
│   │   └── settings.py                  # pydantic-settings, .env loader
│   ├── auth/
│   │   ├── routes.py                    # POST /auth/register, /auth/login, GET /auth/me
│   │   ├── schemas.py                   # RegisterRequest, LoginRequest, TokenResponse
│   │   └── security.py                  # JWT create/verify, require_doctor/staff/patient
│   ├── models/
│   │   ├── user.py                      # UserRecord TypedDict
│   │   ├── patient.py                   # PatientRecord TypedDict
│   │   └── consent.py                   # ConsentRecord TypedDict
│   ├── patients/
│   │   ├── schemas.py                   # Pydantic request/response schemas
│   │   ├── service.py                   # DB CRUD + OTP create/verify
│   │   └── routes.py                    # /patients/* (staff) + /patient/* (OTP, rate-limited)
│   ├── consent/
│   │   ├── schemas.py
│   │   ├── service.py                   # consent CRUD + audit calls
│   │   └── routes.py                    # 5 consent endpoints
│   ├── services/
│   │   ├── medical_record_service.py    # resolve_patient_id + check_doctor_consent
│   │   └── audit_service.py             # write_access_log (silent-catch)
│   ├── api/
│   │   └── upload.py                    # POST /upload + GET /medical-records
│   ├── upload/
│   │   └── routes.py                    # ⚠ RETIRED — docstring only, never import
│   ├── ai/
│   │   ├── tesseract_engine.py          # OCR (platform-aware path)
│   │   ├── ocr_manager.py
│   │   ├── ai_manager.py               # calls Groq provider
│   │   ├── prompts.py
│   │   ├── parser.py
│   │   ├── validator.py
│   │   └── providers/
│   │       └── groq_provider.py        # 3-retry Groq client
│   ├── timeline/
│   │   ├── routes.py                    # GET /timeline/
│   │   └── service.py
│   ├── summary/
│   │   ├── routes.py                    # GET /summary/
│   │   └── service.py
│   ├── vitalis/
│   │   ├── routes.py                    # POST /vitalis/chat
│   │   ├── service.py
│   │   └── schemas.py
│   ├── schemas/
│   │   └── medical_record.py           # AI extraction output schema
│   ├── database/
│   │   └── supabase.py                 # singleton Supabase client
│   └── utils/
│       ├── limiter.py                   # slowapi Limiter singleton
│       ├── logger.py                   # Loguru setup
│       ├── hash.py                     # SHA-256 report dedup
│       └── patient_code.py              # LFL-XXXXXX generator
```

---

## 5. Frontend — Directory Structure & Route Map

```
src/
├── App.jsx                          # Root router
├── main.jsx
├── context/
│   ├── AppDataContext.jsx            # Global state (mock data + all mutations)
│   ├── AuthContext.jsx               # Session management, login/logout, 15-min timeout
│   └── ReportContext.jsx             # (legacy, unused)
├── layouts/
│   ├── PatientLayout.jsx
│   └── DoctorLayout.jsx
├── components/
│   ├── ProtectedRoute.jsx
│   ├── SessionExpiredBanner.jsx
│   ├── patient/
│   │   ├── PatientSidebar.jsx
│   │   ├── OTPVerificationModal.jsx
│   │   └── LabSparkline.jsx          # Reusable SVG sparkline
│   └── doctor/
│       └── DoctorSidebar.jsx
└── pages/
    ├── LandingPage.jsx
    ├── patient/
    │   ├── PatientLoginPage.jsx
    │   ├── PatientRegisterPage.jsx
    │   ├── PatientDashboard.jsx
    │   ├── PatientReportsPage.jsx
    │   ├── PatientProfilePage.jsx
    │   ├── PatientAccessRequestsPage.jsx
    │   ├── PatientNotificationsPage.jsx
    │   ├── PatientOTPPage.jsx
    │   ├── PatientGuidePage.jsx
    │   ├── HealthJourneyPage.jsx
    │   ├── VitalisPage.jsx
    │   ├── MedicationsPage.jsx
    │   ├── LabTrendsPage.jsx
    │   ├── CarePlanPage.jsx
    │   ├── VisitBriefPage.jsx
    │   ├── AppointmentsPage.jsx
    │   └── EmergencyProfilePage.jsx
    └── doctor/
        ├── DoctorLoginPage.jsx
        ├── DoctorRegisterPage.jsx
        ├── DoctorDashboard.jsx
        ├── DoctorRecordsPage.jsx
        ├── PatientSearchPage.jsx
        ├── UploadReportPage.jsx
        ├── DoctorAccessRequestsPage.jsx
        ├── DoctorNotificationsPage.jsx
        ├── DoctorAuditPage.jsx
        ├── DoctorProfilePage.jsx
        └── DoctorAppointmentsPage.jsx
```

### Route Map

| Path | Component | Access |
|---|---|---|
| `/` | `LandingPage` | Public |
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
| `/patient/otp` | `PatientOTPPage` | PATIENT only |
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

---

## 6. API Endpoints (All 21 Routes)

### Authentication (`/auth`)

| # | Method | Path | Auth | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 1 | POST | `/auth/register` | None | — | None | Register doctor or clerk |
| 2 | POST | `/auth/login` | None | — | **10/min/IP** | Login; returns JWT |
| 3 | GET | `/auth/me` | JWT | any | None | Return decoded JWT payload |

### Patient Identity & OTP (`/patients`, `/patient`)

| # | Method | Path | Auth | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 4 | POST | `/patients/` | JWT | staff | None | Create patient; returns LFL-XXXXXX code |
| 5 | GET | `/patients/code/{patient_code}` | JWT | staff | None | Look up patient by LFL code |
| 6 | GET | `/patients/{patient_id}` | JWT | staff | None | Look up patient by UUID |
| 7 | POST | `/patient/request-otp` | None | — | **5/min/IP** | Patient requests OTP |
| 8 | POST | `/patient/verify-otp` | None | — | **10/min/IP** | Verify OTP; returns 15-min patient JWT |

### Upload & Medical Records

| # | Method | Path | Auth | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 9 | POST | `/upload` | JWT | staff | None | Upload report; OCR → AI → save; deduplicates; audits |
| 10 | GET | `/medical-records` | JWT | doctor (consent) or patient | None | Retrieve records |

### Timeline / Summary / Vitalis

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 11 | GET | `/timeline/` | JWT | doctor (consent) or patient | Medical timeline |
| 12 | GET | `/summary/` | JWT | doctor (consent) or patient | AI doctor summary |
| 13 | POST | `/vitalis/chat` | JWT | doctor (consent) or patient | Chat with Vitalis AI |

### Consent Management (`/consent`)

| # | Method | Path | Auth | Role | Purpose |
|---|---|---|---|---|---|
| 14 | POST | `/consent/request` | JWT | doctor | Request access to patient's records |
| 15 | GET | `/consent/pending` | JWT | patient | Patient views pending consent requests |
| 16 | GET | `/consent/my-access` | JWT | doctor | Doctor views all their consent requests |
| 17 | GET | `/consent/status/{patient_id}` | JWT | doctor | Check if doctor has approved consent |
| 18 | POST | `/consent/{consent_id}/respond` | JWT | patient | Approve or deny a consent request |

### Root / Health

| # | Method | Path | Purpose |
|---|---|---|---|
| 19 | GET | `/` | Returns `{"message": "Backend Running"}` |
| 20 | GET | `/health` | Returns `{"status": "healthy"}` |
| 21 | GET | `/db-status` | DB connectivity check |

---

## 7. Database Schema

### `users` table

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | Auto-increment |
| `email` | TEXT UNIQUE | |
| `password_hash` | TEXT | bcrypt |
| `name` | TEXT | |
| `role` | TEXT NOT NULL | `'doctor'` or `'clerk'` |
| `created_at` | TIMESTAMPTZ | |

### `patients` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `patient_code` | TEXT UNIQUE | `LFL-XXXXXX` system-generated |
| `name` | TEXT | |
| `phone` | TEXT | |
| `date_of_birth` | DATE | Nullable |
| `created_by` | BIGINT FK → users.id | Nullable |
| `created_at` | TIMESTAMPTZ | |

### `otp_sessions` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `patient_id` | UUID FK → patients.id | |
| `otp_hash` | TEXT | bcrypt hash of the 6-digit OTP |
| `expires_at` | TIMESTAMPTZ | Expires after `PATIENT_JWT_EXPIRE_MINUTES` |
| `used` | BOOLEAN | Set `true` after first verify (replay prevention) |
| `created_at` | TIMESTAMPTZ | |

### `medical_records` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `patient_id` | UUID FK → patients.id | **Active** |
| `uploaded_by` | BIGINT FK → users.id | **Active** |
| `user_id` | BIGINT | ⚠ DORMANT / LEGACY — safe to drop |
| `report_hash` | TEXT | SHA-256 for deduplication |
| `created_at` | TIMESTAMPTZ | |
| *(AI-extracted fields)* | various | Populated by OCR → AI pipeline |

### `consent_requests` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `doctor_id` | BIGINT FK → users.id NOT NULL | |
| `patient_id` | UUID FK → patients.id NOT NULL | |
| `status` | TEXT NOT NULL | `'pending'`, `'approved'`, `'denied'` |
| `requested_at` | TIMESTAMPTZ | |
| `responded_at` | TIMESTAMPTZ | Nullable |
| `expires_at` | TIMESTAMPTZ | Set to `now() + 30 days` on approval |

> **Partial unique index:** `idx_consent_unique_pending` on `(doctor_id, patient_id)` WHERE `status = 'pending'` — prevents duplicate pending rows at DB level.

### `access_logs` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `actor_user_id` | BIGINT | Nullable; set for doctor/clerk actors |
| `actor_patient_id` | UUID | Nullable; set for patient actors |
| `actor_role` | TEXT NOT NULL | `'doctor'`, `'clerk'`, or `'patient'` |
| `action` | TEXT NOT NULL | e.g. `'record_uploaded'`, `'consent_requested'` |
| `patient_id` | UUID FK → patients.id | Nullable; ON DELETE SET NULL |
| `metadata` | JSONB | Optional context (record_id, hash, consent_id, etc.) |
| `created_at` | TIMESTAMPTZ | |

### `reports` table (legacy / orphaned)

No current code reads or writes to it. Disposition (drop, archive, repurpose) is a future decision.

---

## 8. Auth & JWT

### JWT Payload — Doctor / Clerk

```json
{
  "sub": "user@email.com",
  "user_id": 123,
  "role": "doctor",
  "exp": 1234567890
}
```

Expiry: `JWT_EXPIRE_MINUTES` (default **60 min**).

### JWT Payload — Patient

```json
{
  "sub": "LFL-A1B2C3",
  "patient_id": "uuid-here",
  "role": "patient",
  "exp": 1234567890
}
```

Expiry: `PATIENT_JWT_EXPIRE_MINUTES` (default **15 min**). No `user_id` claim.

### Roles & Permissions

| Role | Register via | Create patients | Upload records | Read records | Request consent |
|---|---|---|---|---|---|
| `doctor` | `POST /auth/register` | ✅ | ✅ | ✅ (with consent) | ✅ |
| `clerk` | `POST /auth/register` | ✅ | ✅ | ❌ 403 | ❌ |
| `patient` | OTP flow | — | — | ✅ (own only) | ❌ |

### FastAPI Dependencies

| Dependency | Allows |
|---|---|
| `get_current_user` | Any valid JWT |
| `require_doctor` | `role == "doctor"` only |
| `require_staff` | `role in {"doctor", "clerk"}` |
| `require_patient` | `role == "patient"` only |

### Access Control Gate — `resolve_patient_id()`

Every record-read endpoint (medical-records, timeline, summary, Vitalis chat) goes through `resolve_patient_id()` in `app/services/medical_record_service.py`:

- **patient token** → returns `current_user["patient_id"]` (own records only)
- **doctor token** → requires `patient_id` param; calls `check_doctor_consent()`; raises 403 if no consent
- **clerk token** → raises 403 always
- **unknown role** → raises 403

---

## 9. Key Features Explained

### Smart Upload (OCR → AI → Store)

1. **OCR** — Tesseract (fast) with EasyOCR fallback for low-quality scans
2. **Duplicate check** — SHA-256 hash; returns existing record silently
3. **AI extraction** — Groq LLaMA with strict prompt: `"Return ONLY JSON. Do NOT invent anything."`
   Returns: doctor, hospital, dates, diagnoses, medicines (structured), allergies, lab values (with normal flags), procedures, follow-ups
4. **Structured storage** — saved to DB; original file in Supabase private Storage
5. **Audit log** — written after every successful save (not on duplicate-detection returns)

### Consent System

- `consent_requests` table with status `pending / approved / denied`
- `check_doctor_consent()` queries this table on every record access
- On approval: `expires_at = now() + CONSENT_ACCESS_DURATION_DAYS` (30 days)
- SELECT-first idempotent: `request_consent` returns existing pending row instead of inserting duplicate

### OTP System

- Doctor looks up patient by LFL code → clicks "Request OTP"
- 6-digit code generated, bcrypt-hashed, stored in `otp_sessions`
- Patient shares code with doctor verbally
- Doctor submits code → backend verifies hash → marks `used=True` → issues 15-min patient JWT
- OTP is **single-use**, **bcrypt-hashed**, **never stored in logs**

### Vitalis AI Assistant

1. Fetches all patient's verified records
2. Generates a summary via the summary pipeline
3. Builds a full context block (summary + per-record detail)
4. Sends to AI with instruction: *"Use ONLY the provided patient information. If unavailable, say so."*
5. Vitalis cannot hallucinate patient facts — it only works with what was extracted from real reports

### Health Timeline

All records sorted chronologically, returned as a clean list of medical events — diagnoses, procedures, medications, follow-ups.

### Patient Summary

AI generates a concise, doctor-ready summary from all diagnoses, medicines, allergies, doctors, and hospitals — explicitly forbidden from inventing anything.

---

## 10. Security Model

| Concern | Mitigation |
|---|---|
| Doctor seeing another doctor's patient | Consent check on every record access — no consent = 403 always |
| Patient JWT misused by doctor endpoint | Each JWT has `role` claim; every endpoint checks it explicitly |
| OTP replay attacks | Session marked `used=True` in DB on first verify; second attempt finds no valid session |
| OTP storage | Only bcrypt hash stored; plaintext returned once (demo mode) then discarded |
| Appointment token reuse | Short-lived JWT (10 min, `role="appt_auth"`), accepted only by `POST /appointments` |
| Original file access | Private Supabase Storage bucket; signed URLs with 1-hour expiry, only issued after consent check |
| OTP / token in audit logs | Never. Only record IDs, file names, and hashes are logged |
| Rate limiting | Login: 10/min; OTP request: 5/min; OTP verify: 10/min — all per IP |
| Brute force | Rate limits + bcrypt hashing on all passwords and OTPs |
| Secrets | pydantic-settings reads from `.env`; `.env` is never committed |

---

## 11. Environment Variables

All documented in `.env.example`:

```
APP_NAME=Lifeline Backend
ENVIRONMENT=development
SUPABASE_URL=                       # required
SUPABASE_KEY=                       # required
JWT_SECRET_KEY=                     # required — use: openssl rand -hex 32
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
PATIENT_JWT_EXPIRE_MINUTES=15
CONSENT_ACCESS_DURATION_DAYS=30
LOG_LEVEL=INFO
AI_PROVIDER=groq
GROQ_API_KEY=                       # required if AI_PROVIDER=groq
GROQ_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=                     # optional
OPENROUTER_API_KEY=                 # optional
GOOGLE_VISION_API_KEY=              # ⚠ declared as str (required) but not active — should be Optional[str]
```

Frontend `.env.local` (not committed):

```
VITE_API_URL=http://localhost:8000
```

---

## 12. Integration Plan

The integration work is split across 4 tracks. Backend must be merged before corresponding frontend work begins.

```
BE-1 ──► FE-1
BE-2 ──► FE-2
```

BE-1 and BE-2 can be developed in parallel. FE-1 and FE-2 can be developed in parallel once their BE dependencies are merged. FE-2 reuses `src/api/client.js` and `src/api/records.js` from FE-1.

### Shared API Contract

- All status values **lowercase**: `"pending"`, `"approved"`, `"denied"`, `"upcoming"`, `"completed"`, `"cancelled"`
- Auth header: `Authorization: Bearer <jwt_token>`
- Token stored in `localStorage` under key `lifeline_token`
- Base URL: `import.meta.env.VITE_API_URL` (default `http://localhost:8000`)
- Patient UUID: standard UUID string
- Patient code: `"LFL-J6MTOC"` format
- Doctor/clerk id: integer

---

### BE-1 — Database foundations + Auth + Patient profile

**Goal:** Everything the frontend needs to authenticate real users and display patient profiles.

**Schema changes:**
- `patients`: add `password_hash`, `blood_group`, `email`, `emergency_contacts JSONB`, `conditions JSONB`
- `users`: add `specialization`, `med_reg_no` (unique), `phone`
- New table `medical_registry`: `reg_no TEXT PK`, `claimed BOOLEAN DEFAULT false`

**New / updated endpoints:**
- Update `POST /auth/register` — accept `specialization`, `med_reg_no`, `phone`; validate med_reg_no against registry
- Add `GET /auth/verify-registration?med_reg_no=` — public, instant feedback
- Update `GET /auth/me` — include `specialization`, `phone` for doctors
- Add `POST /patient/register` — claim account with LFL code + password
- Add `POST /patient/login` — LFL code + password → 60-min JWT
- Add `GET /patient/profile` — full patient row (patient JWT)
- Add `PATCH /patient/profile` — update blood_group, email, phone, emergency_contacts, conditions
- Set `CONSENT_ACCESS_DURATION_DAYS=7`

**Status:** `[ ] pending`

---

### BE-2 — AI extraction + File storage + Care plan + Appointments

**Goal:** Enrich the record pipeline; add file persistence, care plan, and appointments.

**Schema changes to `medical_records`:** add `file_name`, `report_type`, `status DEFAULT 'verified'`, `file_url`, `procedures JSONB`, `follow_ups JSONB`

**New tables:**
- `care_plan`: `id, patient_id, category, title, description, due_date, status, priority, source_record_id, created_at`
- `appointments`: `id, patient_id, doctor_id, date, time, location, type, notes, status, created_at`

**New / updated:**
- Update AI extraction prompt to return new JSON shape (medicines and lab_values as structured objects)
- Update Pydantic validator and parser for new fields
- Create Supabase Storage bucket `medical-reports` (private)
- Update upload pipeline: store file, write `file_url`, accept `report_type`, auto-create care plan items from follow-ups
- Update `GET /medical-records` to join `users` and return `uploader_name`
- Add `GET /records/{record_id}/file` — returns signed URL (1-hour expiry)
- Add `GET /care-plan`, `PATCH /care-plan/{id}`
- Add `GET /appointments`, `POST /appointments`, `PATCH /appointments/{id}`, `DELETE /appointments/{id}`

**Status:** `[ ] pending`

---

### FE-1 — Auth rebuild + Doctor portal API wiring

**Dependency:** BE-1 must be merged first.

**Goal:** Replace mock auth with real JWT auth; wire all doctor-facing pages to real API.

**New files:**
- `src/api/client.js` — axios wrapper with auto-auth header, 401/429 handling
- `src/api/auth.js` — `loginDoctor`, `registerDoctor`, `verifyRegistration`, `getMe`
- `src/api/patients.js` — `searchPatients`, `getPatientById`, `createPatient`
- `src/api/records.js` — `getRecords`, `uploadRecord`, `getFileUrl`
- `src/api/consent.js` — `requestConsent`, `getMyAccess`, `getConsentStatus`
- `src/api/appointments.js` — `getAppointments`, `createAppointment`, `updateAppointment`
- `.env.local.example`

**Updated:** `AuthContext.jsx`, `DoctorLoginPage`, `DoctorRegisterPage`, `PatientSearchPage`, `UploadReportPage`, `DoctorRecordsPage`, `DoctorAccessRequestsPage`, `DoctorNotificationsPage`, `DoctorAuditPage`, `DoctorDashboard`, `ProtectedRoute`

**Status:** `[ ] pending`

---

### FE-2 — Patient portal API wiring + Health intelligence pages

**Dependency:** BE-1 and BE-2 must both be merged first.

**Goal:** Wire all patient-facing pages to real backend; replace local Vitalis keyword matcher with real Groq API.

**New files:**
- `src/api/patientAuth.js` — `registerPatient`, `loginPatient`, `getPatientProfile`, `updatePatientProfile`
- `src/api/vitalis.js` — `chatWithVitalis`
- `src/api/timeline.js` — `getTimeline`, `getSummary`
- `src/api/carePlan.js` — `getCarePlan`, `updateCarePlanItem`

**Updated:** All patient pages, `AuthContext.jsx`, `AppDataContext.jsx` (gutted/removed)

**Status:** `[ ] pending`

---

### Things Neither Team Should Touch

- `app/consent/` — consent logic is complete and tested (31 tests pass)
- `app/auth/security.py` — JWT creation/verification works; BE-1 only adds new routes
- `app/api/upload.py` OCR pipeline — BE-2 extends it but does not change the OCR → AI → parse → validate chain
- `src/components/patient/LabChart.jsx` and `LabSparkline.jsx` — chart components are complete; FE-2 just feeds them real data
- `src/components/ProtectedRoute.jsx` — FE-1 updates this once; FE-2 does not touch it

---

## 13. Implementation Status

| Step | Status | Description |
|---|---|---|
| Step 1 | ✅ COMPLETE | DB schema migration — new tables, new columns |
| Step 2 | ✅ COMPLETE | Role-aware authentication (doctor / clerk) |
| Step 3 | ✅ COMPLETE | Patient identity, OTP flow, patient JWT |
| Step 4 | ✅ COMPLETE | Role-aware medical records + access control |
| Step 5 | ✅ COMPLETE | Doctor ↔ patient consent management |
| Step 6 | ✅ COMPLETE | Deployment hardening + upload audit logging |
| Step 7 | ✅ COMPLETE | CORS + rate limiting |
| **Step 8** | ❌ **NOT STARTED** | Scope undefined — see §14 |
| BE-1 | ☐ Pending | Password login, profile endpoints, medical registry |
| BE-2 | ☐ Pending | Care plan, appointments, enriched extraction, file storage |
| FE-1 | ☐ Pending | Doctor portal API wiring |
| FE-2 | ☐ Pending | Patient portal API wiring |

**Backend OpenAPI route count: 21** (verified by static test suite — 213/213 passing)

---

## 14. Known Remaining Work

### Step 8 — NOT STARTED

No scope has been defined. **Do not implement without planning it first.** Plan → approval → validation → implementation.

### Low-priority cleanup

| Item | Notes |
|---|---|
| Add production frontend URL to CORS | Add deployed URL to `allow_origins` in `app/main.py` — one-line change |
| Make `GOOGLE_VISION_API_KEY` Optional | Currently declared as `str` (mandatory) but the path is inactive. Should be `Optional[str] = None` |
| Drop `medical_records.user_id` | Dormant legacy column. Safe to drop via migration — needs explicit approval |
| Retire `reports` table | Orphaned — no code reads or writes to it |
| Delete `backend/s.py` | Broken scratch file in repo root — safe to delete |
| OTP → SMS delivery | Currently returned in API response (demo mode). Production needs an SMS provider |
| Patient JWT refresh | 15-min hard expiry with no refresh — may need re-evaluation for UX |
| Parental / guardian support | Not yet designed |

---

## 15. Coding Conventions

### Python Style

- PEP 8, 4-space indentation, max line length 88 characters
- `snake_case` for variables and functions, `PascalCase` for classes, `UPPER_CASE` for constants

### Folder Responsibilities

| Folder | Purpose |
|---|---|
| `api/routes/` | HTTP endpoints only — no business logic |
| `services/` | Business logic |
| `database/` | Database operations |
| `schemas/` | Pydantic request & response models |
| `models/` | TypedDict DB models |
| `config/` | Settings only |
| `utils/` | Shared helpers |

### Rules

- Routes call services. Services call the database. Never put business logic in routes.
- Use `logger.info()` / `logger.error()` (Loguru). Never use `print()`.
- Never hardcode secrets, URLs, or API keys. Always use `settings.FIELD_NAME`.
- Always raise `HTTPException` for error responses.
- Commit messages: `feat:`, `fix:`, `docs:`, `refactor:`
- Never push directly to `main` without testing.

### API Response Shape

```json
// Success
{ "success": true, "data": {} }

// Error
{ "success": false, "message": "Something went wrong" }
```

---

## 16. Development Constraints

These rules are agreed and must be maintained:

1. **Do not redesign the architecture.** Current architecture is frozen.
2. **Do not refactor working code** unless explicitly instructed.
3. **Preserve Steps 1–7.** Every new change must leave existing behaviour intact.
4. **Make changes incrementally.** App must remain runnable after every step.
5. **No destructive DB operations without explicit approval.** Always show SQL before executing DROP / DELETE / TRUNCATE.
6. **No secrets in code or committed files.** Never commit `.env`.
7. **Do not implement SMS.** OTP stays in demo/API-response mode until further notice.
8. **Validate every step before moving forward.** Syntax check, import chain, route count, behavioural checks.
9. **Stop after each step and wait for approval** before proceeding.
10. **Check existing APIs before creating duplicates.** Check existing DB models before creating new tables/columns.
11. **Do not start Step 8 automatically** without planning it and getting explicit approval.

---

## 17. Demo Credentials & Seed Data

### Getting Started (Frontend)

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
```

### Patients

| Patient ID | Password | Name | Blood Group | DOB |
|---|---|---|---|---|
| `PT-200001` | `patient123` | Aryan Sharma | O+ | 14 Mar 1995 |
| `PT-200002` | `patient123` | Priya Patel | A+ | 22 Jul 1988 |

### Doctors

| Doctor ID | Password | Name | Specialization |
|---|---|---|---|
| `DR-100001` | `doctor123` | Dr. Sarah Kapoor | Cardiology |
| `DR-100002` | `doctor123` | Dr. Raj Mehta | Radiology |
| `DR-100003` | `doctor123` | Dr. Preethi Nair | General Medicine |

### Doctor Registration — Valid Medical Registration Numbers

`MED-REG-001` · `MED-REG-002` · `MED-REG-003` · `MED-REG-004` · `MED-REG-005`

### Seed Reports

| ID | Patient | Type | Date | Uploaded By |
|---|---|---|---|---|
| RPT-001 | PT-200001 | Blood Test (CBC) | 12 Jul 2026 | Dr. Sarah Kapoor |
| RPT-002 | PT-200001 | Radiology (MRI Lumbar) | 2 Mar 2026 | Dr. Raj Mehta |
| RPT-003 | PT-200002 | Prescription | 1 Jun 2026 | Dr. Sarah Kapoor |
| RPT-004 | PT-200001 | Cardiology (ECG Holter) | 18 Jan 2026 | Dr. Sarah Kapoor |
| RPT-005 | PT-200001 | Blood Test (Lipid + Vit D) | 10 Nov 2025 | Dr. Preethi Nair |
| RPT-006 | PT-200002 | Blood Test (HbA1c + Thyroid) | 5 Jul 2026 | Dr. Sarah Kapoor |

### Seed Access Requests

| ID | Patient | Doctor | Status |
|---|---|---|---|
| REQ-001 | PT-200001 | Dr. Raj Mehta | PENDING |

---

## 18. Key Numbers Reference

| Setting | Value |
|---|---|
| Doctor/Clerk JWT expiry | 60 minutes |
| Patient JWT expiry | 15 minutes |
| OTP expiry | 15 minutes |
| Appointment auth token expiry | 10 minutes |
| Signed file URL expiry | 1 hour |
| Consent access duration | 30 days (7 days in integration plan target) |
| OTP rate limit (request) | 5 requests/minute per IP |
| OTP rate limit (verify) | 10 requests/minute per IP |
| Login rate limit | 10 requests/minute per IP |
| OCR engines | 2 (Tesseract primary, EasyOCR fallback) |
| Static validation tests | 213 / 213 passing |
| Backend API routes | 21 |
