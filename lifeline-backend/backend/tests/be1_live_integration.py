"""
BE-1 Live Integration Test — runs test_t22_t31.py scenarios via ASGI TestClient.
Covers T-22 through T-31 plus additional auth/consent/RBAC scenarios.

Does NOT require a running server — uses FastAPI TestClient against real Supabase.

Run: venv/Scripts/python.exe -m tests.be1_live_integration
"""

import sys
import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

DOCTOR_EMAIL = "doc_c4b43e39@lifeline-test.com"
DOCTOR_PASS  = "TestPass123!"
CLERK_EMAIL  = "clerk_c4b43e39@lifeline-test.com"
CLERK_PASS   = "TestPass123!"
PATIENT_CODE = "LFL-J6MTOC"
PATIENT_ID   = "d07a5673-b987-4138-b814-1393071110d3"

GREEN = "\033[92m"
RED   = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"
BOLD  = "\033[1m"

passed = 0
failed = 0
results = []


def check(test_id, label, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  {GREEN}PASS{RESET}  [{test_id}] {label}")
        passed += 1
    else:
        print(f"  {RED}FAIL{RESET}  [{test_id}] {label}" + (f"\n        {detail}" if detail else ""))
        failed += 1
    results.append({"id": test_id, "label": label, "passed": condition})


# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== BOOTSTRAP — acquire all tokens ==={RESET}")
# ═══════════════════════════════════════════════════════

r = client.post("/auth/login", json={"email": DOCTOR_EMAIL, "password": DOCTOR_PASS})
check("BOOT-1", "Doctor login -> 200 + access_token", r.status_code == 200 and "access_token" in r.json(),
      f"HTTP {r.status_code}: {r.text[:200]}")
DOCTOR_TOKEN = r.json().get("access_token") if r.status_code == 200 else None

r = client.post("/auth/login", json={"email": CLERK_EMAIL, "password": CLERK_PASS})
check("BOOT-2", "Clerk login -> 200 + access_token", r.status_code == 200 and "access_token" in r.json(),
      f"HTTP {r.status_code}: {r.text[:200]}")
CLERK_TOKEN = r.json().get("access_token") if r.status_code == 200 else None

r = client.post("/patient/request-otp", json={"patient_code": PATIENT_CODE})
check("BOOT-3", "OTP request -> 200 + otp", r.status_code == 200 and "otp" in r.json(),
      f"HTTP {r.status_code}: {r.text[:200]}")
OTP = r.json().get("otp") if r.status_code == 200 else None

r = client.post("/patient/verify-otp", json={"patient_code": PATIENT_CODE, "otp": OTP})
check("BOOT-4", "OTP verify -> 200 + access_token", r.status_code == 200 and "access_token" in r.json(),
      f"HTTP {r.status_code}: {r.text[:200]}")
PATIENT_TOKEN = r.json().get("access_token") if r.status_code == 200 else None

if not all([DOCTOR_TOKEN, CLERK_TOKEN, PATIENT_TOKEN]):
    print(f"\n{RED}Bootstrap FAILED — cannot proceed without all tokens{RESET}")
    sys.exit(1)

H_DOC = {"Authorization": f"Bearer {DOCTOR_TOKEN}"}
H_CLK = {"Authorization": f"Bearer {CLERK_TOKEN}"}
H_PAT = {"Authorization": f"Bearer {PATIENT_TOKEN}"}
print(f"  {GREEN}All 3 tokens acquired{RESET}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== T-22 to T-26: Medical records / Timeline / Summary / Vitalis ==={RESET}")
# ═══════════════════════════════════════════════════════

# T-22: Doctor reads medical records after consent
r = client.get("/medical-records", params={"patient_id": PATIENT_ID}, headers=H_DOC)
body = r.json() if r.status_code == 200 else r.text
check("T-22", "Doctor reads medical records after consent (200, non-empty list)",
      r.status_code == 200 and isinstance(body, list) and len(body) >= 1,
      f"HTTP {r.status_code}: {str(body)[:200]}")

# T-22b: Medical records have BE-2 fields
if r.status_code == 200 and isinstance(body, list) and body:
    first = body[0]
    check("T-22b", "Medical record has uploader_name (BE-2 join)",
          "uploader_name" in first)
    check("T-22c", "Medical record has status field (BE-2)",
          "status" in first)
    check("T-22d", "Medical record does NOT leak raw 'users' key",
          "users" not in first)

# T-22-CLERK: Clerk cannot read medical records (403)
r = client.get("/medical-records", params={"patient_id": PATIENT_ID}, headers=H_CLK)
check("T-22-CLERK", "Clerk cannot read medical records -> 403",
      r.status_code == 403, f"HTTP {r.status_code}: {r.text[:100]}")

# T-22-UNAUTH: No token -> 401 (HTTPBearer returns 401 "Not authenticated" per RFC 7235)
r = client.get("/medical-records", params={"patient_id": PATIENT_ID})
check("T-22-UNAUTH", "No auth token -> 401",
      r.status_code == 401, f"HTTP {r.status_code}: {r.text[:100]}")

# T-23: Doctor timeline
r = client.get("/timeline/", params={"patient_id": PATIENT_ID}, headers=H_DOC)
body = r.json() if r.status_code == 200 else r.text
check("T-23", "Doctor timeline -> 200, {timeline: [...]}, len >= 1",
      r.status_code == 200 and isinstance(body, dict) and "timeline" in body and len(body["timeline"]) >= 1,
      f"HTTP {r.status_code}: {str(body)[:200]}")

# T-24: Patient timeline (own records)
r = client.get("/timeline/", headers=H_PAT)
body = r.json() if r.status_code == 200 else r.text
check("T-24", "Patient timeline (own records) -> 200, {timeline: [...]}",
      r.status_code == 200 and isinstance(body, dict) and "timeline" in body,
      f"HTTP {r.status_code}: {str(body)[:200]}")

# T-24-CLERK: Clerk cannot read timeline
r = client.get("/timeline/", params={"patient_id": PATIENT_ID}, headers=H_CLK)
check("T-24-CLERK", "Clerk timeline -> 403",
      r.status_code == 403, f"HTTP {r.status_code}: {r.text[:100]}")

# T-25: Doctor medical summary (Groq AI)
r = client.get("/summary/", params={"patient_id": PATIENT_ID}, headers=H_DOC, timeout=90)
body = r.json() if r.status_code == 200 else r.text
check("T-25", "Doctor medical summary (Groq AI) -> 200, {summary: non-empty string}",
      r.status_code == 200 and isinstance(body, dict) and isinstance(body.get("summary"), str) and len(body["summary"].strip()) > 20,
      f"HTTP {r.status_code}: {str(body)[:200]}")

# T-26: Vitalis chat (Groq AI)
r = client.post("/vitalis/chat", params={"patient_id": PATIENT_ID},
                json={"question": "What diagnoses does this patient have?"},
                headers=H_DOC, timeout=90)
body = r.json() if r.status_code == 200 else r.text
check("T-26", "Vitalis chat (Groq AI) -> 200, {answer: non-empty string}",
      r.status_code == 200 and isinstance(body, dict) and isinstance(body.get("answer"), str) and len(body["answer"].strip()) > 20,
      f"HTTP {r.status_code}: {str(body)[:200]}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== Auth / RBAC ==={RESET}")
# ═══════════════════════════════════════════════════════

# GET /auth/me with doctor token
r = client.get("/auth/me", headers=H_DOC)
body = r.json() if r.status_code == 200 else r.text
check("AUTH-1", "GET /auth/me with doctor token -> 200, {user: {...}}",
      r.status_code == 200 and isinstance(body, dict) and "user" in body,
      f"HTTP {r.status_code}: {str(body)[:200]}")
if r.status_code == 200:
    check("AUTH-2", "GET /auth/me user has role=doctor",
          body.get("user", {}).get("role") == "doctor")

# GET /auth/me with clerk token
r = client.get("/auth/me", headers=H_CLK)
check("AUTH-3", "GET /auth/me with clerk token -> 200",
      r.status_code == 200, f"HTTP {r.status_code}: {r.text[:100]}")
if r.status_code == 200:
    check("AUTH-4", "Clerk user has role=clerk",
          r.json().get("user", {}).get("role") == "clerk")

# Bad password -> 401
r = client.post("/auth/login", json={"email": DOCTOR_EMAIL, "password": "wrongpassword!"})
check("AUTH-5", "Bad password -> 401",
      r.status_code == 401, f"HTTP {r.status_code}: {r.text[:100]}")

# Unknown email -> 401
r = client.post("/auth/login", json={"email": "nobody@nowhere.com", "password": "pass"})
check("AUTH-6", "Unknown email -> 401",
      r.status_code == 401, f"HTTP {r.status_code}: {r.text[:100]}")

# Invalid JWT -> 401 (get_current_user raises 401 "Invalid or expired token" per security.py)
r = client.get("/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
check("AUTH-7", "Invalid JWT -> 401",
      r.status_code == 401, f"HTTP {r.status_code}: {r.text[:100]}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== OTP flow edge cases ==={RESET}")
# ═══════════════════════════════════════════════════════

# Unknown patient_code -> 404
r = client.post("/patient/request-otp", json={"patient_code": "LFL-XXXXXX"})
check("OTP-1", "OTP request for unknown patient_code -> 404",
      r.status_code == 404, f"HTTP {r.status_code}: {r.text[:100]}")

# Wrong OTP -> 401
r = client.post("/patient/verify-otp", json={"patient_code": PATIENT_CODE, "otp": "000000"})
check("OTP-2", "Wrong OTP -> 401",
      r.status_code == 401, f"HTTP {r.status_code}: {r.text[:100]}")

# OTP response includes expires_in_minutes
r = client.post("/patient/request-otp", json={"patient_code": PATIENT_CODE})
check("OTP-3", "OTP request response includes expires_in_minutes",
      r.status_code == 200 and isinstance(r.json().get("expires_in_minutes"), int),
      f"{r.text[:200]}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== Patient profile ==={RESET}")
# ═══════════════════════════════════════════════════════

# GET /patient/profile
r = client.get("/patient/profile", headers=H_PAT)
body = r.json() if r.status_code == 200 else r.text
check("PROF-1", "Patient profile -> 200",
      r.status_code == 200, f"HTTP {r.status_code}: {str(body)[:200]}")
if r.status_code == 200:
    check("PROF-2", "Profile has id, patient_code, name",
          all(k in body for k in ("id", "patient_code", "name")))
    check("PROF-3", "Profile does NOT expose password_hash",
          "password_hash" not in body)

# Staff cannot use /patient/profile endpoint
r = client.get("/patient/profile", headers=H_DOC)
check("PROF-4", "Doctor cannot use /patient/profile -> 403",
      r.status_code == 403, f"HTTP {r.status_code}: {r.text[:100]}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== Patient CRUD (staff) ==={RESET}")
# ═══════════════════════════════════════════════════════

# GET /patients/{patient_id}
r = client.get(f"/patients/{PATIENT_ID}", headers=H_DOC)
body = r.json() if r.status_code == 200 else r.text
check("PAT-1", "GET /patients/{id} with doctor -> 200",
      r.status_code == 200, f"HTTP {r.status_code}: {str(body)[:200]}")

# GET /patients/code/{code}
r = client.get(f"/patients/code/{PATIENT_CODE}", headers=H_CLK)
body = r.json() if r.status_code == 200 else r.text
check("PAT-2", "GET /patients/code/{code} with clerk -> 200",
      r.status_code == 200 and body.get("patient_code") == PATIENT_CODE,
      f"HTTP {r.status_code}: {str(body)[:200]}")

# Patient cannot access /patients/ CRUD
r = client.get(f"/patients/{PATIENT_ID}", headers=H_PAT)
check("PAT-3", "Patient cannot access /patients/{id} -> 403",
      r.status_code == 403, f"HTTP {r.status_code}: {r.text[:100]}")

# Unknown patient UUID -> 404
r = client.get("/patients/00000000-0000-0000-0000-000000000000", headers=H_DOC)
check("PAT-4", "Unknown patient_id -> 404",
      r.status_code == 404, f"HTTP {r.status_code}: {r.text[:100]}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== Consent lifecycle ==={RESET}")
# ═══════════════════════════════════════════════════════

# GET /consent/my-access — doctor views own consent history
r = client.get("/consent/my-access", headers=H_DOC)
body = r.json() if r.status_code == 200 else r.text
check("CON-1", "Doctor GET /consent/my-access -> 200, list",
      r.status_code == 200 and isinstance(body, list),
      f"HTTP {r.status_code}: {str(body)[:200]}")

# GET /consent/pending — patient views pending requests
r = client.get("/consent/pending", headers=H_PAT)
check("CON-2", "Patient GET /consent/pending -> 200, list",
      r.status_code == 200 and isinstance(r.json(), list),
      f"HTTP {r.status_code}: {r.text[:200]}")

# GET /consent/status/{patient_id} — doctor checks consent
r = client.get(f"/consent/status/{PATIENT_ID}", headers=H_DOC)
body = r.json() if r.status_code == 200 else r.text
check("CON-3", "Doctor GET /consent/status/{id} -> 200",
      r.status_code == 200 and "has_consent" in body,
      f"HTTP {r.status_code}: {str(body)[:200]}")
if r.status_code == 200:
    check("CON-4", "Doctor has approved consent for test patient",
          body.get("has_consent") is True,
          f"has_consent={body.get('has_consent')}")

# Clerk cannot access consent endpoints
r = client.get("/consent/my-access", headers=H_CLK)
check("CON-5", "Clerk GET /consent/my-access -> 403",
      r.status_code == 403, f"HTTP {r.status_code}: {r.text[:100]}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== CORS preflight (T-27 / T-28) ==={RESET}")
# ═══════════════════════════════════════════════════════

# T-27: Allowed origin
r = client.options("/auth/login", headers={
    "Origin": "http://localhost:3000",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "Content-Type",
})
check("T-27", "CORS preflight allowed origin (localhost:3000) -> ACAO header set",
      r.status_code in (200, 204)
      and r.headers.get("access-control-allow-origin") == "http://localhost:3000",
      f"HTTP {r.status_code}, ACAO={r.headers.get('access-control-allow-origin')}")

# T-28: Disallowed origin — must NOT echo the origin back
r = client.options("/auth/login", headers={
    "Origin": "http://evil.example.com",
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "Content-Type",
})
check("T-28", "CORS preflight disallowed origin — ACAO header NOT 'evil.example.com'",
      r.headers.get("access-control-allow-origin") != "http://evil.example.com",
      f"ACAO={r.headers.get('access-control-allow-origin')}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== Rate limiting (T-29 / T-30 / T-31) ==={RESET}")
# ═══════════════════════════════════════════════════════

# T-29: Login rate limit — 10/minute
print("  T-29: hammering POST /auth/login (limit 10/min)...")
got_429 = False
for i in range(15):
    r = client.post("/auth/login", json={"email": "probe@test.com", "password": "wrong"})
    if r.status_code == 429:
        got_429 = True
        print(f"    attempt {i+1} -> 429 (rate limited)")
        break
check("T-29", "Login rate limit triggers 429 within 15 attempts",
      got_429, "Never got 429 — rate limit not firing")

# T-30: OTP request rate limit — 5/minute
print("  T-30: hammering POST /patient/request-otp (limit 5/min)...")
got_429_otp = False
for i in range(10):
    r = client.post("/patient/request-otp", json={"patient_code": "LFL-XXXXXX"})
    if r.status_code == 429:
        got_429_otp = True
        print(f"    attempt {i+1} -> 429 (rate limited)")
        break
check("T-30", "OTP request rate limit triggers 429 within 10 attempts",
      got_429_otp, "Never got 429 — rate limit not firing")

# T-31: OTP verify rate limit — 10/minute
print("  T-31: hammering POST /patient/verify-otp (limit 10/min)...")
got_429_verify = False
for i in range(15):
    r = client.post("/patient/verify-otp", json={"patient_code": "LFL-XXXXXX", "otp": "000000"})
    if r.status_code == 429:
        got_429_verify = True
        print(f"    attempt {i+1} -> 429 (rate limited)")
        break
check("T-31", "OTP verify rate limit triggers 429 within 15 attempts",
      got_429_verify, "Never got 429 — rate limit not firing")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== Health / utility endpoints ==={RESET}")
# ═══════════════════════════════════════════════════════

r = client.get("/")
check("UTIL-1", "GET / -> 200", r.status_code == 200)

r = client.get("/health")
check("UTIL-2", "GET /health -> 200", r.status_code == 200 and r.json().get("status") == "healthy")

r = client.get("/db-status")
check("UTIL-3", "GET /db-status -> 200", r.status_code == 200)

# ═══════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════

total = passed + failed
colour = GREEN if failed == 0 else RED

print(f"\n{'='*64}")
print(f"{BOLD}BE-1 LIVE INTEGRATION RESULTS{RESET}")
print(f"{'='*64}")
print(f"{'ID':<16} {'Label':<46} {'Result'}")
print(f"{'-'*64}")
for res in results:
    icon = f"{GREEN}PASS{RESET}" if res['passed'] else f"{RED}FAIL{RESET}"
    print(f"{res['id']:<16} {res['label'][:46]:<46} {icon}")

print(f"\n  {colour}{passed}/{total} BE-1 live integration tests passed{RESET}")
print(f"{'='*64}\n")

if failed:
    sys.exit(1)
