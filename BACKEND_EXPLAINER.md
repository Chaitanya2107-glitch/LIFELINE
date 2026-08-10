# Lifeline Backend — Simple Explainer

> Written for a presentation audience. Every answer here maps to something that actually exists in the code.

---

## The one-sentence version

Lifeline is a platform where **doctors securely upload patient medical reports**, the backend **reads and understands them using AI**, and patients can later **chat with an AI assistant (Vitalis)** about their own medical history.

---

## What the backend does (the big picture)

```
Doctor uploads a PDF/image
         │
         ▼
  [1] Read the text out of the file (OCR)
         │
         ▼
  [2] Send the text to an AI model — get back structured data
      (diagnoses, medicines, allergies, lab results…)
         │
         ▼
  [3] Save the structured record to the database
         │
         ▼
  Patient opens the app → asks Vitalis a question
         │
         ▼
  [4] Vitalis reads ALL their records → answers using only real data
```

---

## The tech stack (one line each)

| Piece | What it is |
|---|---|
| **FastAPI** | The Python web framework — handles all HTTP requests |
| **Supabase** | The database (PostgreSQL) + file storage (for the original PDFs) |
| **Tesseract + EasyOCR** | Two OCR engines that read text out of images/PDFs |
| **Groq (LLaMA)** | The AI model that extracts data from text and powers Vitalis |
| **JWT** | Tokens used to prove who you are on every request |

---

## The seven main features

### 1 — Authentication & roles

There are three types of users: **doctors**, **clerks**, and **patients**.

- Doctors and clerks log in with email + password and get a **JWT token** (like a signed badge).
- Patients log in with their **LFL patient code** + password.
- Every API endpoint checks the token and the role before doing anything.
- A doctor token cannot do patient things. A patient token cannot do doctor things.

---

### 2 — Patient consent

A doctor cannot access any patient record without **explicit patient approval**.

1. Doctor sends a consent request.
2. Patient approves or denies it through the app.
3. If approved, the doctor has access for a set number of days.
4. If the consent expires or is denied, access is immediately cut off.

This ensures **no doctor can look at records they haven't been given permission to see**.

---

### 3 — Medical record upload (the "smart upload")

This is the core feature. Here's exactly what happens when a doctor uploads a file:

**Step 1 — OCR (reading the file)**
The backend tries **Tesseract** first (fast, widely used). If that fails or gives a low-confidence result, it automatically falls back to **EasyOCR**. This dual-engine approach means we can read even low-quality scans.

**Step 2 — Duplicate check**
Before doing anything expensive, the backend hashes the text and checks whether this exact report was already uploaded for this patient. If yes, it returns the existing record instead of creating a duplicate.

**Step 3 — AI extraction**
The extracted text is sent to a Groq-hosted LLaMA model with a strict prompt. The model returns a JSON object containing:
- Doctor name, hospital
- Diagnosis
- Medicines (name, dosage, frequency, duration)
- Allergies
- Lab values (with normal/abnormal flags)
- Procedures performed
- Follow-up recommendations

The prompt explicitly instructs the model: **"Return ONLY JSON. Do NOT invent anything."**

**Step 4 — Structured storage**
The structured data is saved to the database. The original file is uploaded to Supabase private storage. Follow-up items are automatically turned into **Care Plan items** for the patient.

**Step 5 — Audit log**
Every upload is recorded: who uploaded it, when, for which patient. The log never stores the file contents.

---

### 4 — OTP (One-Time Password) for appointments

When a doctor books an appointment for a patient, the patient must first **verify it with a one-time code**. This prevents a doctor from booking appointments without patient awareness.

The flow:
1. Doctor finds the patient by LFL code, fills in appointment details.
2. Doctor clicks "Request OTP" — a 6-digit code is generated and sent to the patient.
3. Patient tells the doctor the code.
4. Doctor enters it, gets a **short-lived token (10 minutes)** that is only valid for creating this one appointment.
5. Doctor submits the form — backend validates the token, checks consent, creates the appointment.

The OTP is **single-use**, **bcrypt-hashed in the database**, and **never stored in logs**.

---

### 5 — Health Timeline

The backend takes all of a patient's medical records, sorts them by date, and returns a clean chronological list of medical events. This powers the patient-facing "Health Journey" view.

---

### 6 — Patient Summary

When a doctor (or the system) needs a quick overview of a patient, the backend:
1. Fetches all verified medical records.
2. Collects all diagnoses, medicines, allergies, doctors, and hospitals into a single view.
3. Sends that data to the AI model with the instruction: **"Write a concise, doctor-ready summary using ONLY this information."**

The AI is explicitly forbidden from inventing anything — it can only summarize what is already in the records.

---

### 7 — Vitalis (AI chat assistant)

Vitalis is the patient-facing AI assistant. A patient can ask natural-language questions like *"What medicines am I currently on?"* or *"Have I ever had a blood test come back abnormal?"*.

The backend:
1. Fetches all the patient's verified records.
2. Generates a summary using the same summary pipeline.
3. Builds a full context block (summary + per-record detail) and sends it to the AI.
4. The AI is instructed: **"Use ONLY the provided patient information. If the answer is unavailable, say so."**

This means **Vitalis never hallucinates** facts about the patient — it can only work with what was extracted from real uploaded reports.

---

## Security — the key points judges usually ask about

| Question | Answer |
|---|---|
| How do you stop one doctor from seeing another doctor's patients? | Consent check on every record access — no consent, no access, always a 403 |
| How do you stop a patient JWT being misused by a doctor? | Each JWT has a `role` claim. Every endpoint checks the role explicitly. A patient token is rejected by all staff endpoints |
| What stops OTP replay attacks? | The OTP session is marked `used = True` in the database the moment it is verified. A second use attempt finds no valid session |
| Where is the OTP stored? | Only its **bcrypt hash** is stored. The plaintext is returned once (to the doctor in demo mode) and then discarded |
| Is the appointment token reusable? | No — it is a short-lived JWT (10 minutes, role = `appt_auth`) that is accepted only by `POST /appointments`. All other endpoints reject it |
| How is the original file protected? | Stored in a **private Supabase Storage bucket**. Files are never publicly accessible. Access requires a signed URL that expires after 1 hour, generated only after the consent check passes |
| Are OTPs and tokens stored in audit logs? | Never. Audit metadata contains only record IDs, file names, and hashes |

---

## The data flow for a patient using the app

```
Patient logs in (LFL code + password)
    │
    ▼
Gets a patient JWT (15-min expiry)
    │
    ▼
Views their own records, timeline, care plan
    │
    ▼
Chats with Vitalis
    │ (Vitalis reads all their records, answers using only real data)
    ▼
Manages consent — can approve or deny doctor access requests
```

---

## Numbers worth knowing

- OTP expiry: **15 minutes**
- Appointment auth token expiry: **10 minutes**
- Doctor JWT expiry: **60 minutes**
- Patient JWT expiry: **15 minutes**
- Signed file URL expiry: **1 hour**
- OTP rate limit: **5 requests / minute** (request), **10 / minute** (verify)
- OCR engines: **2** (Tesseract primary, EasyOCR fallback)
- Static validation tests: **213 / 213 passing**

---

## One-liner answers for common judge questions

**"Why FastAPI?"**
FastAPI auto-generates OpenAPI documentation, has built-in async support, and is one of the fastest Python frameworks — ideal for AI-heavy pipelines where we need concurrency.

**"Why Supabase?"**
It gives us a managed PostgreSQL database, file storage, and real-time capabilities in one — no separate infrastructure to manage.

**"What if the AI hallucinates?"**
The extraction prompt has explicit rules: return only what is in the report, return only JSON, do not invent. The structured output is then validated against a strict schema (Pydantic) before being saved. If the AI returns invalid JSON, the upload is rejected with a 400 error.

**"What if OCR fails?"**
There are two OCR engines. If Tesseract fails or returns low-confidence text, EasyOCR runs automatically. If both fail, the upload returns a 400 with a clear error message — no silent data loss.

**"How does the consent system work technically?"**
There is a `consents` table with `status` (pending / approved / denied), `expires_at`, and `doctor_id` + `patient_id`. Every record access goes through `check_doctor_consent()` which queries this table. No consent row, or an expired/denied one, returns 403 immediately.
