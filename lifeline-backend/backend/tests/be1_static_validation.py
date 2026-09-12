"""
BE-1 Static / Unit Validation
Covers every BE-1 domain without a running server.
Live Supabase only used for audit_service (which swallows its own errors).

Run: venv/Scripts/python.exe -m tests.be1_static_validation
"""

import sys
import re
import inspect
from unittest.mock import patch, MagicMock

GREEN = "\033[92m"
RED   = "\033[91m"
RESET = "\033[0m"
BOLD  = "\033[1m"

passed = 0
failed = 0


def check(label, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  {GREEN}PASS{RESET}  {label}")
        passed += 1
    else:
        print(f"  {RED}FAIL{RESET}  {label}" + (f"\n        {detail}" if detail else ""))
        failed += 1


# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 1. app.main import / startup ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.main import app
check("app.main imports without error", True)

schema = app.openapi()
paths = set(schema.get("paths", {}).keys())
check("OpenAPI schema generates without error", bool(paths))
print(f"    Total OpenAPI paths: {len(paths)}")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 2. Route registration (all BE-1 routes) ==={RESET}")
# ═══════════════════════════════════════════════════════

EXPECTED_BE1_ROUTES = [
    "/auth/login", "/auth/register", "/auth/me",
    "/patient/request-otp", "/patient/verify-otp", "/patient/register",
    "/patient/login", "/patient/profile",
    "/patients/", "/patients/code/{patient_code}", "/patients/{patient_id}",
    "/consent/request", "/consent/pending", "/consent/my-access",
    "/consent/status/{patient_id}", "/consent/{consent_id}/respond",
    "/upload", "/medical-records", "/records/{record_id}/file",
    "/timeline/", "/summary/", "/vitalis/chat",
]

for route in EXPECTED_BE1_ROUTES:
    check(f"Route {route} in OpenAPI", route in paths)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 3. Auth schemas ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.auth.schemas import RegisterRequest, LoginRequest, TokenResponse
from pydantic import ValidationError

r = RegisterRequest(email="doc@test.com", password="pass", name="Dr X", role="doctor", med_reg_no="REG001")
check("RegisterRequest parses doctor", r.role == "doctor")
check("RegisterRequest med_reg_no optional field present", r.med_reg_no == "REG001")

r2 = RegisterRequest(email="clerk@test.com", password="pass", name="Clerk Y", role="clerk")
check("RegisterRequest parses clerk (no med_reg_no)", r2.role == "clerk" and r2.med_reg_no is None)

try:
    RegisterRequest(email="x@x.com", password="p", name="X", role="patient")
    check("RegisterRequest rejects 'patient' role", False, "no ValidationError raised")
except ValidationError:
    check("RegisterRequest rejects 'patient' role", True)

try:
    RegisterRequest(email="x@x.com", password="p", name="X", role="admin")
    check("RegisterRequest rejects 'admin' role", False, "no ValidationError raised")
except ValidationError:
    check("RegisterRequest rejects 'admin' role", True)

l = LoginRequest(email="doc@test.com", password="pass")
check("LoginRequest parses", l.email == "doc@test.com")

t = TokenResponse(access_token="abc", token_type="bearer")
check("TokenResponse parses", t.token_type == "bearer")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 4. JWT / security layer ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.auth.security import (
    hash_password, verify_password, create_access_token, verify_access_token,
    require_doctor, require_staff, require_patient,
)
from fastapi import HTTPException

hashed = hash_password("MySecret123")
check("hash_password produces non-empty bcrypt hash", bool(hashed) and hashed.startswith("$2"))
check("verify_password succeeds with correct password", verify_password("MySecret123", hashed))
check("verify_password fails with wrong password", not verify_password("WrongPass", hashed))

payload = {"sub": "doc@test.com", "user_id": 7, "role": "doctor"}
token = create_access_token(payload)
check("create_access_token returns non-empty JWT string", isinstance(token, str) and len(token) > 20)

decoded = verify_access_token(token)
check("verify_access_token decodes valid token", decoded is not None)
check("decoded sub matches", decoded.get("sub") == "doc@test.com")
check("decoded user_id matches", decoded.get("user_id") == 7)
check("decoded role matches", decoded.get("role") == "doctor")

check("verify_access_token returns None on bad token", verify_access_token("bad.token.here") is None)

p_token = create_access_token(
    {"sub": "LFL-J6MTOC", "patient_id": "d07a5673-b987-4138-b814-1393071110d3", "role": "patient"},
    expire_minutes=15,
)
p_decoded = verify_access_token(p_token)
check("Patient token has patient_id claim", p_decoded.get("patient_id") == "d07a5673-b987-4138-b814-1393071110d3")
check("Patient token has role=patient", p_decoded.get("role") == "patient")
check("Patient token sub is patient_code", p_decoded.get("sub") == "LFL-J6MTOC")

# require_doctor
doc_user = {"sub": "doc@test.com", "user_id": 7, "role": "doctor"}
check("require_doctor passes doctor", require_doctor(doc_user) == doc_user)
for bad_role in ("clerk", "patient", "admin"):
    try:
        require_doctor({"role": bad_role})
        check(f"require_doctor blocks {bad_role}", False)
    except HTTPException as e:
        check(f"require_doctor blocks {bad_role} (403)", e.status_code == 403)

# require_staff
check("require_staff passes doctor", require_staff({"role": "doctor", "user_id": 7}) is not None)
check("require_staff passes clerk", require_staff({"role": "clerk", "user_id": 8}) is not None)
for bad_role in ("patient", "admin"):
    try:
        require_staff({"role": bad_role})
        check(f"require_staff blocks {bad_role}", False)
    except HTTPException as e:
        check(f"require_staff blocks {bad_role} (403)", e.status_code == 403)

# require_patient
check("require_patient passes patient", require_patient({"role": "patient", "patient_id": "x"}) is not None)
for bad_role in ("doctor", "clerk"):
    try:
        require_patient({"role": bad_role, "user_id": 7})
        check(f"require_patient blocks {bad_role}", False)
    except HTTPException as e:
        check(f"require_patient blocks {bad_role} (403)", e.status_code == 403)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 5. Patient code generation ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.utils.patient_code import generate_patient_code

codes = {generate_patient_code() for _ in range(300)}
check("generate_patient_code: LFL- prefix always present", all(c.startswith("LFL-") for c in codes))
check("generate_patient_code: exactly 10 chars", all(len(c) == 10 for c in codes))
check("generate_patient_code: 300 unique codes (entropy ok)", len(codes) == 300)
check("generate_patient_code: suffix is uppercase alphanum",
      all(re.match(r"^LFL-[A-Z0-9]{6}$", c) for c in codes))

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 6. Patient schemas ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.patients.schemas import (
    CreatePatientRequest, PatientResponse, PatientProfileResponse,
    PatientRegisterRequest, PatientLoginRequest, PatientProfileUpdate,
    OtpRequestRequest, OtpRequestResponse, OtpVerifyRequest, OtpVerifyResponse,
)

p = CreatePatientRequest(name="Alice", phone="+91999", date_of_birth="1990-01-01")
check("CreatePatientRequest parses with date_of_birth", p.name == "Alice")
p2 = CreatePatientRequest(name="Bob", phone="+91888")
check("CreatePatientRequest date_of_birth is optional (None)", p2.date_of_birth is None)

resp = PatientResponse(id="uuid", patient_code="LFL-ABCDEF", name="Alice",
                       phone="+91999", date_of_birth="1990-01-01", created_at="2024-01-01T00:00:00")
check("PatientResponse parses", resp.patient_code == "LFL-ABCDEF")

otp_req = OtpRequestRequest(patient_code="LFL-ABCDEF")
check("OtpRequestRequest parses", otp_req.patient_code == "LFL-ABCDEF")
otp_resp = OtpRequestResponse(patient_code="LFL-ABCDEF", otp="123456", expires_in_minutes=15)
check("OtpRequestResponse has expires_in_minutes", otp_resp.expires_in_minutes == 15)
otp_verify = OtpVerifyRequest(patient_code="LFL-ABCDEF", otp="123456")
check("OtpVerifyRequest parses", otp_verify.otp == "123456")
otp_verify_resp = OtpVerifyResponse(access_token="tok", token_type="bearer", expires_in_minutes=15)
check("OtpVerifyResponse parses", otp_verify_resp.token_type == "bearer")

pat_reg = PatientRegisterRequest(name="Alice", password="pass123", phone="+91999")
check("PatientRegisterRequest parses", pat_reg.name == "Alice" and pat_reg.phone == "+91999")
pat_login = PatientLoginRequest(lfl_code="LFL-ABCDEF", password="pass123")
check("PatientLoginRequest parses", pat_login.password == "pass123")

pu = PatientProfileUpdate(blood_group="A+", phone="+91888")
check("PatientProfileUpdate parses partial fields", pu.blood_group == "A+")
pu_empty = PatientProfileUpdate()
check("PatientProfileUpdate all None (no-op)", all(v is None for v in pu_empty.model_dump().values()))

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 7. Patient service (mocked) ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.patients.service import get_patient_by_id, get_patient_by_code

PATIENT_ROW = {
    "id": "d07a5673-b987-4138-b814-1393071110d3",
    "patient_code": "LFL-J6MTOC",
    "name": "Test Patient",
    "phone": "+91999",
    "date_of_birth": None,
    "created_at": "2024-01-01T00:00:00+00:00",
}

with patch("app.patients.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [PATIENT_ROW]
    result = get_patient_by_code("LFL-J6MTOC")
    check("get_patient_by_code returns row when found", result == PATIENT_ROW)

with patch("app.patients.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    result = get_patient_by_code("LFL-XXXXXX")
    check("get_patient_by_code returns None when not found", result is None)

with patch("app.patients.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [PATIENT_ROW]
    result = get_patient_by_id("d07a5673-b987-4138-b814-1393071110d3")
    check("get_patient_by_id returns row when found", result == PATIENT_ROW)

with patch("app.patients.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    result = get_patient_by_id("00000000-0000-0000-0000-000000000000")
    check("get_patient_by_id returns None when not found", result is None)

# OTP: create_otp_session produces 6-digit string, stores hashed
from app.patients.service import create_otp_session
with patch("app.patients.service.supabase") as m:
    m.table.return_value.insert.return_value.execute.return_value.data = [{"id": "sess-1"}]
    otp = create_otp_session("pat-uuid")
    check("create_otp_session returns 6-digit string", len(otp) == 6 and otp.isdigit())
    insert_call = m.table.return_value.insert.call_args[0][0]
    check("create_otp_session stores otp_hash (not plaintext)", insert_call.get("otp_hash") != otp)
    check("create_otp_session sets used=False", insert_call.get("used") is False)
    check("create_otp_session sets patient_id", insert_call.get("patient_id") == "pat-uuid")

# verify_otp: invalid OTP returns None
from app.patients.service import verify_otp
with patch("app.patients.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [PATIENT_ROW]
    m.table.return_value.select.return_value.eq.return_value.eq.return_value.gt.return_value.execute.return_value.data = []
    result = verify_otp("LFL-J6MTOC", "000000")
    check("verify_otp returns None for no active sessions", result is None)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 8. Medical record service / resolve_patient_id ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.services.medical_record_service import (
    resolve_patient_id, check_doctor_consent, get_all_medical_records,
)

pid = resolve_patient_id({"role": "patient", "patient_id": "pat-1"}, None)
check("resolve_patient_id: patient -> own patient_id", pid == "pat-1")

pid2 = resolve_patient_id({"role": "patient", "patient_id": "pat-1"}, "ignored-param")
check("resolve_patient_id: patient ignores query param", pid2 == "pat-1")

try:
    resolve_patient_id({"role": "clerk", "user_id": 5}, None)
    check("resolve_patient_id: clerk -> 403", False)
except HTTPException as e:
    check("resolve_patient_id: clerk -> 403", e.status_code == 403)

try:
    resolve_patient_id({"role": "doctor", "user_id": 7}, None)
    check("resolve_patient_id: doctor no param -> 422", False)
except HTTPException as e:
    check("resolve_patient_id: doctor no param -> 422", e.status_code == 422)

with patch("app.services.medical_record_service.check_doctor_consent", return_value=True):
    pid3 = resolve_patient_id({"role": "doctor", "user_id": 7}, "pat-1")
    check("resolve_patient_id: doctor with consent -> returns param", pid3 == "pat-1")

with patch("app.services.medical_record_service.check_doctor_consent", return_value=False):
    try:
        resolve_patient_id({"role": "doctor", "user_id": 7}, "pat-1")
        check("resolve_patient_id: doctor no consent -> 403", False)
    except HTTPException as e:
        check("resolve_patient_id: doctor no consent -> 403", e.status_code == 403)

try:
    resolve_patient_id({"role": "admin"}, "pat-1")
    check("resolve_patient_id: unknown role -> 403", False)
except HTTPException as e:
    check("resolve_patient_id: unknown role -> 403", e.status_code == 403)

# get_all_medical_records: join + flatten (BE-2 Item 7 — confirm still works)
mock_rows = [
    {"id": "r1", "patient_id": "pat-1", "file_name": "test.pdf",
     "report_type": "Blood Test", "status": "verified", "file_url": None,
     "procedures": [], "follow_ups": [],
     "users": {"name": "Dr Smith"}, "uploaded_by": 7},
    {"id": "r2", "patient_id": "pat-1", "file_name": None, "report_type": None,
     "status": None, "file_url": None, "procedures": [], "follow_ups": [],
     "users": None, "uploaded_by": None},
]
with patch("app.services.medical_record_service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = mock_rows
    records = get_all_medical_records("pat-1")
    select_arg = m.table.return_value.select.call_args[0][0]
    check("get_all_medical_records: select uses uploader join", "users!uploaded_by(name)" in select_arg)
    check("get_all_medical_records: uploader_name populated", records[0].get("uploader_name") == "Dr Smith")
    check("get_all_medical_records: raw users key removed", "users" not in records[0])
    check("get_all_medical_records: uploader_name None when NULL", records[1].get("uploader_name") is None)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 9. Consent service (mocked) ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.consent.service import respond_to_consent

CONSENT_ROW = {
    "id": "consent-uuid-1", "doctor_id": 7, "patient_id": "pat-1",
    "status": "pending", "requested_at": "2024-01-01T00:00:00+00:00",
    "responded_at": None, "expires_at": None,
}

with patch("app.consent.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    row, err = respond_to_consent("fake-id", "pat-1", "approved", 30)
    check("respond_to_consent: not_found sentinel when missing", err == "not_found")

with patch("app.consent.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {**CONSENT_ROW, "patient_id": "other-patient"}
    ]
    row, err = respond_to_consent("consent-uuid-1", "pat-1", "approved", 30)
    check("respond_to_consent: forbidden when patient mismatch", err == "forbidden")

with patch("app.consent.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {**CONSENT_ROW, "status": "approved"}
    ]
    row, err = respond_to_consent("consent-uuid-1", "pat-1", "approved", 30)
    check("respond_to_consent: already_responded when not pending", err == "already_responded")

with patch("app.consent.service.supabase") as m:
    m.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [CONSENT_ROW]
    updated_row = {**CONSENT_ROW, "status": "approved", "responded_at": "2024-06-01T00:00:00+00:00", "expires_at": "2024-07-01T00:00:00+00:00"}
    m.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [updated_row]
    with patch("app.consent.service.write_access_log"):
        row, err = respond_to_consent("consent-uuid-1", "pat-1", "approved", 30)
        check("respond_to_consent: success returns updated row", row is not None and err is None)
        check("respond_to_consent: status set to approved", row.get("status") == "approved")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 10. Medical record schema (BE-1 + BE-2 fields) ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.schemas.medical_record import MedicalRecord, MedicineItem, LabValueItem

med = MedicalRecord(
    doctor="Dr Smith", hospital="City Hospital",
    dates=["2024-01-01"], diagnosis=["Hypertension"],
    medicines=[MedicineItem(name="Aspirin", dosage="100mg", frequency="once", duration="7 days")],
    allergies=["Penicillin"],
    lab_values=[LabValueItem(name="HbA1c", value="5.7", unit="%", date="2024-01-01", normal=True)],
    procedures=["Blood draw"],
    follow_ups=["Follow up in 4 weeks"],
    raw_text="raw text here",
)
check("MedicalRecord parses all fields", med.doctor == "Dr Smith")
check("MedicalRecord.medicines is list of MedicineItem", isinstance(med.medicines[0], MedicineItem))
check("MedicalRecord.lab_values is list of LabValueItem", isinstance(med.lab_values[0], LabValueItem))
check("MedicalRecord.procedures is list of strings (BE-2 field)", med.procedures == ["Blood draw"])
check("MedicalRecord.follow_ups is list of strings (BE-2 field)", med.follow_ups == ["Follow up in 4 weeks"])

med_empty = MedicalRecord()
check("MedicalRecord empty defaults work", med_empty.doctor is None and med_empty.dates == [])
check("MedicalRecord.procedures defaults to []", med_empty.procedures == [])
check("MedicalRecord.follow_ups defaults to []", med_empty.follow_ups == [])

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 11. Timeline service (mocked) ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.timeline.service import generate_timeline

mock_records = [
    {"dates": ["2024-03-01"], "diagnosis": ["Flu"], "doctor": "Dr A", "hospital": "H1",
     "uploader_name": "Dr A", "id": "r1", "patient_id": "pat-1"},
    {"dates": ["2024-01-01"], "diagnosis": ["Hypertension"], "doctor": "Dr B", "hospital": "H2",
     "uploader_name": "Dr B", "id": "r2", "patient_id": "pat-1"},
    {"dates": [], "diagnosis": [], "doctor": None, "hospital": None,
     "uploader_name": None, "id": "r3", "patient_id": "pat-1"},
]
with patch("app.timeline.service.get_all_medical_records", return_value=mock_records):
    timeline = generate_timeline("pat-1")
    check("generate_timeline returns list", isinstance(timeline, list))
    check("generate_timeline has correct count", len(timeline) == 3)
    check("Timeline sorted by date (oldest first)", timeline[0]["date"] == "2024-01-01")
    check("Timeline event has all expected keys",
          all(k in timeline[0] for k in ("date", "title", "doctor", "hospital", "diagnosis")))
    check("Timeline handles missing dates (Unknown fallback)", timeline[2]["date"] == "Unknown")
    check("Timeline handles missing diagnosis (fallback title)", timeline[2]["title"] == "Medical Report")

with patch("app.timeline.service.get_all_medical_records", return_value=[]):
    check("generate_timeline returns [] for no records", generate_timeline("pat-1") == [])

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 12. CORS / rate limiter config ==={RESET}")
# ═══════════════════════════════════════════════════════

from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware

cors_found = any(getattr(mw, "cls", None) is CORSMiddleware for mw in app.user_middleware)
check("CORSMiddleware registered on app", cors_found)

slowapi_found = any(getattr(mw, "cls", None) is SlowAPIMiddleware for mw in app.user_middleware)
check("SlowAPIMiddleware registered on app", slowapi_found)
check("app.state.limiter set", hasattr(app.state, "limiter"))

# Rate-limit decorators present in source
auth_src = inspect.getsource(inspect.getmodule(app.state.limiter.__class__))
import app.auth.routes as auth_routes_mod
import app.patients.routes as patient_routes_mod

auth_src = inspect.getsource(auth_routes_mod)
patient_src = inspect.getsource(patient_routes_mod)

check("POST /auth/login has @limiter.limit",
      "limiter.limit" in auth_src and "10/minute" in auth_src)
check("POST /patient/request-otp has @limiter.limit (5/minute)",
      "limiter.limit" in patient_src and "5/minute" in patient_src)
check("POST /patient/verify-otp has @limiter.limit (10/minute)",
      "limiter.limit" in patient_src and "10/minute" in patient_src)

# Allowed origins
cors_mw_kwargs = {}
for mw in app.user_middleware:
    if getattr(mw, "cls", None) is CORSMiddleware:
        cors_mw_kwargs = mw.kwargs
        break
allowed_origins = cors_mw_kwargs.get("allow_origins", [])
check("CORS allows localhost:3000", "http://localhost:3000" in allowed_origins)
check("CORS allows localhost:5173", "http://localhost:5173" in allowed_origins)
check("CORS does NOT allow wildcard (*)", "*" not in allowed_origins)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 13. Upload pipeline source checks ==={RESET}")
# ═══════════════════════════════════════════════════════

import app.api.upload as upload_mod
src = inspect.getsource(upload_mod)

check("upload.py: OCR extract_text imported", "extract_text" in src)
check("upload.py: AI extract_medical_data imported", "extract_medical_data" in src)
check("upload.py: parse_ai_response imported", "parse_ai_response" in src)
check("upload.py: validate_medical_record imported", "validate_medical_record" in src)
check("upload.py: dedup by get_record_by_hash", "get_record_by_hash" in src)
check("upload.py: save_medical_record called", "save_medical_record" in src)
check("upload.py: write_access_log called", "write_access_log" in src)
check("upload.py: private storage bucket used", "STORAGE_BUCKET" in src and "_upload_to_storage" in src)
check("upload.py: BE-2 care plan loop present", "follow_ups" in src and "create_care_plan_item" in src)
check("upload.py: care plan loop is non-fatal (try/except per item)", src.count("except Exception as exc") >= 2)
check("upload.py: status=verified stored", "verified" in src)
check("upload.py: file_url stored from storage_path", "file_url" in src and "storage_path" in src)
check("upload.py: report_type stored", "report_type" in src and "data[" in src)
check("upload.py: file_name stored", "file_name" in src and "data[" in src)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 14. AI prompts ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.ai.prompts import MEDICAL_EXTRACTION_PROMPT, DOCTOR_SUMMARY_PROMPT

required_fields = [
    "doctor", "hospital", "dates", "diagnosis", "medicines",
    "allergies", "lab_values", "procedures", "follow_ups", "raw_text",
]
for field in required_fields:
    check(f"MEDICAL_EXTRACTION_PROMPT contains field '{field}'", field in MEDICAL_EXTRACTION_PROMPT)
check("MEDICAL_EXTRACTION_PROMPT: return JSON only instruction", "Return ONLY valid JSON" in MEDICAL_EXTRACTION_PROMPT)
check("DOCTOR_SUMMARY_PROMPT: non-empty content", len(DOCTOR_SUMMARY_PROMPT.strip()) > 50)
check("DOCTOR_SUMMARY_PROMPT: DO NOT invent instruction", "DO NOT invent" in DOCTOR_SUMMARY_PROMPT)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 15. Audit service (non-fatal) ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.services.audit_service import write_access_log

try:
    write_access_log(
        actor_role="doctor", action="test_action",
        actor_user_id=7, patient_id="pat-1",
    )
    check("write_access_log does not raise (swallows errors)", True)
except Exception as e:
    check("write_access_log does not raise (swallows errors)", False, detail=str(e))

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 16. Hash utility ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.utils.hash import generate_report_hash

h1 = generate_report_hash("identical report text")
h2 = generate_report_hash("identical report text")
h3 = generate_report_hash("different text content here")
check("generate_report_hash is deterministic", h1 == h2)
check("generate_report_hash differs for different input", h1 != h3)
check("generate_report_hash returns non-empty string", isinstance(h1, str) and len(h1) > 8)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 17. Settings / config ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.config.settings import settings

check("SUPABASE_URL loaded", bool(settings.SUPABASE_URL))
check("SUPABASE_KEY loaded", bool(settings.SUPABASE_KEY))
check("JWT_SECRET_KEY loaded", bool(settings.JWT_SECRET_KEY))
check("JWT_ALGORITHM is HS256", settings.JWT_ALGORITHM == "HS256")
check("JWT_EXPIRE_MINUTES is 60", settings.JWT_EXPIRE_MINUTES == 60)
check("PATIENT_JWT_EXPIRE_MINUTES is 15", settings.PATIENT_JWT_EXPIRE_MINUTES == 15)
check("CONSENT_ACCESS_DURATION_DAYS > 0", settings.CONSENT_ACCESS_DURATION_DAYS > 0)
check("AI_PROVIDER is groq", settings.AI_PROVIDER == "groq")

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 18. BE-2 compat: care_plan and appointments modules present ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.care_plan.routes import care_plan_router
from app.appointments.routes import appointments_router
from app.main import care_plan_router as main_cp, appointments_router as main_ap

check("care_plan_router importable", care_plan_router is not None)
check("appointments_router importable", appointments_router is not None)
check("care_plan_router registered in main", main_cp is care_plan_router)
check("appointments_router registered in main", main_ap is appointments_router)

# BE-2 routes still in OpenAPI after BE-1 check (no regression)
be2_routes = ["/care-plan", "/care-plan/{item_id}", "/appointments",
              "/appointments/{appt_id}", "/records/{record_id}/file"]
for route in be2_routes:
    check(f"BE-2 route {route} still present (no regression)", route in paths)

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 19. generate_summary: structured medicine dicts (unhashable regression) ==={RESET}")
# ═══════════════════════════════════════════════════════

from app.summary.service import generate_summary, _normalise_items

# Unit-test _normalise_items directly
check("_normalise_items: dict -> uses 'name' key",
      _normalise_items([{"name": "Aspirin", "dosage": "100mg"}]) == ["Aspirin"])
check("_normalise_items: plain string passthrough",
      _normalise_items(["Paracetamol"]) == ["Paracetamol"])
check("_normalise_items: dict missing 'name' falls back to str()",
      isinstance(_normalise_items([{"dosage": "100mg"}])[0], str))
check("_normalise_items: mixed list (dict + string) handled",
      set(_normalise_items([{"name": "Aspirin"}, "Metformin"])) == {"Aspirin", "Metformin"})
check("_normalise_items: empty list returns []",
      _normalise_items([]) == [])

# Integration: generate_summary must NOT raise TypeError for structured medicines
_STRUCT_RECORDS = [
    {
        "diagnosis": ["Hypertension"],
        "medicines": [
            {"name": "Aspirin",   "dosage": "100mg", "frequency": "once daily",  "duration": "7 days"},
            {"name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "duration": "30 days"},
        ],
        "allergies": ["Penicillin"],
        "doctor": "Dr Smith",
        "hospital": "City Hospital",
    },
    {
        "diagnosis": ["Flu"],
        "medicines": ["Paracetamol"],  # legacy plain-string form — must still work
        "allergies": [],
        "doctor": None,
        "hospital": None,
    },
]

with patch("app.summary.service.get_all_medical_records", return_value=_STRUCT_RECORDS), \
     patch("app.summary.service.generate", return_value="<ai summary>"):
    try:
        _result = generate_summary("pat-test")
        check("generate_summary: structured medicine dicts do not raise TypeError", True)
        check("generate_summary: returns non-empty string", bool(_result))
    except TypeError as _e:
        check("generate_summary: structured medicine dicts do not raise TypeError",
              False, detail=str(_e))
    except Exception as _e:
        check("generate_summary: no unexpected exception", False, detail=str(_e))

# Verify _format_medicines from vitalis.service handles same inputs without error
from app.vitalis.service import _format_medicines

check("_format_medicines: structured dict rendered with name",
      "Aspirin" in _format_medicines([{"name": "Aspirin", "dosage": "100mg", "frequency": "once daily"}]))
check("_format_medicines: dosage/frequency included in output",
      "dosage: 100mg" in _format_medicines([{"name": "Aspirin", "dosage": "100mg"}]))
check("_format_medicines: plain string passes through",
      _format_medicines(["Paracetamol"]) == "Paracetamol")
check("_format_medicines: empty list returns 'None'",
      _format_medicines([]) == "None")
check("_format_medicines: None input returns 'None'",
      _format_medicines(None) == "None")
check("_format_medicines: mixed list (dict + string) renders both",
      "Aspirin" in _format_medicines([{"name": "Aspirin"}, "Metformin"])
      and "Metformin" in _format_medicines([{"name": "Aspirin"}, "Metformin"]))

# ═══════════════════════════════════════════════════════
print(f"\n{BOLD}=== 20. Appointment OTP sub-flow + appt-token gate ==={RESET}")
# ═══════════════════════════════════════════════════════

import app.appointments.routes as appt_routes_mod
import app.api.upload as upload_mod_v2
appt_routes_src = inspect.getsource(appt_routes_mod)
upload_src       = inspect.getsource(upload_mod_v2)
from fastapi import HTTPException as _HTTPException
from app.auth.security import require_staff as _require_staff, require_doctor as _require_doctor
import asyncio as _asyncio

# ── Upload.py: NO OTP endpoints, NO upload_token form field ───────────────────
check("upload.py: /upload/request-otp NOT present (removed)",
      "upload/request-otp" not in upload_src)
check("upload.py: /upload/verify-otp NOT present (removed)",
      "upload/verify-otp" not in upload_src)
check("upload.py: upload_token Form field NOT present (removed)",
      "upload_token" not in upload_src)
check("upload.py: _UPLOAD_AUTH_ROLE sentinel NOT present (removed)",
      "_UPLOAD_AUTH_ROLE" not in upload_src)

# ── Route presence — appointments OTP routes in OpenAPI ───────────────────────
check("Route /appointments/request-otp in OpenAPI", "/appointments/request-otp" in paths)
check("Route /appointments/verify-otp in OpenAPI",  "/appointments/verify-otp" in paths)
check("Route /upload/request-otp NOT in OpenAPI (removed)", "/upload/request-otp" not in paths)
check("Route /upload/verify-otp NOT in OpenAPI (removed)",  "/upload/verify-otp" not in paths)

# ── Appointment routes source-level checks ────────────────────────────────────
check("appointments/routes.py: request-otp endpoint defined",
      "request-otp" in appt_routes_src)
check("appointments/routes.py: verify-otp endpoint defined",
      "verify-otp" in appt_routes_src)
check("appointments/routes.py: _APPT_AUTH_ROLE sentinel defined",
      "_APPT_AUTH_ROLE" in appt_routes_src and "appt_auth" in appt_routes_src)
check("appointments/routes.py: appt_token validated in POST /appointments",
      "appt_token" in appt_routes_src and "verify_access_token" in appt_routes_src)
check("appointments/routes.py: patient_id cross-checked against token",
      "token_payload.get" in appt_routes_src)
check("appointments/routes.py: request-otp rate-limited at 5/minute",
      appt_routes_src.count("5/minute") >= 1)
check("appointments/routes.py: verify-otp rate-limited at 10/minute",
      appt_routes_src.count("10/minute") >= 1)
check("appointments/routes.py: consent check still present",
      "check_doctor_consent" in appt_routes_src)

# ── Unit: POST /appointments/request-otp — happy path ────────────────────────
# Use __wrapped__ to bypass the slowapi rate-limit decorator.
from app.appointments.routes import appt_request_otp, _APPT_TOKEN_EXPIRE_MINUTES
from app.appointments.schemas import ApptOtpRequestBody

_appt_req_fn = getattr(appt_request_otp, "__wrapped__", appt_request_otp)

with patch("app.appointments.routes.get_patient_by_code",
           return_value={"id": "pat-uuid-1", "patient_code": "LFL-J6MTOC"}), \
     patch("app.appointments.routes.create_otp_session", return_value="654321") as _mock_otp:
    _appt_otp_resp = _appt_req_fn(
        request=MagicMock(),
        body=ApptOtpRequestBody(patient_code="LFL-J6MTOC"),
        current_user={"role": "doctor", "user_id": 7},
    )
    check("appt_request_otp: returns OTP plaintext",   _appt_otp_resp.otp == "654321")
    check("appt_request_otp: returns patient_code",    _appt_otp_resp.patient_code == "LFL-J6MTOC")
    check("appt_request_otp: expires_in_minutes matches constant",
          _appt_otp_resp.expires_in_minutes == _APPT_TOKEN_EXPIRE_MINUTES)
    check("appt_request_otp: create_otp_session called with patient UUID",
          _mock_otp.call_args[0][0] == "pat-uuid-1")

# ── Unit: POST /appointments/request-otp — unknown patient -> 404 ─────────────
with patch("app.appointments.routes.get_patient_by_code", return_value=None):
    try:
        _appt_req_fn(
            request=MagicMock(),
            body=ApptOtpRequestBody(patient_code="LFL-XXXXXX"),
            current_user={"role": "doctor", "user_id": 7},
        )
        check("appt_request_otp: unknown patient -> 404", False, "no HTTPException raised")
    except _HTTPException as _e:
        check("appt_request_otp: unknown patient -> 404", _e.status_code == 404)

# ── Unit: POST /appointments/verify-otp — happy path ─────────────────────────
from app.appointments.routes import appt_verify_otp
from app.appointments.schemas import ApptOtpVerifyBody

_appt_verify_fn = getattr(appt_verify_otp, "__wrapped__", appt_verify_otp)
_PATIENT_ROW_APPT = {"id": "pat-uuid-1", "patient_code": "LFL-J6MTOC", "name": "Alice"}

with patch("app.appointments.routes.verify_otp", return_value=_PATIENT_ROW_APPT):
    _appt_verify_resp = _appt_verify_fn(
        request=MagicMock(),
        body=ApptOtpVerifyBody(patient_code="LFL-J6MTOC", otp="654321"),
        current_user={"role": "doctor", "user_id": 7},
    )
    check("appt_verify_otp: returns appt_token string",
          isinstance(_appt_verify_resp.appt_token, str) and len(_appt_verify_resp.appt_token) > 20)
    check("appt_verify_otp: expires_in_minutes matches constant",
          _appt_verify_resp.expires_in_minutes == _APPT_TOKEN_EXPIRE_MINUTES)

    _appt_tok_payload = verify_access_token(_appt_verify_resp.appt_token)
    check("appt_verify_otp: token role is 'appt_auth'",
          _appt_tok_payload is not None and _appt_tok_payload.get("role") == "appt_auth")
    check("appt_verify_otp: token patient_id matches patient row",
          _appt_tok_payload.get("patient_id") == "pat-uuid-1")

# ── Unit: POST /appointments/verify-otp — invalid OTP -> 401 ─────────────────
with patch("app.appointments.routes.verify_otp", return_value=None):
    try:
        _appt_verify_fn(
            request=MagicMock(),
            body=ApptOtpVerifyBody(patient_code="LFL-J6MTOC", otp="000000"),
            current_user={"role": "doctor", "user_id": 7},
        )
        check("appt_verify_otp: invalid OTP -> 401", False, "no HTTPException raised")
    except _HTTPException as _e:
        check("appt_verify_otp: invalid OTP -> 401", _e.status_code == 401)

# ── Unit: appt_auth token rejected by require_staff / require_doctor ──────────
_appt_tok_dict = {"sub": "appt_auth", "role": "appt_auth", "patient_id": "pat-uuid-1"}
try:
    _require_staff(_appt_tok_dict)
    check("appt_auth role rejected by require_staff", False, "no HTTPException raised")
except _HTTPException as _e:
    check("appt_auth role rejected by require_staff", _e.status_code == 403)

try:
    _require_doctor(_appt_tok_dict)
    check("appt_auth role rejected by require_doctor", False, "no HTTPException raised")
except _HTTPException as _e:
    check("appt_auth role rejected by require_doctor", _e.status_code == 403)

# ── Unit: POST /appointments — wrong-patient appt_token -> 403 ───────────────
from app.appointments.routes import create_appointment as _create_appt
from app.appointments.schemas import CreateAppointmentBody

_wrong_appt_token = create_access_token(
    {"sub": "appt_auth", "role": "appt_auth", "patient_id": "pat-uuid-OTHER"},
    expire_minutes=_APPT_TOKEN_EXPIRE_MINUTES,
)
_right_appt_token = create_access_token(
    {"sub": "appt_auth", "role": "appt_auth", "patient_id": "pat-uuid-1"},
    expire_minutes=_APPT_TOKEN_EXPIRE_MINUTES,
)

# Wrong-patient token -> 403
try:
    _create_appt(
        body=CreateAppointmentBody(
            patient_id="pat-uuid-1", date="2025-12-01", time="09:00",
            type="Consultation", appt_token=_wrong_appt_token,
        ),
        current_user={"role": "doctor", "user_id": 7},
    )
    check("POST /appointments: wrong-patient appt_token -> 403", False, "no HTTPException raised")
except _HTTPException as _e:
    check("POST /appointments: wrong-patient appt_token -> 403", _e.status_code == 403)

# Invalid token -> 401
try:
    _create_appt(
        body=CreateAppointmentBody(
            patient_id="pat-uuid-1", date="2025-12-01", time="09:00",
            type="Consultation", appt_token="not.a.valid.jwt",
        ),
        current_user={"role": "doctor", "user_id": 7},
    )
    check("POST /appointments: invalid appt_token -> 401", False, "no HTTPException raised")
except _HTTPException as _e:
    check("POST /appointments: invalid appt_token -> 401", _e.status_code == 401)

# Non-doctor role -> 403 (even with a valid appt_token)
try:
    _create_appt(
        body=CreateAppointmentBody(
            patient_id="pat-uuid-1", date="2025-12-01", time="09:00",
            type="Consultation", appt_token=_right_appt_token,
        ),
        current_user={"role": "clerk", "user_id": 8},
    )
    check("POST /appointments: clerk role -> 403", False, "no HTTPException raised")
except _HTTPException as _e:
    check("POST /appointments: clerk role -> 403", _e.status_code == 403)

# Valid token + valid doctor + valid consent -> reaches service (mock service to avoid DB)
with patch("app.appointments.routes.check_doctor_consent", return_value=True), \
     patch("app.appointments.routes.appt_service.create_appointment",
           return_value={"id": "appt-1", "patient_id": "pat-uuid-1", "doctor_id": 7,
                         "date": "2025-12-01", "time": "09:00", "type": "Consultation",
                         "location": None, "notes": None, "status": "upcoming",
                         "created_at": "2025-11-01T10:00:00"}):
    _appt_result = _create_appt(
        body=CreateAppointmentBody(
            patient_id="pat-uuid-1", date="2025-12-01", time="09:00",
            type="Consultation", appt_token=_right_appt_token,
        ),
        current_user={"role": "doctor", "user_id": 7},
    )
    check("POST /appointments: valid token + consent -> appointment created",
          _appt_result["id"] == "appt-1")

# appt_token NOT included in what is passed to the service layer
with patch("app.appointments.routes.check_doctor_consent", return_value=True), \
     patch("app.appointments.routes.appt_service.create_appointment",
           return_value={"id": "appt-2", "patient_id": "pat-uuid-1", "doctor_id": 7,
                         "date": "2025-12-01", "time": "09:00", "type": "Consultation",
                         "location": None, "notes": None, "status": "upcoming",
                         "created_at": "2025-11-01T10:00:00"}) as _mock_create:
    _create_appt(
        body=CreateAppointmentBody(
            patient_id="pat-uuid-1", date="2025-12-01", time="09:00",
            type="Consultation", appt_token=_right_appt_token,
        ),
        current_user={"role": "doctor", "user_id": 7},
    )
    _service_data = _mock_create.call_args[1].get("data") or _mock_create.call_args[0][1]
    check("POST /appointments: appt_token NOT forwarded to service layer",
          "appt_token" not in _service_data)

# ── POST /upload: no upload_token needed (plain staff JWT is enough) ───────────
from app.api.upload import upload_report as _upload_report

async def _test_upload_no_token():
    """Upload should reject a missing patient, but NOT 401/403 for missing token."""
    try:
        await _upload_report(
            patient_id="non-existent-patient",
            file=MagicMock(filename="test.pdf"),
            report_type="Blood Test",
            current_user={"role": "doctor", "user_id": 7},
        )
        return None
    except _HTTPException as _e:
        return _e.status_code

# Patch get_patient_by_id to return None (404) so the test is fast (no OCR).
with patch("app.api.upload.get_patient_by_id", return_value=None):
    _upload_no_tok_status = _asyncio.run(_test_upload_no_token())
check("POST /upload: no upload_token param needed — gets 404 (not 401/422)",
      _upload_no_tok_status == 404)

# ═══════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════
total = passed + failed
colour = GREEN if failed == 0 else RED
print(f"\n{'='*62}")
print(f"  {colour}{passed}/{total} BE-1 static checks passed{RESET}")
print(f"{'='*62}\n")

if failed:
    sys.exit(1)
