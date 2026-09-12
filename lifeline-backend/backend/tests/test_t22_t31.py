"""
Integration tests T-22 -> T-29
Lifeline Backend -- Testing/Validation phase

Changes from original (T-22 -> T-31):
  T-30 REMOVED -- POST /patient/request-otp no longer exists.
  T-31 REMOVED -- POST /patient/verify-otp no longer exists.
  Patient token bootstrap now uses POST /patient/login (LFL code + password).

State used:
  Doctor  : doc_c4b43e39@lifeline-test.com  (id=17)
  Clerk   : clerk_c4b43e39@lifeline-test.com (id=18)
  Patient : LFL-J6MTOC  (id=d07a5673-b987-4138-b814-1393071110d3)
  Consent : approved, expires 2026-09-08
  Record  : 7b2fcb69-2841-4332-bce8-d0c8bc121915  (seeded for above patient)

Run with:
  venv\\Scripts\\python.exe tests\\test_t22_t31.py
"""

import json
import requests

BASE         = "http://localhost:8000"
PATIENT_ID   = "d07a5673-b987-4138-b814-1393071110d3"
PATIENT_CODE = "LFL-J6MTOC"
PATIENT_PASS = "TestPass123!"
DOCTOR_EMAIL = "doc_c4b43e39@lifeline-test.com"
DOCTOR_PASS  = "TestPass123!"
CLERK_EMAIL  = "clerk_c4b43e39@lifeline-test.com"
CLERK_PASS   = "TestPass123!"

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

results = []


def log(test_id, name, expected, r, assert_fn):
    """Evaluate, print, and store a test result."""
    try:
        body = r.json()
    except Exception:
        body = r.text

    passed = False
    try:
        passed = assert_fn(r, body)
    except Exception as e:
        print(f"  {YELLOW}Assertion error: {e}{RESET}")

    icon = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    results.append({"id": test_id, "name": name, "expected": expected,
                    "status": r.status_code, "passed": passed})

    print(f"\n{'-'*62}")
    print(f"{BOLD}{test_id} -- {name}{RESET}  [{icon}]")
    print(f"  Expected : {expected}")
    print(f"  HTTP     : {r.status_code}")
    snippet = json.dumps(body, indent=2)[:800] if isinstance(body, (dict, list)) else str(body)[:800]
    print(f"  Body     : {snippet}")
    return passed


# =============================================================================
# BOOTSTRAP -- fresh tokens
# =============================================================================

print(f"\n{BOLD}{'='*62}")
print("BOOTSTRAP -- acquiring tokens")
print(f"{'='*62}{RESET}")

r = requests.post(f"{BASE}/auth/login",
                  json={"email": DOCTOR_EMAIL, "password": DOCTOR_PASS})
assert r.status_code == 200, f"Doctor login failed: {r.status_code} {r.text}"
DOCTOR_TOKEN = r.json()["access_token"]
print(f"  {GREEN}OK{RESET} Doctor token")

r = requests.post(f"{BASE}/auth/login",
                  json={"email": CLERK_EMAIL, "password": CLERK_PASS})
assert r.status_code == 200, f"Clerk login failed: {r.status_code} {r.text}"
CLERK_TOKEN = r.json()["access_token"]
print(f"  {GREEN}OK{RESET} Clerk token")

# Patient now logs in with LFL code + password (no OTP round-trip needed)
r = requests.post(f"{BASE}/patient/login",
                  json={"lfl_code": PATIENT_CODE, "password": PATIENT_PASS})
assert r.status_code == 200, f"Patient login failed: {r.status_code} {r.text}"
PATIENT_TOKEN = r.json()["access_token"]
print(f"  {GREEN}OK{RESET} Patient token  (patient_id={PATIENT_ID})")

H_DOC = {"Authorization": f"Bearer {DOCTOR_TOKEN}"}
H_CLK = {"Authorization": f"Bearer {CLERK_TOKEN}"}
H_PAT = {"Authorization": f"Bearer {PATIENT_TOKEN}"}

# =============================================================================
# T-22 -- Doctor reads medical records after consent
# =============================================================================

print(f"\n{BOLD}{'='*62}")
print("T-22 -> T-26 : Medical records / Timeline / Summary / Vitalis")
print(f"{'='*62}{RESET}")

r = requests.get(f"{BASE}/medical-records",
                 params={"patient_id": PATIENT_ID},
                 headers=H_DOC)
log("T-22", "Doctor reads medical records after consent",
    "HTTP 200 -- list, len >= 1",
    r,
    lambda resp, body: resp.status_code == 200
        and isinstance(body, list)
        and len(body) >= 1)

r = requests.get(f"{BASE}/timeline/",
                 params={"patient_id": PATIENT_ID},
                 headers=H_DOC)
log("T-23", "Doctor timeline",
    "HTTP 200 -- {timeline: [...]}, len >= 1",
    r,
    lambda resp, body: resp.status_code == 200
        and isinstance(body, dict)
        and "timeline" in body
        and len(body["timeline"]) >= 1)

r = requests.get(f"{BASE}/timeline/",
                 headers=H_PAT)
log("T-24", "Patient timeline (own records)",
    "HTTP 200 -- {timeline: [...]}, len >= 1",
    r,
    lambda resp, body: resp.status_code == 200
        and isinstance(body, dict)
        and "timeline" in body
        and len(body["timeline"]) >= 1)

r = requests.get(f"{BASE}/summary/",
                 params={"patient_id": PATIENT_ID},
                 headers=H_DOC,
                 timeout=90)
log("T-25", "Doctor medical summary (Groq AI)",
    "HTTP 200 -- {summary: '<non-empty AI text>'}",
    r,
    lambda resp, body: resp.status_code == 200
        and isinstance(body, dict)
        and isinstance(body.get("summary"), str)
        and len(body["summary"].strip()) > 20)

r = requests.post(f"{BASE}/vitalis/chat",
                  params={"patient_id": PATIENT_ID},
                  json={"question": "What diagnoses does this patient have?"},
                  headers=H_DOC,
                  timeout=90)
log("T-26", "Vitalis chat (Groq AI)",
    "HTTP 200 -- {answer: '<non-empty AI text>'}",
    r,
    lambda resp, body: resp.status_code == 200
        and isinstance(body, dict)
        and isinstance(body.get("answer"), str)
        and len(body["answer"].strip()) > 20)

# =============================================================================
# T-27 / T-28 -- CORS preflight
# =============================================================================

print(f"\n{BOLD}{'='*62}")
print("T-27 -> T-28 : CORS preflight")
print(f"{'='*62}{RESET}")

ALLOWED_ORIGIN = "http://localhost:3000"
r = requests.options(
    f"{BASE}/auth/login",
    headers={
        "Origin": ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    },
)
log("T-27", "CORS preflight -- allowed origin (localhost:3000)",
    "HTTP 200, Access-Control-Allow-Origin: http://localhost:3000",
    r,
    lambda resp, body: resp.status_code in (200, 204)
        and resp.headers.get("access-control-allow-origin") == ALLOWED_ORIGIN)

BAD_ORIGIN = "http://evil.example.com"
r = requests.options(
    f"{BASE}/auth/login",
    headers={
        "Origin": BAD_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    },
)
log("T-28", "CORS preflight -- disallowed origin (evil.example.com)",
    "No Access-Control-Allow-Origin header (origin rejected)",
    r,
    lambda resp, body: resp.headers.get("access-control-allow-origin") != BAD_ORIGIN)

# =============================================================================
# T-29 -- Login rate limit (10/minute)
# Note: T-30 and T-31 (OTP rate limit tests) removed.
#       POST /patient/request-otp and /patient/verify-otp no longer exist.
# =============================================================================

print(f"\n{BOLD}{'='*62}")
print("T-29 : Rate limiting")
print(f"{'='*62}{RESET}")

print("\n  T-29: Hammering POST /auth/login (limit: 10/minute) ...")
last_status = None
got_429 = False
for i in range(15):
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": "probe@example.com",
                            "password": "wrongpass"})
    last_status = r.status_code
    if r.status_code == 429:
        got_429 = True
        print(f"    attempt {i+1} -> {RED}429{RESET} (rate limited) OK")
        break
    else:
        print(f"    attempt {i+1} -> {r.status_code}")


class FakeResp:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body
    def json(self):
        return self._body
    text = ""


log("T-29", "Login rate limit triggers 429",
    "HTTP 429 after <= 10 attempts",
    FakeResp(429 if got_429 else last_status, {"detail": "Rate limited" if got_429 else "Not rate-limited"}),
    lambda resp, body: got_429)

# =============================================================================
# RESULTS TABLE
# =============================================================================

print(f"\n\n{'='*62}")
print(f"{BOLD}RESULTS SUMMARY -- T-22 -> T-29{RESET}")
print(f"{'='*62}")
print(f"{'ID':<8} {'Name':<44} {'HTTP':<6} {'Result'}")
print(f"{'-'*62}")

batch_a = [t for t in results if t["id"] in ("T-22", "T-23", "T-24", "T-25", "T-26")]
batch_b = [t for t in results if t["id"] in ("T-27", "T-28")]
batch_c = [t for t in results if t["id"] in ("T-29",)]

for group, label in [(batch_a, "Medical Records / Timeline / Summary / Vitalis"),
                     (batch_b, "CORS"),
                     (batch_c, "Rate Limiting")]:
    print(f"\n  {BOLD}-- {label} --{RESET}")
    for t in group:
        icon = f"{GREEN}PASS{RESET}" if t["passed"] else f"{RED}FAIL{RESET}"
        print(f"  {t['id']:<8} {t['name']:<44} {str(t['status']):<6} {icon}")

total  = len(results)
passed = sum(1 for t in results if t["passed"])
colour = GREEN if passed == total else RED
print(f"\n  {colour}{passed}/{total} tests passed{RESET}")
print(f"{'='*62}\n")
