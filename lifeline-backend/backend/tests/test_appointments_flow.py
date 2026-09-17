"""Tests for the patient-requests / doctor-confirms appointment flow.

Offline — Supabase calls are mocked; no running server or database needed.

Run with:
  venv\\Scripts\\python.exe -m pytest tests/test_appointments_flow.py -v
"""

import os
import sys
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Dummy values so settings load even without a .env file (never real secrets).
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("GOOGLE_VISION_API_KEY", "unused")

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.appointments import service as appt_service
from app.appointments.routes import appointments_router
from app.auth.security import create_access_token
from app.utils.limiter import limiter

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(appointments_router)
client = TestClient(app)

PATIENT_ID = "d07a5673-b987-4138-b814-1393071110d3"
OTHER_PATIENT_ID = "11111111-2222-3333-4444-555555555555"
DOCTOR_ID = 17
OTHER_DOCTOR_ID = 99
APPT_ID = "a1111111-0000-0000-0000-000000000001"
TOMORROW = (date.today() + timedelta(days=1)).isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def patient_token():
    return create_access_token({"sub": "LFL-TEST01", "role": "patient", "patient_id": PATIENT_ID})


@pytest.fixture
def doctor_token():
    return create_access_token({"sub": "doc@x.com", "role": "doctor", "user_id": DOCTOR_ID})


@pytest.fixture
def clerk_token():
    return create_access_token({"sub": "clerk@x.com", "role": "clerk", "user_id": 5})


@pytest.fixture(autouse=True)
def _reset_limiter():
    limiter.reset()
    yield


def _row(status="pending", **overrides):
    row = {
        "id": APPT_ID,
        "patient_id": PATIENT_ID,
        "doctor_id": DOCTOR_ID,
        "date": TOMORROW,
        "time": "Morning",
        "location": None,
        "type": "Consultation",
        "reason": "Chest pain",
        "notes": None,
        "status": status,
        "created_at": "2026-09-17T10:00:00Z",
    }
    row.update(overrides)
    return row


def _update_mock(existing):
    """Supabase mock: select returns `existing`; update echoes the merged row."""
    mock = MagicMock()
    table = mock.table.return_value
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = (
        [existing] if existing else []
    )

    def _update(payload):
        chain = MagicMock()
        chain.eq.return_value.execute.return_value.data = [{**existing, **payload}]
        return chain

    table.update.side_effect = _update
    return mock


# ── Create (patient requests) ──────────────────────────────────────────────────

def test_patient_can_request(patient_token):
    with patch.object(appt_service, "create_appointment", return_value=_row()) as mock_create:
        r = client.post(
            "/appointments",
            headers=_auth(patient_token),
            json={"doctor_id": DOCTOR_ID, "date": TOMORROW, "time": "Morning",
                  "type": "Consultation", "reason": "Chest pain"},
        )
    assert r.status_code == 201
    assert r.json()["status"] == "pending"
    # patient_id comes from the token, never the body
    assert mock_create.call_args.kwargs["patient_id"] == PATIENT_ID


def test_doctor_cannot_create(doctor_token):
    r = client.post(
        "/appointments",
        headers=_auth(doctor_token),
        json={"doctor_id": DOCTOR_ID, "date": TOMORROW, "time": "10:00", "type": "Consultation"},
    )
    assert r.status_code == 403


def test_request_in_past_rejected(patient_token):
    r = client.post(
        "/appointments",
        headers=_auth(patient_token),
        json={"doctor_id": DOCTOR_ID, "date": YESTERDAY, "time": "Morning", "type": "Consultation"},
    )
    assert r.status_code == 422


def test_request_unknown_doctor_404(patient_token):
    with patch.object(appt_service, "create_appointment", return_value="doctor_not_found"):
        r = client.post(
            "/appointments",
            headers=_auth(patient_token),
            json={"doctor_id": 12345, "date": TOMORROW, "time": "Morning", "type": "Consultation"},
        )
    assert r.status_code == 404


def test_duplicate_pending_409(patient_token):
    with patch.object(appt_service, "create_appointment", return_value="duplicate_pending"):
        r = client.post(
            "/appointments",
            headers=_auth(patient_token),
            json={"doctor_id": DOCTOR_ID, "date": TOMORROW, "time": "Morning", "type": "Consultation"},
        )
    assert r.status_code == 409


def test_create_service_checks_doctor_role():
    mock = MagicMock()
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    with patch.object(appt_service, "supabase", mock):
        result = appt_service.create_appointment(
            PATIENT_ID, {"doctor_id": 5, "date": TOMORROW, "time": "Morning", "type": "Consultation"}
        )
    assert result == "doctor_not_found"
    mock.table.return_value.insert.assert_not_called()


# ── Doctor list ────────────────────────────────────────────────────────────────

def test_doctor_list_patient_only(patient_token, doctor_token):
    with patch.object(appt_service, "list_doctors", return_value=[{"id": 1, "name": "Dr A", "specialization": "Cardiology"}]):
        assert client.get("/appointments/doctors", headers=_auth(patient_token)).status_code == 200
    assert client.get("/appointments/doctors", headers=_auth(doctor_token)).status_code == 403


# ── Doctor approves / declines ─────────────────────────────────────────────────

def test_doctor_approves_with_schedule(doctor_token):
    mock = _update_mock(_row())
    with patch.object(appt_service, "supabase", mock):
        r = client.patch(
            f"/appointments/{APPT_ID}",
            headers=_auth(doctor_token),
            json={"status": "upcoming", "date": TOMORROW, "time": "10:30", "location": "Room 4"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "upcoming"
    assert body["time"] == "10:30"
    assert body["location"] == "Room 4"


def test_doctor_approve_without_location_422(doctor_token):
    mock = _update_mock(_row())
    with patch.object(appt_service, "supabase", mock):
        r = client.patch(
            f"/appointments/{APPT_ID}",
            headers=_auth(doctor_token),
            json={"status": "upcoming", "time": "10:30"},
        )
    assert r.status_code == 422
    mock.table.return_value.update.assert_not_called()


def test_doctor_declines_with_reason(doctor_token):
    mock = _update_mock(_row())
    with patch.object(appt_service, "supabase", mock):
        r = client.patch(
            f"/appointments/{APPT_ID}",
            headers=_auth(doctor_token),
            json={"status": "rejected", "notes": "Please see a cardiologist"},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"
    assert r.json()["notes"] == "Please see a cardiologist"


def test_other_doctor_forbidden(doctor_token):
    mock = _update_mock(_row(doctor_id=OTHER_DOCTOR_ID))
    with patch.object(appt_service, "supabase", mock):
        r = client.patch(
            f"/appointments/{APPT_ID}",
            headers=_auth(doctor_token),
            json={"status": "upcoming", "date": TOMORROW, "time": "10:30", "location": "Room 4"},
        )
    assert r.status_code == 403


def test_complete_only_from_upcoming(doctor_token):
    with patch.object(appt_service, "supabase", _update_mock(_row("pending"))):
        r = client.patch(f"/appointments/{APPT_ID}", headers=_auth(doctor_token), json={"status": "completed"})
    assert r.status_code == 409

    with patch.object(appt_service, "supabase", _update_mock(_row("upcoming", location="Room 4"))):
        r = client.patch(f"/appointments/{APPT_ID}", headers=_auth(doctor_token), json={"status": "completed"})
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


def test_cannot_approve_twice(doctor_token):
    with patch.object(appt_service, "supabase", _update_mock(_row("rejected"))):
        r = client.patch(
            f"/appointments/{APPT_ID}",
            headers=_auth(doctor_token),
            json={"status": "upcoming", "date": TOMORROW, "time": "10:30", "location": "Room 4"},
        )
    assert r.status_code == 409


# ── Patient permissions ────────────────────────────────────────────────────────

def test_patient_cannot_approve(patient_token):
    mock = _update_mock(_row())
    with patch.object(appt_service, "supabase", mock):
        r = client.patch(f"/appointments/{APPT_ID}", headers=_auth(patient_token), json={"status": "upcoming"})
    assert r.status_code == 403
    mock.table.return_value.update.assert_not_called()


def test_patient_cannot_edit_schedule(patient_token):
    mock = _update_mock(_row("upcoming", location="Room 4"))
    with patch.object(appt_service, "supabase", mock):
        r = client.patch(f"/appointments/{APPT_ID}", headers=_auth(patient_token), json={"location": "My house"})
    assert r.status_code == 403


def test_patient_can_cancel_own(patient_token):
    with patch.object(appt_service, "supabase", _update_mock(_row())):
        r = client.patch(f"/appointments/{APPT_ID}", headers=_auth(patient_token), json={"status": "cancelled"})
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


def test_patient_cannot_touch_others(patient_token):
    with patch.object(appt_service, "supabase", _update_mock(_row(patient_id=OTHER_PATIENT_ID))):
        r = client.delete(f"/appointments/{APPT_ID}", headers=_auth(patient_token))
    assert r.status_code == 403


def test_cannot_cancel_completed(patient_token):
    with patch.object(appt_service, "supabase", _update_mock(_row("completed"))):
        r = client.delete(f"/appointments/{APPT_ID}", headers=_auth(patient_token))
    assert r.status_code == 409


# ── Listing ────────────────────────────────────────────────────────────────────

def test_list_flattens_names(patient_token):
    mock = MagicMock()
    mock.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
        {**_row(), "users": {"name": "Dr A", "specialization": "Cardiology"},
         "patients": {"name": "Pat", "patient_code": "LFL-TEST01"}}
    ]
    with patch.object(appt_service, "supabase", mock):
        r = client.get("/appointments", headers=_auth(patient_token))
    assert r.status_code == 200
    item = r.json()[0]
    assert item["doctor_name"] == "Dr A"
    assert item["patient_code"] == "LFL-TEST01"
    assert item["reason"] == "Chest pain"


def test_clerk_blocked(clerk_token):
    assert client.get("/appointments", headers=_auth(clerk_token)).status_code == 403
    assert client.delete(f"/appointments/{APPT_ID}", headers=_auth(clerk_token)).status_code == 403
