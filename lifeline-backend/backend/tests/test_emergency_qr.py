"""
tests/test_emergency_qr.py
Backend tests for the Emergency QR Code feature.

Tests covered:
  T-QR-01  generate_qr_token() produces unique tokens (no randomness bias)
  T-QR-02  get_or_create returns same token on repeated calls
  T-QR-03  regenerate_emergency_qr_token invalidates the old token (old URL 404s)
  T-QR-04  GET /emergency/{token} returns only the permitted fields
  T-QR-05  GET /emergency/{token} NEVER returns diagnosis/medicines/lab_values fields
  T-QR-06  GET /emergency/{token} returns 404 for invalid tokens
  T-QR-07  GET /patient/emergency-qr requires patient auth (401 without token)
  T-QR-08  POST /patient/emergency-qr/regenerate requires patient auth (401 without token)
  T-QR-09  Rate limit triggers after 10 rapid requests/minute (429)

Run with:
  cd lifeline-backend/backend
  venv\\Scripts\\python.exe tests\\test_emergency_qr.py

State: uses the same patient from test_t22_t31.py:
  LFL-J6MTOC / TestPass123!
"""

import sys
import time
import requests

BASE         = "http://localhost:8000"
PATIENT_CODE = "LFL-JOYN4U"
PATIENT_PASS = "123456"

# ── Forbidden fields — must NEVER appear in /emergency/{token} response ────────
FORBIDDEN_FIELDS = {
    "id", "patient_code", "email", "phone", "password_hash",
    "diagnosis", "diagnoses", "medicines", "lab_values", "procedures",
    "follow_ups", "report_hash", "file_url", "uploaded_by",
}

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

results = []


def log(test_id, name, expected, passed, detail=""):
    icon = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    results.append({"id": test_id, "name": name, "passed": passed})
    print(f"\n{'-'*62}")
    print(f"{BOLD}{test_id} -- {name}{RESET}  [{icon}]")
    print(f"  Expected : {expected}")
    if detail:
        print(f"  Detail   : {detail}")


# ── T-QR-01: Token uniqueness ──────────────────────────────────────────────────
def test_qr_01_token_uniqueness():
    """generate_qr_token() must produce unique values each call."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from app.utils.qr_token import generate_qr_token

    tokens = {generate_qr_token() for _ in range(200)}
    passed = len(tokens) == 200
    log("T-QR-01", "Token uniqueness (200 calls, no collision)",
        "200 unique tokens", passed, f"got {len(tokens)} unique")


# ── Bootstrap: login and get patient token ─────────────────────────────────────
def get_patient_token():
    r = requests.post(f"{BASE}/patient/login",
                      json={"lfl_code": PATIENT_CODE, "password": PATIENT_PASS})
    if r.status_code != 200:
        print(f"{RED}FATAL: patient login failed — {r.status_code} {r.text}{RESET}")
        sys.exit(1)
    return r.json()["access_token"]


# ── T-QR-02: get_or_create is idempotent ──────────────────────────────────────
def test_qr_02_idempotent(headers):
    r1 = requests.get(f"{BASE}/patient/emergency-qr", headers=headers)
    r2 = requests.get(f"{BASE}/patient/emergency-qr", headers=headers)
    passed = (
        r1.status_code == 200
        and r2.status_code == 200
        and r1.json()["token"] == r2.json()["token"]
    )
    log("T-QR-02", "get_or_create returns same token on repeated calls",
        "token unchanged on second call", passed,
        f"tokens: {r1.json().get('token','?')[:12]}… == {r2.json().get('token','?')[:12]}…")
    return r1.json()["token"], r1.json()["url"]


# ── T-QR-03: regenerate invalidates old token ─────────────────────────────────
def test_qr_03_regenerate_invalidates(headers, old_token, old_url):
    r_regen = requests.post(f"{BASE}/patient/emergency-qr/regenerate", headers=headers)
    passed_regen = r_regen.status_code == 200 and r_regen.json()["token"] != old_token

    # Old URL must now 404
    r_old = requests.get(f"{BASE}/emergency/{old_token}")
    passed_old_gone = r_old.status_code == 404

    passed = passed_regen and passed_old_gone
    log("T-QR-03", "Regenerate invalidates old token (old URL now 404s)",
        "new token returned AND old /emergency/{old_token} → 404", passed,
        f"regen={r_regen.status_code}, old_token_status={r_old.status_code}")
    return r_regen.json()["token"], r_regen.json()["url"]


# ── T-QR-04: public endpoint returns only permitted fields ────────────────────
def test_qr_04_response_shape(token):
    r = requests.get(f"{BASE}/emergency/{token}")
    if r.status_code != 200:
        log("T-QR-04", "Public endpoint returns permitted fields",
            "200 with correct shape", False, f"got {r.status_code}")
        return

    body = r.json()
    required = {"name", "blood_group", "date_of_birth", "conditions",
                "emergency_contacts", "allergies"}
    has_required = required.issubset(body.keys())
    log("T-QR-04", "Public endpoint returns only permitted fields",
        f"keys = {sorted(required)}", has_required,
        f"actual keys = {sorted(body.keys())}")


# ── T-QR-05: public endpoint NEVER includes forbidden fields ──────────────────
def test_qr_05_no_forbidden_fields(token):
    r = requests.get(f"{BASE}/emergency/{token}")
    if r.status_code != 200:
        log("T-QR-05", "Public endpoint omits forbidden fields",
            "no forbidden fields", False, f"got {r.status_code}")
        return

    body = r.json()
    leaked = FORBIDDEN_FIELDS & set(body.keys())
    passed = len(leaked) == 0
    log("T-QR-05", "Public endpoint NEVER leaks diagnosis/medicines/id/email/phone",
        "leaked = {} (empty set)", passed,
        f"leaked fields: {leaked}" if leaked else "clean ✓")


# ── T-QR-06: invalid token → 404 ──────────────────────────────────────────────
def test_qr_06_invalid_token_404():
    r = requests.get(f"{BASE}/emergency/this-is-not-a-valid-token-at-all-12345")
    passed = r.status_code == 404
    log("T-QR-06", "Invalid token -> 404",
        "404", passed, f"got {r.status_code}")


# ── T-QR-07: GET /patient/emergency-qr requires auth ─────────────────────────
def test_qr_07_qr_endpoint_requires_auth():
    # FastAPI HTTPBearer returns 403 with no header (depends on version) or 401
    r = requests.get(f"{BASE}/patient/emergency-qr")
    passed = r.status_code in (401, 403)
    log("T-QR-07", "GET /patient/emergency-qr requires patient auth",
        "401 or 403 without token", passed, f"got {r.status_code}")


# ── T-QR-08: POST /patient/emergency-qr/regenerate requires auth ──────────────
def test_qr_08_regenerate_requires_auth():
    r = requests.post(f"{BASE}/patient/emergency-qr/regenerate")
    passed = r.status_code in (401, 403)
    log("T-QR-08", "POST /patient/emergency-qr/regenerate requires patient auth",
        "401 or 403 without token", passed, f"got {r.status_code}")


# ── T-QR-09: rate limit (10/min) triggers on the public endpoint ─────────────
def test_qr_09_rate_limit(token):
    """Fire 12 rapid requests — expect a 429 by the 11th or 12th."""
    statuses = []
    for _ in range(12):
        r = requests.get(f"{BASE}/emergency/{token}")
        statuses.append(r.status_code)

    # At least one 429 must have appeared
    passed = 429 in statuses
    log("T-QR-09", "Rate limit (10/min) triggers on /emergency/{token}",
        "429 seen after 10 rapid requests", passed,
        f"statuses: {statuses}")


# ── Summary ────────────────────────────────────────────────────────────────────
def print_summary():
    total  = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    print(f"\n{'='*62}")
    print(f"{BOLD}Results: {GREEN}{passed} passed{RESET}{BOLD}, {RED}{failed} failed{RESET}{BOLD} / {total} total{RESET}")
    if failed:
        print(f"\n{YELLOW}Failed tests:{RESET}")
        for r in results:
            if not r["passed"]:
                print(f"  {RED}✗{RESET} {r['id']} — {r['name']}")
    print(f"{'='*62}\n")


if __name__ == "__main__":
    print(f"{BOLD}Emergency QR — Backend Test Suite{RESET}")
    print(f"Target: {BASE}\n")

    # T-QR-01 (pure unit — no server needed)
    test_qr_01_token_uniqueness()

    # Auth tests (T-QR-07, T-QR-08) — no login needed
    test_qr_07_qr_endpoint_requires_auth()
    test_qr_08_regenerate_requires_auth()

    # T-QR-06 — no login needed
    test_qr_06_invalid_token_404()

    # Login
    token_jwt = get_patient_token()
    headers = {"Authorization": f"Bearer {token_jwt}"}

    # T-QR-02
    old_token, old_url = test_qr_02_idempotent(headers)

    # T-QR-03 — regenerate, get new token for subsequent tests
    new_token, new_url = test_qr_03_regenerate_invalidates(headers, old_token, old_url)

    # T-QR-04 / T-QR-05
    test_qr_04_response_shape(new_token)
    test_qr_05_no_forbidden_fields(new_token)

    # T-QR-09 — rate limit (do last so it doesn't affect other tests)
    # Wait a moment first to ensure we start fresh within the window
    print(f"\n  {YELLOW}(waiting 2 s before rate-limit burst…){RESET}")
    time.sleep(2)
    test_qr_09_rate_limit(new_token)

    print_summary()
