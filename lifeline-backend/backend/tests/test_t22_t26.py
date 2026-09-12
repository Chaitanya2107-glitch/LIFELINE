"""
Integration tests T-22 → T-26
Run with: python tests/test_t22_t26.py
"""

import sys
import json
import requests

BASE = "http://localhost:8000"

# ─── ANSI colours ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

results = []


def log_result(test_id, name, expected, actual_status, actual_body, passed):
    status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    results.append({
        "id": test_id,
        "name": name,
        "expected": expected,
        "actual_status": actual_status,
        "passed": passed,
    })
    print(f"\n{'─'*60}")
    print(f"{BOLD}{test_id} — {name}{RESET}  [{status}]")
    print(f"  Expected : {expected}")
    print(f"  HTTP     : {actual_status}")
    try:
        parsed = json.loads(actual_body) if isinstance(actual_body, (str, bytes)) else actual_body
        print(f"  Body     : {json.dumps(parsed, indent=4)[:800]}")
    except Exception:
        print(f"  Body     : {str(actual_body)[:800]}")


# ─── Bootstrap: get fresh doctor token ───────────────────────────────────────

print(f"\n{BOLD}=== Bootstrapping: doctor login ==={RESET}")
DOCTOR_EMAIL = input("Doctor email: ").strip()
DOCTOR_PASS  = input("Doctor password: ").strip()

r = requests.post(f"{BASE}/auth/login", json={"email": DOCTOR_EMAIL, "password": DOCTOR_PASS})
assert r.status_code == 200, f"Doctor login failed: {r.status_code} {r.text}"
DOCTOR_TOKEN = r.json()["access_token"]
print(f"  {GREEN}Doctor token acquired{RESET}")

# Get doctor's consent history to find a consented patient
r2 = requests.get(f"{BASE}/consent/my-access",
                  headers={"Authorization": f"Bearer {DOCTOR_TOKEN}"})
assert r2.status_code == 200, f"my-access failed: {r2.status_code}"
consents = r2.json()
approved = [c for c in consents if c.get("status") == "approved"]
assert approved, "No approved consent found for this doctor. Run consent tests first."
PATIENT_ID = approved[0]["patient_id"]
print(f"  Patient ID (from approved consent): {PATIENT_ID}")

# ─── Bootstrap: get fresh patient token ──────────────────────────────────────

print(f"\n{BOLD}=== Bootstrapping: patient OTP ==={RESET}")
PATIENT_CODE = input("Patient code (LFL-XXXXXX): ").strip()

r3 = requests.post(f"{BASE}/patient/request-otp", json={"patient_code": PATIENT_CODE})
assert r3.status_code == 200, f"OTP request failed: {r3.status_code} {r3.text}"
OTP = r3.json()["otp"]
print(f"  OTP: {OTP}")

r4 = requests.post(f"{BASE}/patient/verify-otp", json={"patient_code": PATIENT_CODE, "otp": OTP})
assert r4.status_code == 200, f"OTP verify failed: {r4.status_code} {r4.text}"
PATIENT_TOKEN = r4.json()["access_token"]
print(f"  {GREEN}Patient token acquired{RESET}")

# ─── T-22: Doctor reads medical records after consent ────────────────────────

print(f"\n{BOLD}=== T-22: Doctor reads medical records after consent ==={RESET}")
r = requests.get(
    f"{BASE}/medical-records",
    params={"patient_id": PATIENT_ID},
    headers={"Authorization": f"Bearer {DOCTOR_TOKEN}"},
)
passed = (r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) > 0)
log_result(
    "T-22", "Doctor reads medical records after consent",
    "HTTP 200 — list of records (non-empty)",
    r.status_code, r.text, passed,
)

# Save a record id for context
RECORDS = r.json() if r.status_code == 200 else []

# ─── T-23: Doctor timeline ────────────────────────────────────────────────────

print(f"\n{BOLD}=== T-23: Doctor timeline ==={RESET}")
r = requests.get(
    f"{BASE}/timeline/",
    params={"patient_id": PATIENT_ID},
    headers={"Authorization": f"Bearer {DOCTOR_TOKEN}"},
)
body = r.json() if r.status_code == 200 else r.text
passed = (r.status_code == 200 and "timeline" in (body if isinstance(body, dict) else {}))
log_result(
    "T-23", "Doctor timeline",
    "HTTP 200 — {\"timeline\": [...]}",
    r.status_code, r.text, passed,
)

# ─── T-24: Patient timeline ───────────────────────────────────────────────────

print(f"\n{BOLD}=== T-24: Patient timeline ==={RESET}")
r = requests.get(
    f"{BASE}/timeline/",
    headers={"Authorization": f"Bearer {PATIENT_TOKEN}"},
)
body = r.json() if r.status_code == 200 else r.text
passed = (r.status_code == 200 and "timeline" in (body if isinstance(body, dict) else {}))
log_result(
    "T-24", "Patient timeline (own records)",
    "HTTP 200 — {\"timeline\": [...]}",
    r.status_code, r.text, passed,
)

# ─── T-25: Doctor medical summary (Groq) ────────────────────────────────────

print(f"\n{BOLD}=== T-25: Doctor medical summary via Groq ==={RESET}")
r = requests.get(
    f"{BASE}/summary/",
    params={"patient_id": PATIENT_ID},
    headers={"Authorization": f"Bearer {DOCTOR_TOKEN}"},
    timeout=60,
)
body = r.json() if r.status_code == 200 else r.text
passed = (
    r.status_code == 200
    and "summary" in (body if isinstance(body, dict) else {})
    and len(body.get("summary", "")) > 10
)
log_result(
    "T-25", "Doctor medical summary (Groq AI)",
    "HTTP 200 — {\"summary\": \"<non-empty AI text>\"}",
    r.status_code, r.text, passed,
)

# ─── T-26: Vitalis chat (Groq) ───────────────────────────────────────────────

print(f"\n{BOLD}=== T-26: Vitalis chat via Groq ==={RESET}")
r = requests.post(
    f"{BASE}/vitalis/chat",
    params={"patient_id": PATIENT_ID},
    json={"question": "What diagnoses does this patient have?"},
    headers={"Authorization": f"Bearer {DOCTOR_TOKEN}"},
    timeout=60,
)
body = r.json() if r.status_code == 200 else r.text
passed = (
    r.status_code == 200
    and "answer" in (body if isinstance(body, dict) else {})
    and len(body.get("answer", "")) > 10
)
log_result(
    "T-26", "Vitalis chat (Groq AI)",
    "HTTP 200 — {\"answer\": \"<non-empty AI text>\"}",
    r.status_code, r.text, passed,
)

# ─── Summary table ───────────────────────────────────────────────────────────

print(f"\n\n{'═'*60}")
print(f"{BOLD}RESULTS SUMMARY — T-22 → T-26{RESET}")
print(f"{'═'*60}")
print(f"{'ID':<8} {'Name':<45} {'Status':<6} {'Pass?'}")
print(f"{'─'*60}")
for r_ in results:
    icon = f"{GREEN}PASS{RESET}" if r_["passed"] else f"{RED}FAIL{RESET}"
    print(f"{r_['id']:<8} {r_['name']:<45} {str(r_['actual_status']):<6} {icon}")

total  = len(results)
passed = sum(1 for r_ in results if r_["passed"])
print(f"\n  {GREEN}{passed}/{total} tests passed{RESET}")
print(f"{'═'*60}\n")
