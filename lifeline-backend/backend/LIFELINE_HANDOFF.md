# Lifeline — Project Handoff Document

> **Generated after Step 7 completion.**
> Steps 1–7 are COMPLETE and validated.
> **Step 8 has NOT been implemented.**
> Current OpenAPI route count: **21**

---

## 1. Project Overview

**Lifeline** is an AI-assisted medical record management and emergency-response application.

### Purpose

The backend provides:

- Secure, role-separated medical record management
- Doctor/hospital-controlled record uploads (not patient-controlled)
- OCR + AI extraction pipeline for uploaded medical documents
- Doctor ↔ patient consent gating for record access
- Patient identification via unique patient codes (LFL-XXXXXX) + OTP sessions
- Medical timeline, AI doctor summary, and Vitalis AI assistant
- Full audit trail via access_logs
- CORS for frontend browser access
- Rate limiting on brute-force-sensitive endpoints

### Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Framework | FastAPI |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| OTP | bcrypt-hashed 6-digit codes stored in `otp_sessions` |
| OCR | Tesseract via pytesseract |
| AI | Groq (llama-3.1-8b-instant), optional Gemini / OpenRouter |
| Rate limiting | slowapi 0.1.9 (in-process, per-IP) |
| Logging | Loguru |
| Settings | pydantic-settings |
| Deployment | Railway (Linux) |

---

## 2. Current Completion Status

| Step | Status | Description |
|---|---|---|
| Step 1 | ✅ COMPLETE | DB schema migration — new tables, new columns |
| Step 2 | ✅ COMPLETE | Role-aware authentication (doctor / clerk) |
| Step 3 | ✅ COMPLETE | Patient identity, OTP flow, patient JWT |
| Step 4 | ✅ COMPLETE | Role-aware medical records + access control |
| Step 5 | ✅ COMPLETE | Doctor ↔ patient consent management |
| Step 6 | ✅ COMPLETE | Deployment hardening + upload audit logging |
| Step 7 | ✅ COMPLETE | CORS + rate limiting |
| **Step 8** | ❌ **NOT STARTED** | (see §9 — no scope defined yet) |

**Steps 1–7 are COMPLETE and validated. Step 8 has NOT been implemented.**

**OpenAPI route count: 21** (verified by static grep after Step 7).

---

## 3. Step-by-Step History

### Step 1 — Database / Schema Foundation

Created the following tables in Supabase via SQL migration:

- `patients` — UUID PK, patient_code (LFL-XXXXXX), name, phone, date_of_birth, created_by → users.id
- `otp_sessions` — UUID PK, patient_id → patients.id, otp_hash (bcrypt), expires_at, used BOOLEAN
- `consent_requests` — UUID PK, doctor_id → users.id, patient_id → patients.id, status, requested_at, responded_at, expires_at
- `access_logs` — UUID PK, actor_user_id BIGINT OR actor_patient_id UUID (never both), actor_role, action, patient_id, metadata JSONB

Added columns to **`medical_records`**:
- `patient_id UUID FK → patients.id` — new ownership field
- `uploaded_by BIGINT FK → users.id` — which staff member uploaded

Added column to **`users`**:
- `role TEXT NOT NULL` — values: `'doctor'` or `'clerk'`

Preserved legacy column `medical_records.user_id` (dormant, not queried — see §9).

### Step 2 — Role-Aware Authentication

- `app/auth/schemas.py` — added `role` field to `RegisterRequest` and `UserResponse`
- `app/auth/routes.py` — `role` written to DB on register; `role` included in JWT payload on login
- `app/auth/security.py` — added `require_doctor`, `require_staff`, `require_patient` FastAPI dependencies; `create_access_token` accepts optional `expire_minutes` override
- `app/config/settings.py` — added `PATIENT_JWT_EXPIRE_MINUTES = 15`
- `app/models/user.py` — `UserRecord` TypedDict

### Step 3 — Patient Identity & OTP

- `app/models/patient.py` — `PatientRecord` TypedDict
- `app/utils/patient_code.py` — `generate_patient_code()` produces `LFL-XXXXXX`
- `app/patients/` — full package: `__init__.py`, `schemas.py`, `service.py`, `routes.py`
  - Patient CRUD (staff-only): create, get by UUID, get by patient code
  - OTP flow (public): `POST /patient/request-otp`, `POST /patient/verify-otp`
  - OTP is bcrypt-hashed in `otp_sessions`; marked `used=True` after successful verify to prevent replay
  - On success, issues a **patient JWT** with `role='patient'`, `patient_id` (UUID), `sub=patient_code`, expiry = `PATIENT_JWT_EXPIRE_MINUTES` (15 min)
- `app/main.py` — `patients_router` and `patient_otp_router` registered

### Step 4 — Medical Records & Access Control

- `app/services/medical_record_service.py` — all queries migrated from `user_id` to `patient_id`; `check_doctor_consent()` and `resolve_patient_id()` added (the single access-control gate)
- `app/api/upload.py` — `require_staff` dependency; `patient_id` Form field added; `patient_id` + `uploaded_by` written to record; patient existence validated before OCR
- `app/timeline/routes.py` + `service.py` — `resolve_patient_id()` gating
- `app/summary/routes.py` + `service.py` — same
- `app/vitalis/routes.py` + `service.py` — same

### Step 5 — Consent Management

- `app/models/consent.py` — `ConsentRecord` TypedDict
- `app/services/audit_service.py` — `write_access_log()` with silent-catch exception handling
- `app/consent/` — full package: `__init__.py`, `schemas.py`, `service.py`, `routes.py`
  - 5 endpoints (see §6)
  - `request_consent` is SELECT-first idempotent (returns existing pending row instead of inserting duplicate)
  - On approval: `expires_at = now() + CONSENT_ACCESS_DURATION_DAYS` (30 days default)
  - `write_access_log` called on consent_requested, consent_approved, consent_denied
- `app/config/settings.py` — added `CONSENT_ACCESS_DURATION_DAYS = 30`
- `app/main.py` — `consent_router` registered

### Step 6 — Deployment Hardening & Audit

- `app/ai/tesseract_engine.py` — `pytesseract.tesseract_cmd` only set when `sys.platform == "win32"`; on Linux/Railway, Tesseract is found via PATH with no override
- `.env.example` — all 16 settings keys documented with inline comments
- `app/upload/routes.py` — **RETIRED**: replaced with docstring-only notice; no imports, no routes, never registered in `main.py`
- `app/api/upload.py` — `write_access_log(action="record_uploaded")` added after every successful `save_medical_record()` call; positioned after the duplicate-return early exit so duplicates are not audited as uploads

### Step 7 — CORS + Rate Limiting

- `requirements.txt` — added `slowapi==0.1.9`
- `app/utils/limiter.py` — **new file**: singleton `Limiter(key_func=get_remote_address)`
- `app/main.py` — added `CORSMiddleware` and `SlowAPIMiddleware` + `RateLimitExceeded` handler
- `app/auth/routes.py` — `@limiter.limit("10/minute")` on `POST /auth/login`; `request: Request` added to signature
- `app/patients/routes.py` — `@limiter.limit("5/minute")` on `POST /patient/request-otp`; `@limiter.limit("10/minute")` on `POST /patient/verify-otp`; `request: Request` added to both signatures

#### CORS configuration (exact, as committed)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> **To add the production frontend URL:** edit the `allow_origins` list in `app/main.py` lines 26–29 and add the deployed URL. No other changes are needed.

#### Rate limits (exact, as committed)

| Endpoint | Limit | Key |
|---|---|---|
| `POST /auth/login` | 10/minute | per IP |
| `POST /patient/request-otp` | 5/minute | per IP |
| `POST /patient/verify-otp` | 10/minute | per IP |

Exceeding a limit returns HTTP **429** with a `Retry-After` header (handled by `_rate_limit_exceeded_handler`).

---

## 4. Exact Current Architecture

### Directory Structure

```
backend/
├── .env.example                         # all 16 keys documented
├── requirements.txt                     # includes slowapi==0.1.9 (Step 7)
├── app/
│   ├── main.py                          # FastAPI app + CORS + rate-limit middleware + router registration
│   ├── config/
│   │   └── settings.py                  # pydantic-settings, .env loader
│   ├── auth/
│   │   ├── routes.py                    # POST /auth/register, /auth/login (rate-limited), GET /auth/me
│   │   ├── schemas.py                   # RegisterRequest, LoginRequest, TokenResponse
│   │   └── security.py                  # JWT create/verify, get_current_user,
│   │                                    # require_doctor, require_staff, require_patient
│   ├── models/
│   │   ├── user.py                      # UserRecord TypedDict
│   │   ├── patient.py                   # PatientRecord TypedDict
│   │   └── consent.py                   # ConsentRecord TypedDict
│   ├── patients/
│   │   ├── __init__.py
│   │   ├── schemas.py                   # Pydantic request/response schemas
│   │   ├── service.py                   # DB CRUD + OTP create/verify
│   │   └── routes.py                    # /patients/* (staff) + /patient/* (public OTP, rate-limited)
│   ├── consent/
│   │   ├── __init__.py
│   │   ├── schemas.py
│   │   ├── service.py                   # consent CRUD + audit calls
│   │   └── routes.py                    # 5 consent endpoints
│   ├── services/
│   │   ├── medical_record_service.py    # CRUD + resolve_patient_id + check_doctor_consent
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
│       ├── limiter.py                   # slowapi Limiter singleton (Step 7)
│       ├── logger.py                   # Loguru setup
│       ├── hash.py                     # SHA-256 report dedup
│       └── patient_code.py              # LFL-XXXXXX generator
```

### JWT Payload Structure

**Doctor / Clerk token** (issued by `POST /auth/login`):
```json
{
  "sub": "user@email.com",
  "user_id": 123,
  "role": "doctor",
  "exp": 1234567890
}
```
Expiry: `JWT_EXPIRE_MINUTES` (default 60 min).

**Patient token** (issued by `POST /patient/verify-otp`):
```json
{
  "sub": "LFL-A1B2C3",
  "patient_id": "uuid-here",
  "role": "patient",
  "exp": 1234567890
}
```
Expiry: `PATIENT_JWT_EXPIRE_MINUTES` (default 15 min). No `user_id` claim.

### Roles and Permissions

| Role | Register via | Can create patients | Can upload records | Can read records | Can request consent |
|---|---|---|---|---|---|
| `doctor` | `POST /auth/register` | ✅ | ✅ | ✅ (with consent) | ✅ |
| `clerk` | `POST /auth/register` | ✅ | ✅ | ❌ 403 | ❌ |
| `patient` | OTP flow (no password) | — | — | ✅ (own only) | ❌ |

### FastAPI Dependencies

| Dependency | Defined in | Allows |
|---|---|---|
| `get_current_user` | `app/auth/security.py` | Any valid JWT (doctor, clerk, patient) |
| `require_doctor` | `app/auth/security.py` | `role == "doctor"` only |
| `require_staff` | `app/auth/security.py` | `role in {"doctor", "clerk"}` |
| `require_patient` | `app/auth/security.py` | `role == "patient"` only |

### Key Service Functions

#### `resolve_patient_id(current_user, patient_id_param)` — `app/services/medical_record_service.py`

The **single access-control gate** used by every record-read endpoint (medical-records, timeline, summary, Vitalis chat).

- **patient token** → returns `current_user["patient_id"]` (own records only; query param ignored)
- **doctor token** → requires `patient_id_param`; calls `check_doctor_consent()`; raises 403 if no consent; returns `patient_id_param`
- **clerk token** → raises 403
- **unknown role** → raises 403

#### `check_doctor_consent(doctor_id, patient_id)` — `app/services/medical_record_service.py`

Returns `True` if the doctor holds an approved, unexpired consent for the patient. Performs two DB queries: one for rows with `expires_at IS NULL`, one for rows with `expires_at > now()`.

#### `write_access_log(...)` — `app/services/audit_service.py`

Inserts one row into `access_logs`. Wraps the insert in `try/except`; logs the error via Loguru but **never raises**. A log-write failure cannot crash any calling operation.

Called at:
- `consent_service.request_consent` → action `"consent_requested"`
- `consent_service.respond_to_consent` → action `"consent_approved"` or `"consent_denied"`
- `app/api/upload.py` after `save_medical_record()` → action `"record_uploaded"` (not called on duplicate-detection early return)

---

## 5. Current API Endpoints (All 21 Routes)

### Authentication (`/auth`)

| # | Method | Path | Auth required | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 1 | POST | `/auth/register` | None | — | None | Register a new doctor or clerk (password-based) |
| 2 | POST | `/auth/login` | None | — | **10/min/IP** | Login; returns doctor/clerk JWT |
| 3 | GET | `/auth/me` | JWT | any | None | Return decoded JWT payload (identity check) |

### Patient Identity & OTP (`/patients`, `/patient`)

| # | Method | Path | Auth required | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 4 | POST | `/patients/` | JWT | staff | None | Create a new patient; returns PatientRecord with generated LFL-XXXXXX code |
| 5 | GET | `/patients/code/{patient_code}` | JWT | staff | None | Look up patient by LFL-XXXXXX code |
| 6 | GET | `/patients/{patient_id}` | JWT | staff | None | Look up patient by UUID |
| 7 | POST | `/patient/request-otp` | None | — | **5/min/IP** | Patient requests OTP by their patient_code; returns OTP in response (demo mode) |
| 8 | POST | `/patient/verify-otp` | None | — | **10/min/IP** | Patient verifies OTP; returns 15-min patient JWT |

### Upload & Medical Records (`/upload`, `/medical-records`)

| # | Method | Path | Auth required | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 9 | POST | `/upload` | JWT | staff | None | Upload report file for a patient; runs OCR → AI extraction → save; deduplicates; audits on success |
| 10 | GET | `/medical-records` | JWT | doctor (with consent) or patient | None | Retrieve records — patient sees own; doctor needs consent + patient_id param; clerk → 403 |

### Timeline

| # | Method | Path | Auth required | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 11 | GET | `/timeline/` | JWT | doctor (consent) or patient | None | Medical timeline — same role/consent rules as /medical-records |

### Summary

| # | Method | Path | Auth required | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 12 | GET | `/summary/` | JWT | doctor (consent) or patient | None | AI doctor summary — same role/consent rules |

### Vitalis AI Assistant

| # | Method | Path | Auth required | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 13 | POST | `/vitalis/chat` | JWT | doctor (consent) or patient | None | Chat with Vitalis using patient records as context |

### Consent Management (`/consent`)

| # | Method | Path | Auth required | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 14 | POST | `/consent/request` | JWT | doctor | None | Doctor requests access to patient's history; SELECT-first idempotent |
| 15 | GET | `/consent/pending` | JWT | patient | None | Patient views all pending consent requests |
| 16 | GET | `/consent/my-access` | JWT | doctor | None | Doctor views all their own consent requests (all statuses) |
| 17 | GET | `/consent/status/{patient_id}` | JWT | doctor | None | Doctor checks whether they currently hold approved consent for a patient |
| 18 | POST | `/consent/{consent_id}/respond` | JWT | patient | None | Patient approves or denies a pending consent request |

### Root / Health

| # | Method | Path | Auth required | Role | Rate limit | Purpose |
|---|---|---|---|---|---|---|
| 19 | GET | `/` | None | — | None | Root — returns `{"message": "Backend Running"}` |
| 20 | GET | `/health` | None | — | None | Health check — returns `{"status": "healthy"}` |
| 21 | GET | `/db-status` | None | — | None | DB connectivity check |

---

## 6. Current Database State

### `users` table

| Column | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | Auto-increment |
| `email` | TEXT UNIQUE | |
| `password_hash` | TEXT | bcrypt |
| `name` | TEXT | |
| `role` | TEXT NOT NULL | `'doctor'` or `'clerk'` — added Step 2 |
| `created_at` | TIMESTAMPTZ | |

### `patients` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Auto-generated |
| `patient_code` | TEXT UNIQUE | `LFL-XXXXXX` — system-generated |
| `name` | TEXT | |
| `phone` | TEXT | |
| `date_of_birth` | DATE | Nullable |
| `created_by` | BIGINT FK → users.id | Nullable; which staff created the patient |
| `created_at` | TIMESTAMPTZ | |

### `otp_sessions` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `patient_id` | UUID FK → patients.id | |
| `otp_hash` | TEXT | bcrypt hash of the 6-digit OTP |
| `expires_at` | TIMESTAMPTZ | OTP expires after `PATIENT_JWT_EXPIRE_MINUTES` |
| `used` | BOOLEAN | Set to `true` after first successful verify (replay prevention) |
| `created_at` | TIMESTAMPTZ | |

### `medical_records` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `patient_id` | UUID FK → patients.id | **Active** — added Step 1 |
| `uploaded_by` | BIGINT FK → users.id | **Active** — added Step 1; which staff uploaded |
| `user_id` | BIGINT | ⚠ **DORMANT / LEGACY** — added before Step 1; not queried; safe to drop in future |
| `report_hash` | TEXT | SHA-256 for deduplication |
| `created_at` | TIMESTAMPTZ | |
| *(AI-extracted fields)* | various | Populated by the OCR→AI pipeline |

### `consent_requests` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `doctor_id` | BIGINT FK → users.id NOT NULL | |
| `patient_id` | UUID FK → patients.id NOT NULL | |
| `status` | TEXT NOT NULL | `'pending'`, `'approved'`, `'denied'` |
| `requested_at` | TIMESTAMPTZ | |
| `responded_at` | TIMESTAMPTZ | Nullable |
| `expires_at` | TIMESTAMPTZ | Nullable; set to `now() + 30 days` on approval |

**Partial unique index:** `idx_consent_unique_pending` on `(doctor_id, patient_id)` WHERE `status = 'pending'` — prevents duplicate pending rows at DB level.

### `access_logs` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `actor_user_id` | BIGINT | Nullable; set for doctor/clerk actors |
| `actor_patient_id` | UUID | Nullable; set for patient actors. Exactly one of these two must be non-null per row. |
| `actor_role` | TEXT NOT NULL | `'doctor'`, `'clerk'`, or `'patient'` |
| `action` | TEXT NOT NULL | e.g. `'record_uploaded'`, `'consent_requested'`, `'consent_approved'`, `'consent_denied'` |
| `patient_id` | UUID FK → patients.id | Nullable; ON DELETE SET NULL |
| `metadata` | JSONB | Optional context (record_id, report_hash, consent_id, etc.) |
| `created_at` | TIMESTAMPTZ | |

### `reports` table (legacy / orphaned)

| Status | Notes |
|---|---|
| ⚠ **ORPHANED** | Was written by the retired `app/upload/routes.py` (pre-Step-4). No current code reads or writes to it. Disposition (drop, archive, repurpose) is a future decision. |

---

## 7. Important Implementation Details

### CORS (Step 7)

`CORSMiddleware` is registered in `app/main.py` **before** routers:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

To add the deployed production frontend URL, append it to the `allow_origins` list. No other change is needed.

### Rate Limiting (Step 7)

`slowapi` `SlowAPIMiddleware` is registered in `app/main.py`. The singleton `Limiter` lives in `app/utils/limiter.py` and is imported by the route modules that use it. Three endpoints are decorated:

- `POST /auth/login` — `@limiter.limit("10/minute")` in `app/auth/routes.py`
- `POST /patient/request-otp` — `@limiter.limit("5/minute")` in `app/patients/routes.py`
- `POST /patient/verify-otp` — `@limiter.limit("10/minute")` in `app/patients/routes.py`

All three require `request: Request` as the **first parameter** of the route function (slowapi requirement for IP extraction). This is present and committed.

### Tesseract Path (Linux/Windows)

`app/ai/tesseract_engine.py` sets `pytesseract.tesseract_cmd` **only** when `sys.platform == "win32"`:

```python
if sys.platform == "win32":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
```

On Linux (Railway/production), Tesseract is on PATH and no override is needed.

### Retired `app/upload/routes.py`

This file is **a docstring-only retirement notice** — no imports, no FastAPI router, no route decorators. It is **never imported by `main.py`**. Do not re-register it. The active upload endpoint is `app/api/upload.py`.

### OTP Security Model

- OTP is 6 digits, bcrypt-hashed before storage
- Sessions expire after `PATIENT_JWT_EXPIRE_MINUTES` (15 min by default)
- `used=True` is set immediately on first successful verification (replay prevention)
- The plaintext OTP is returned in the API response (demo mode; production should send via SMS)

### Patient Token Expiry

Patient JWT has a **15-minute expiry** (configurable via `PATIENT_JWT_EXPIRE_MINUTES`). There is no refresh mechanism — the patient must re-authenticate via OTP.

### Consent Expiry

Approved consent grants expire after `CONSENT_ACCESS_DURATION_DAYS` (30 days, configurable). `check_doctor_consent()` enforces this in real time on every protected record-read call.

---

## 8. Required Environment Variables

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
GOOGLE_VISION_API_KEY=              # ⚠ declared as str (required) but not active — see §9
```

---

## 9. Known Remaining Work

### Step 8 — NOT STARTED

No scope has been defined for Step 8. Do not assume any specific content.

**Do not implement Step 8 without planning it first.** Plan → approval → validation → implementation.

### Later / Low Priority

| Item | Notes |
|---|---|
| Add production frontend URL to CORS | When the frontend team provides the deployed URL, add it to the `allow_origins` list in `app/main.py`. No other changes needed. |
| Make `GOOGLE_VISION_API_KEY` Optional | Currently declared as `str` (mandatory) in `settings.py` but the Google Vision path is not active in the OCR pipeline. Should be `Optional[str] = None`. |
| Drop `medical_records.user_id` | Dormant legacy column from pre-Step-1. Safe to drop via Supabase SQL migration. Requires explicit approval and a reviewed migration statement. |
| Retire / drop `reports` table | Orphaned — no code reads or writes to it. Decision: drop entirely, or repurpose for raw file references. |
| Delete `s.py` | Broken scratch file in repo root (`backend/s.py`). Safe to delete. |
| Parental / guardian guide | Not yet designed. Do not implement until requirements are finalized. |
| OTP → SMS delivery | Currently OTP is returned in the API response (demo mode). Production should integrate an SMS provider. |
| Refresh token for patients | Patient JWT is 15-min hard expiry with no refresh. May need re-evaluation for UX. |

---

## 10. Frontend Integration Notes

### CORS

The backend currently allows these origins:

```
http://localhost:3000
http://localhost:5173
```

`allow_credentials=True` is set, so the frontend **must** include `credentials: 'include'` (fetch) or `withCredentials: true` (axios) when making requests that require the Authorization header cookie. For bearer-token auth (Authorization header), this is not strictly required but the header value `allow_credentials=True` still enables it.

When the frontend is deployed, provide the production URL to the backend developer. It is a one-line change in `app/main.py`.

### Authentication flow

1. Staff (doctor/clerk): `POST /auth/login` → receive JWT → send as `Authorization: Bearer <token>` on all subsequent requests.
2. Patient: `POST /patient/request-otp` (by patient_code) → receive OTP → `POST /patient/verify-otp` → receive 15-min JWT → send as `Authorization: Bearer <token>`.

### Rate limit responses

If the frontend exceeds a rate limit, the API returns:
```
HTTP 429 Too Many Requests
Retry-After: <seconds>
```
The frontend should surface a user-friendly message and honour the `Retry-After` header before retrying.

---

## 11. Development Constraints (Always Apply)

These rules were agreed at the start of the project and must be maintained:

1. **Do not redesign the architecture unnecessarily.** The current architecture is frozen.
2. **Do not refactor working code** unless explicitly instructed.
3. **Preserve Steps 1–7.** Every new change must leave existing behaviour intact.
4. **Make changes incrementally.** The app must remain runnable after every step.
5. **No destructive DB operations without explicit approval.** Always show the migration SQL before executing DROP / DELETE / TRUNCATE.
6. **No secrets in code or committed files.** Never commit `.env`.
7. **Do not implement SMS.** OTP stays in demo/API-response mode until further notice.
8. **Validate every step before moving forward.** Syntax check, import chain, route count, behavioural checks.
9. **Stop after each step and wait for approval** before proceeding to the next.
10. **Check existing APIs before creating duplicates.** Check existing DB models before creating new tables/columns.
11. **Do not start Step 8 automatically** without planning it and getting explicit approval.

---

## 12. Git State at Handoff

Branch: `main`

**Committed in this handoff commit (Steps 1–7 + updated handoff):**

Modified files:
- `app/auth/routes.py` — Step 7: rate limit on login, consolidated imports
- `app/main.py` — Step 7: CORS + slowapi middleware
- `app/patients/routes.py` — Step 7: rate limits on OTP endpoints
- `requirements.txt` — Step 7: added slowapi==0.1.9

New files:
- `app/utils/limiter.py` — Step 7: slowapi Limiter singleton
- `LIFELINE_HANDOFF.md` — updated handoff (this file)

All Steps 1–6 changes (previously uncommitted) are also included in this commit.

---

## 13. Handoff Instructions

> **When continuing this project in a new account, read this file first.**
>
> Steps 1–7 are COMPLETE and validated. Step 8 has NOT been implemented.
>
> Before writing any code:
> 1. Confirm what Step 8 should contain (scope is undefined).
> 2. Write the plan and wait for explicit approval before touching any files.
>
> Current route count is **21**. Middleware and structural changes must not alter this count unless new routes are explicitly added as part of the approved scope.
>
> The codebase is in `backend/` (workspace root is `backend/`).
> The FastAPI entry point is `app/main.py`.
> All `.env` values are documented in `.env.example`.
> The CORS `allow_origins` list is in `app/main.py` lines 26–29.
> Rate-limit decorators are in `app/auth/routes.py` and `app/patients/routes.py`.
