# Lifeline — Medical Records Platform

> A full-featured, frontend-only medical records management platform built with React 19, Vite, and Tailwind CSS v4. Lifeline provides two separate authenticated portals — one for patients and one for doctors — with AI-assisted health intelligence, lab trend tracking, care plans, appointment management, and a secure access-request workflow.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Getting Started](#getting-started)
4. [Demo Credentials](#demo-credentials)
5. [Architecture Overview](#architecture-overview)
6. [Data Layer](#data-layer)
7. [Authentication & Session Management](#authentication--session-management)
8. [Patient Portal](#patient-portal)
9. [Doctor Portal](#doctor-portal)
10. [Shared Systems](#shared-systems)
11. [Route Map](#route-map)
12. [Feature Details](#feature-details)
13. [Seed Data Reference](#seed-data-reference)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Routing | React Router v7 |
| Icons | Lucide React v1.28 |
| PDF rendering | react-pdf / pdfjs-dist |
| State management | React Context + useState (no Redux) |
| Data persistence | In-memory only (no backend / localStorage) |

---

## Project Structure

```
src/
├── App.jsx                          # Root router — all routes defined here
├── main.jsx                         # React entry point
│
├── context/
│   ├── AppDataContext.jsx            # Global state: patients, doctors, reports,
│   │                                #   appointments, care plan, access requests,
│   │                                #   audit logs, OTP store, Vitalis history,
│   │                                #   medical registry
│   ├── AuthContext.jsx               # Session management, login/logout, 15-min timeout
│   └── ReportContext.jsx             # (legacy, unused in active routes)
│
├── layouts/
│   ├── PatientLayout.jsx             # Sidebar + main content wrapper for patients
│   └── DoctorLayout.jsx              # Sidebar + main content wrapper for doctors
│
├── components/
│   ├── ProtectedRoute.jsx            # Role-based route guard
│   ├── SessionExpiredBanner.jsx      # Full-screen overlay on inactivity timeout
│   ├── patient/
│   │   ├── PatientSidebar.jsx        # Navigation sidebar for the patient portal
│   │   ├── OTPVerificationModal.jsx  # OTP entry modal
│   │   └── LabSparkline.jsx          # Shared SVG sparkline for lab trend graphs
│   └── doctor/
│       └── DoctorSidebar.jsx         # Navigation sidebar for the doctor portal
│
├── pages/
│   ├── LandingPage.jsx               # Public marketing/home page
│   │
│   ├── patient/
│   │   ├── PatientLoginPage.jsx      # Patient sign-in
│   │   ├── PatientRegisterPage.jsx   # Patient self-registration (new)
│   │   ├── PatientDashboard.jsx      # Main patient dashboard
│   │   ├── PatientReportsPage.jsx    # All verified reports with viewer modal
│   │   ├── PatientProfilePage.jsx    # Profile and account settings
│   │   ├── PatientAccessRequestsPage.jsx  # Approve/deny doctor access requests
│   │   ├── PatientNotificationsPage.jsx   # Notification centre
│   │   ├── PatientOTPPage.jsx        # OTP generation page
│   │   ├── PatientGuidePage.jsx      # Help / onboarding guide
│   │   ├── HealthJourneyPage.jsx     # Chronological medical timeline
│   │   ├── VitalisPage.jsx           # AI health assistant chat interface
│   │   ├── MedicationsPage.jsx       # Extracted medications from reports
│   │   ├── LabTrendsPage.jsx         # Lab biomarker trend graphs
│   │   ├── CarePlanPage.jsx          # Active care plan items
│   │   ├── VisitBriefPage.jsx        # Pre-appointment summary
│   │   ├── AppointmentsPage.jsx      # Upcoming and past appointments
│   │   └── EmergencyProfilePage.jsx  # Emergency contact and critical health info
│   │
│   └── doctor/
│       ├── DoctorLoginPage.jsx       # Doctor sign-in
│       ├── DoctorRegisterPage.jsx    # Doctor self-registration with reg. no. verification (new)
│       ├── DoctorDashboard.jsx       # Main doctor dashboard
│       ├── DoctorRecordsPage.jsx     # All accessible reports with expiry badges (updated)
│       ├── PatientSearchPage.jsx     # Search patients and request access
│       ├── UploadReportPage.jsx      # Upload a new medical report for a patient
│       ├── DoctorAccessRequestsPage.jsx  # Track all access requests
│       ├── DoctorNotificationsPage.jsx   # Notification centre
│       ├── DoctorAuditPage.jsx       # Full audit log viewer
│       └── DoctorProfilePage.jsx     # Doctor profile page
│
└── hooks/ / services/ / utils/      # (reserved — minimal usage currently)
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

The app runs on `http://localhost:5173` by default.

---

## Demo Credentials

### Patients

| Patient ID | Password | Name |
|---|---|---|
| `PT-200001` | `patient123` | Aryan Sharma |
| `PT-200002` | `patient123` | Priya Patel |

### Doctors

| Doctor ID | Password | Name | Specialization |
|---|---|---|---|
| `DR-100001` | `doctor123` | Dr. Sarah Kapoor | Cardiology |
| `DR-100002` | `doctor123` | Dr. Raj Mehta | Radiology |
| `DR-100003` | `doctor123` | Dr. Preethi Nair | General Medicine |

### Doctor Registration — Valid Medical Registration Numbers

When self-registering as a doctor, one of these numbers must be supplied:

`MED-REG-001` · `MED-REG-002` · `MED-REG-003` · `MED-REG-004` · `MED-REG-005`

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  BrowserRouter (App.jsx)                                     │
│  ┌─────────────────────┐   ┌────────────────────────────┐   │
│  │  AppDataProvider    │   │  AuthProvider               │   │
│  │  (global data +     │   │  (currentUser, login,       │   │
│  │   all mutations)    │   │   logout, session timeout)  │   │
│  └─────────────────────┘   └────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │  Patient Portal       │  │  Doctor Portal               │ │
│  │  PatientLayout        │  │  DoctorLayout                │ │
│  │  └ PatientSidebar     │  │  └ DoctorSidebar             │ │
│  │  All routes wrapped   │  │  All routes wrapped          │ │
│  │  by ProtectedRoute    │  │  by ProtectedRoute           │ │
│  │  (requiredRole=       │  │  (requiredRole=              │ │
│  │   "PATIENT")          │  │   "DOCTOR")                  │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                              │
│  Public routes: /, /patient/login, /doctor/login,           │
│                  /patient/register, /doctor/register         │
└──────────────────────────────────────────────────────────────┘
```

---

## Data Layer

All state lives in `AppDataContext.jsx`. There is no backend, no database, and no localStorage — all data resets on page refresh. This is an intentional demo architecture.

### State slices

| State | Type | Description |
|---|---|---|
| `doctors` | `Doctor[]` | All registered doctors (mutable — register adds to this) |
| `patients` | `Patient[]` | All registered patients (mutable — register adds to this) |
| `reports` | `Report[]` | All uploaded medical reports with extracted data |
| `appointments` | `Appointment[]` | All appointments (upcoming + completed) |
| `carePlan` | `CarePlanItem[]` | Active care plan items, auto-generated from report follow-ups |
| `accessRequests` | `AccessRequest[]` | Doctor-to-patient access requests with approval timestamps |
| `auditLogs` | `AuditLog[]` | All login, logout, upload, and session events |
| `otpStore` | `Record<patientId, OTPEntry>` | Active OTP codes with expiry and attempt count |
| `vitalisHistory` | `Record<patientId, Message[]>` | Per-patient Vitalis AI chat history |

### Key derived functions

| Function | Returns |
|---|---|
| `getPatientReports(patientId)` | All reports for a patient |
| `getPatientLabTrends(patientId)` | Lab values grouped by biomarker name, sorted by date |
| `getPatientMedications(patientId)` | Deduplicated medications from all reports |
| `getPatientTimeline(patientId)` | Chronological events from reports (diagnoses, procedures, follow-ups) |
| `getPatientCarePlan(patientId)` | All active care plan items |
| `getPatientAppointments(patientId)` | All appointments |
| `getEmergencyProfile(patientId)` | Critical health info: allergies, conditions, medications, contacts |
| `getPatientVisitBrief(patientId)` | Pre-appointment digest: recent diagnoses, meds, follow-ups |
| `getDoctorAccessibleReports(doctorId)` | Reports the doctor owns + reports from approved access requests |
| `authenticatePatient(id, password)` | Returns the patient object or null |
| `authenticateDoctor(id, password)` | Returns the doctor object or null |
| `registerPatient({ name, email, phone, password })` | Creates and returns a new patient with generated `PT-XXXXXX` ID |
| `registerDoctor({ name, email, phone, specialization, medRegNo, password })` | Verifies registration number, creates doctor with `DR-XXXXXX` ID |
| `uploadReport(reportData, doctor)` | Adds report and auto-generates care plan items from follow-ups |
| `respondToAccessRequest(requestId, decision)` | Stamps `approvedAt` + `expiresAt` (7 days) on approval |
| `generateOTP(patientId)` | Returns a 6-digit OTP valid for 12 minutes, max 3 attempts |

### Data shapes

```js
// Patient
{ id, name, dob, bloodGroup, phone, email, password, specialCode,
  otpSecret, emergencyProfile: { allergies, conditions, emergencyContacts } }

// Doctor
{ id, name, specialization, email, phone, password, medRegNo? }

// Report
{ reportId, patientId, uploadedBy, uploaderName, reportType, fileName,
  uploadedAt, status, summary[], extracted: { diagnoses[], medications[],
  allergies[], procedures[], labValues[], followUps[], dates, doctors[], hospitals[] } }

// AccessRequest
{ requestId, patientId, doctorId, doctorName, requestedAt, status,
  approvedAt, expiresAt, reportIds[] }

// CarePlanItem
{ itemId, patientId, category, title, description, dueDate, status,
  sourceReportId, priority }

// Appointment
{ appointmentId, patientId, doctorId, doctorName, specialization,
  date, time, location, type, notes, status }
```

---

## Authentication & Session Management

Handled by `AuthContext.jsx`, which wraps `AppDataProvider` inside `BrowserRouter`.

- **Login:** Calls `authenticatePatient` or `authenticateDoctor` from `AppDataContext`, then calls `login(user)` which sets `currentUser` and writes an audit log entry.
- **Logout:** Manual (sidebar button) or automatic on session expiry.
- **Session timeout:** 15 minutes of inactivity (`mousemove`, `keydown`, `click`, `touchstart` events reset the timer). On expiry, `currentUser` is cleared, an audit log is written, and `SessionExpiredBanner` displays a full-screen modal.
- **Route guarding:** `ProtectedRoute` checks `currentUser` and `currentUser.role`. If a patient tries to access a doctor route, they are redirected to their own dashboard (and vice versa).
- **OTP:** Patients can generate a 6-digit OTP code valid for 12 minutes with a maximum of 3 attempts before lockout. Used as a shareable access code for doctors.

```
currentUser shape:
{ id, role: "PATIENT" | "DOCTOR", name, displayId, bloodGroup?, specialization? }
```

---

## Patient Portal

### Dashboard (`/patient/dashboard`)

The central hub for patients. Displays:

- **Header** with patient name, ID, and blood group.
- **Security notice** — reminder that all reports are doctor-verified.
- **Stats grid** — Medical Reports count, Upcoming Appointments, Active Care Plan Items, Pending Access Requests.
- **Lab Progress widget** — shows up to 3 biomarkers (abnormal-first) with inline SVG sparkline graphs, latest value, and normal/attention badge. Only visible when lab data exists.
- **Recent Reports** panel — last 3 reports with type and doctor name.
- **Access Requests** panel — pending doctor access requests needing review.
- **Health Features grid** — cards linking to all 10 sub-features.

### Reports (`/patient/reports`)

Full list of all verified reports. Each report card shows the report type, uploading doctor, date, and status. A "View Report" button opens a full-screen modal viewer that supports PDF (via iframe), images (with zoom), and a structured HTML fallback showing extracted lab values, diagnoses, procedures, recommendations, and the AI summary panel.

### Vitalis AI Assistant (`/patient/vitalis`)

A chat interface powered by a keyword-matching response engine (no real API). Vitalis has full access to the patient's reports, timeline, medications, and lab trends in context. It can:

- Summarise health records
- List and explain lab values
- List current medications with dosages
- Explain specific reports
- Show pending follow-ups
- Narrate the health timeline
- Detect and refuse diagnosis-seeking questions with a safe fallback

Suggested prompt chips are shown when the conversation is empty or in early stages. Conversation history is persisted per-patient within the session via `vitalisHistory` state.

### Health Journey (`/patient/journey`)

A chronological timeline built from all extracted report data — diagnoses, procedures, medications started, and follow-ups. Events are sorted by date and grouped by type with coloured indicators.

### Lab Trends (`/patient/labs`)

All lab biomarkers extracted from reports, displayed as cards. Each card shows:
- Biomarker name + trend direction icon (↑↓—)
- Reference range (from a built-in lookup table for 10 common markers)
- Latest value with normal/attention badge
- SVG sparkline showing value history (via shared `LabSparkline` component)
- Historical readings table in reverse-chronological order

Filter tabs: All / Needs Attention / Normal.

### Medications (`/patient/medications`)

All medications extracted from verified reports, deduplicated by name. Shows dosage, frequency, duration, and refill date where available.

### Care Plan (`/patient/care-plan`)

Active and pending care plan items, automatically generated when a doctor uploads a report with follow-up instructions. Items can be marked complete. Each item has a priority (High / Medium / Low), category (Follow-up / Screening / Monitoring / Preventive), optional due date, and a link back to the source report.

### Appointments (`/patient/appointments`)

Upcoming and completed appointments with doctor name, specialization, location, date, time, type, and notes.

### Visit Brief (`/patient/visit-brief`)

A pre-appointment digest showing the patient's most recent diagnoses, current medications, pending follow-ups, and upcoming appointments — designed for quick review before seeing a doctor.

### Emergency Profile & Family Group (`/patient/emergency`)

Critical health information for emergency scenarios:
- Blood group and date of birth (prominent on a red card)
- Known allergies (highlighted with warning styling)
- Active medical conditions
- Current medications (extracted from reports)
- Emergency contacts with name, relation, and clickable phone links

Data is compiled from the patient's `emergencyProfile` object and their report history.

### Access Requests (`/patient/access-requests`)

List of all doctor access requests with APPROVE / DENY actions. Approving stamps `approvedAt = now` and `expiresAt = now + 7 days` on the request, granting the doctor time-limited access to the patient's reports.

### Profile (`/patient/profile`)

Account information view: name, patient ID, date of birth, blood group, contact details, and the special OTP code.

### Notifications (`/patient/notifications`)

Notification centre for new reports, access requests, and reminders.

---

## Doctor Portal

### Dashboard (`/doctor/dashboard`)

- Stats: Total Uploads, Pending Requests, Approved Access count, Total Patients
- Recent Uploads (last 4)
- Access Requests summary (last 4 with status badges)
- Recent Activity from the audit log (last 5 entries with timestamp)

### Medical Records (`/doctor/records`)

Two categories of records are shown:

1. **Own uploads** — reports this doctor uploaded. No expiry.
2. **Approved-access reports** — reports belonging to patients who approved this doctor's access request.

For approved-access reports, an **expiry badge** is displayed based on the access request's `expiresAt`:

| Time remaining | Badge colour | Text |
|---|---|---|
| > 2 days | Yellow | "Expires in N days" |
| 1–2 days | Orange | "Expires in N days" |
| Expired | Red | "Access Expired" |

Opening any approved-access report in the viewer modal shows a **warning banner** below the header:
- Near expiry: amber bar — "Approved access expires in N days…"
- Expired: red bar — "Your approved access to this report has expired. The patient would need to re-approve."

The report remains viewable regardless of expiry status (access is informational, not technically enforced in the demo).

### Patient Search (`/doctor/patients`)

Search all patients by name or ID. From a result, the doctor can view the patient's public profile and send an access request.

### Upload Report (`/doctor/upload`)

Form for uploading a medical report for a patient. The doctor selects report type, patient ID, and fills in extracted data fields (diagnoses, medications, lab values, follow-ups, etc.). On submit, the report is added to `reports` state and care plan items are auto-generated from follow-ups.

### Access Requests (`/doctor/access-requests`)

Track all of this doctor's access requests with status (PENDING / APPROVED / DENIED) and request dates.

### Audit Log (`/doctor/audit`)

Full chronological log of all actions this doctor has taken: logins, logouts, uploads, access requests, session expirations.

### Notifications (`/doctor/notifications`)

Notification centre for approved/denied access requests and other events.

### Profile (`/doctor/profile`)

Doctor account info: name, ID, specialization, contact details.

---

## Shared Systems

### Registration

Both portals now have self-registration pages:

**Patient** (`/patient/register`): Name, email, phone number, password, confirm password. On success, a unique `PT-XXXXXX` ID is generated and displayed — the patient uses this ID to sign in.

**Doctor** (`/doctor/register`): Name, email, phone, specialization (dropdown of 11 options), medical registration number, password, confirm password. The medical registration number is validated against `MOCK_MEDICAL_REGISTRY` in `AppDataContext`. If valid and unclaimed, a `DR-XXXXXX` ID is generated. If invalid, an error is shown.

### LabSparkline Component

`src/components/patient/LabSparkline.jsx` — a reusable SVG sparkline that renders a line + dot series for an array of lab values. Props: `values`, `normal` (bool, controls green/red colour), `width` (default 160), `height` (default 48). Used by both `LabTrendsPage` and the dashboard lab widget.

### Session Expired Banner

A fixed full-screen overlay (`SessionExpiredBanner.jsx`) that renders on top of everything when `sessionExpired` is true in `AuthContext`. Prompts the user to click through to login. Cleared by `acknowledgeExpiry()`.

### Protected Routes

All patient and doctor routes are wrapped in `ProtectedRoute`:
- No user → redirect to `/login`
- Wrong role → redirect to the user's own dashboard

---

## Route Map

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

## Feature Details

### Lab Diagnosis Graphs

Lab values are extracted from reports into `extracted.labValues[]`. The `getPatientLabTrends` function groups these by biomarker name and sorts by date, building a multi-point history for each marker.

The dashboard shows up to 3 markers (abnormal-first) as inline cards with sparklines. The full `/patient/labs` page shows all markers with reference range overlays, filtering, and the historical readings table.

Reference ranges are defined in `LabTrendsPage.jsx` for: Haemoglobin, WBC, Platelets, Total Cholesterol, LDL, HDL, HbA1c, Fasting Glucose, TSH, Vitamin D.

### 7-Day Access Expiry

When a patient approves a doctor's access request, `respondToAccessRequest` stamps:
```js
approvedAt: nowISO()
expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
```

`DoctorRecordsPage` computes days remaining live (at render time from `Date.now()`) using `getExpiryInfo(expiresAt)` and displays coloured countdown badges on the record cards and a warning banner inside the viewer modal.

### Auto Care Plan Generation

When a doctor uploads a report with follow-up instructions, `uploadReport` automatically creates one `CarePlanItem` per follow-up entry with status `"Pending"` and a link back to the source report ID.

### OTP System

`generateOTP(patientId)` returns the patient's fixed `otpSecret` (6 digits) and stores it with a 12-minute expiry. `verifyOTP(patientId, code)` enforces expiry, a maximum of 3 wrong attempts, and single-use (marks `used: true` on success).

---

## Seed Data Reference

### Patients

| ID | Name | Blood Group | DOB |
|---|---|---|---|
| PT-200001 | Aryan Sharma | O+ | 14 Mar 1995 |
| PT-200002 | Priya Patel | A+ | 22 Jul 1988 |

### Doctors

| ID | Name | Specialization |
|---|---|---|
| DR-100001 | Dr. Sarah Kapoor | Cardiology |
| DR-100002 | Dr. Raj Mehta | Radiology |
| DR-100003 | Dr. Preethi Nair | General Medicine |

### Reports

| ID | Patient | Type | Date | Uploaded By |
|---|---|---|---|---|
| RPT-001 | PT-200001 | Blood Test (CBC) | 12 Jul 2026 | Dr. Sarah Kapoor |
| RPT-002 | PT-200001 | Radiology (MRI Lumbar) | 2 Mar 2026 | Dr. Raj Mehta |
| RPT-003 | PT-200002 | Prescription | 1 Jun 2026 | Dr. Sarah Kapoor |
| RPT-004 | PT-200001 | Cardiology (ECG Holter) | 18 Jan 2026 | Dr. Sarah Kapoor |
| RPT-005 | PT-200001 | Blood Test (Lipid + Vit D) | 10 Nov 2025 | Dr. Preethi Nair |
| RPT-006 | PT-200002 | Blood Test (HbA1c + Thyroid) | 5 Jul 2026 | Dr. Sarah Kapoor |

### Access Requests

| ID | Patient | Doctor | Status |
|---|---|---|---|
| REQ-001 | PT-200001 | Dr. Raj Mehta | PENDING |
