"""Tests for the pharmacy tier.

Offline — Supabase calls are mocked; no running server or database needed.

Run with:
  venv\\Scripts\\python.exe -m pytest tests/test_pharmacy.py -v

Covers:
1. Non-pharmacist role hitting GET /pharmacy/prescriptions gets 403 (role check).
2. Pharmacist with no approved consent gets 403 (consent check).
3. Pharmacist with approved consent gets the prescription list (200).
4. POST /pharmacy/dispense succeeds, updates prescription_status to 'dispensed',
   and writes exactly one access_logs row via write_access_log.
5. Dispensing a prescription that belongs to another patient returns 404.
6. Dispensing an already-dispensed prescription returns 409.
7. Dispense without consent returns 403 and never touches the database.
8. Patient lookup returns identity fields only.
9. Access request is written with actor_role='pharmacist'.
10. Doctor token is rejected on every pharmacy endpoint.
"""

import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Dummy values so settings load even without a .env file (never real secrets).
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("GOOGLE_VISION_API_KEY", "unused")

from app.auth.security import create_access_token
from app.pharmacy.routes import router as pharmacy_router

app = FastAPI()
app.include_router(pharmacy_router)
client = TestClient(app)

PATIENT_ID = "d07a5673-b987-4138-b814-1393071110d3"
OTHER_PATIENT_ID = "11111111-2222-3333-4444-555555555555"
PHARMACIST_ID = 42
DOCTOR_ID = 17
PRESCRIPTION_STATUS_ID = "8f3b2024-9dfa-4fa0-82a1-35cbaf887102"
RECORD_ID = "b1a8c880-36f0-466d-9783-a7c36a445d44"
MEDICINES = [{"name": "Amoxicillin", "dosage": "500mg", "frequency": "TDS"}]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def pharmacist_token():
    return create_access_token({
        "sub": "pharmacist@hospital.com",
        "role": "pharmacist",
        "user_id": PHARMACIST_ID,
    })


@pytest.fixture
def doctor_token():
    return create_access_token({
        "sub": "doctor@hospital.com",
        "role": "doctor",
        "user_id": DOCTOR_ID,
    })


def _mock_supabase(existing_status, update_data=None, event=None):
    """Build a supabase mock for the dispense path."""
    mock_supa = MagicMock()
    table = mock_supa.table.return_value
    table.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = (
        [existing_status] if existing_status else []
    )
    table.update.return_value.eq.return_value.neq.return_value.execute.return_value.data = (
        update_data if update_data is not None else [{"id": PRESCRIPTION_STATUS_ID}]
    )
    table.insert.return_value.execute.return_value.data = [event] if event else []
    return mock_supa


def _existing(status="prescribed", patient_id=PATIENT_ID):
    return {
        "id": PRESCRIPTION_STATUS_ID,
        "medical_record_id": RECORD_ID,
        "status": status,
        "created_at": "2026-09-15T10:00:00Z",
        "updated_at": "2026-09-15T10:00:00Z",
        "medical_records": {"patient_id": patient_id, "medicines": MEDICINES},
    }


def test_non_pharmacist_prescriptions_403(doctor_token):
    """1. Non-pharmacist role hitting /pharmacy/prescriptions gets 403."""
    response = client.get(
        f"/pharmacy/prescriptions?patient_id={PATIENT_ID}",
        headers=_auth(doctor_token),
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Pharmacist access required"


def test_pharmacist_no_approved_consent_403(pharmacist_token):
    """2. Pharmacist with no approved consent gets 403."""
    with patch("app.pharmacy.routes.pharmacy_service.check_pharmacy_consent", return_value=False) as mock_consent:
        response = client.get(
            f"/pharmacy/prescriptions?patient_id={PATIENT_ID}",
            headers=_auth(pharmacist_token),
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "No approved consent found for this patient"
        mock_consent.assert_called_once_with(PHARMACIST_ID, PATIENT_ID)


def test_pharmacist_approved_consent_gets_prescriptions(pharmacist_token):
    """3. Pharmacist with approved consent gets the prescription list."""
    mock_supa = MagicMock()
    mock_supa.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
        {
            "id": PRESCRIPTION_STATUS_ID,
            "medical_record_id": RECORD_ID,
            "status": "prescribed",
            "created_at": "2026-09-15T10:00:00Z",
            "updated_at": "2026-09-15T10:00:00Z",
            "medical_records": {
                "id": RECORD_ID,
                "patient_id": PATIENT_ID,
                "medicines": MEDICINES,
                "report_type": "Prescription",
                "created_at": "2026-09-15T09:00:00Z",
                "users": {"name": "Dr. Test"},
            },
        }
    ]

    with patch("app.pharmacy.routes.pharmacy_service.check_pharmacy_consent", return_value=True):
        with patch("app.pharmacy.service.supabase", mock_supa):
            response = client.get(
                f"/pharmacy/prescriptions?patient_id={PATIENT_ID}",
                headers=_auth(pharmacist_token),
            )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == PRESCRIPTION_STATUS_ID
    assert data[0]["status"] == "prescribed"
    assert data[0]["medicines"][0]["name"] == "Amoxicillin"
    assert data[0]["patient_id"] == PATIENT_ID
    assert data[0]["prescribed_by"] == "Dr. Test"
    assert data[0]["report_type"] == "Prescription"


def test_dispense_success_updates_status_and_writes_access_log(pharmacist_token):
    """4. Dispense succeeds, updates prescription_status, writes one access_logs row."""
    items = [{"name": "Amoxicillin", "quantity": 10}]
    event = {
        "id": "event-uuid-5555",
        "prescription_status_id": PRESCRIPTION_STATUS_ID,
        "pharmacist_id": PHARMACIST_ID,
        "patient_id": PATIENT_ID,
        "items": items,
        "dispensed_at": "2026-09-15T11:00:00Z",
    }
    mock_supa = _mock_supabase(_existing(), event=event)

    with patch("app.pharmacy.routes.pharmacy_service.check_pharmacy_consent", return_value=True):
        with patch("app.pharmacy.service.supabase", mock_supa):
            with patch("app.pharmacy.service.write_access_log") as mock_write_log:
                response = client.post(
                    "/pharmacy/dispense",
                    headers=_auth(pharmacist_token),
                    json={
                        "prescription_status_id": PRESCRIPTION_STATUS_ID,
                        "patient_id": PATIENT_ID,
                        "items": items,
                    },
                )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "event-uuid-5555"
    assert data["pharmacist_id"] == PHARMACIST_ID

    update_payload = mock_supa.table.return_value.update.call_args.args[0]
    assert update_payload["status"] == "dispensed"

    mock_write_log.assert_called_once()
    kwargs = mock_write_log.call_args.kwargs
    assert kwargs["actor_role"] == "pharmacist"
    assert kwargs["action"] == "dispensed"
    assert kwargs["actor_user_id"] == PHARMACIST_ID
    assert kwargs["patient_id"] == PATIENT_ID
    assert kwargs["metadata"]["dispense_event_id"] == "event-uuid-5555"


def test_dispense_other_patients_prescription_404(pharmacist_token):
    """5. Consent for patient A cannot be used to dispense patient B's prescription."""
    mock_supa = _mock_supabase(_existing(patient_id=OTHER_PATIENT_ID))

    with patch("app.pharmacy.routes.pharmacy_service.check_pharmacy_consent", return_value=True):
        with patch("app.pharmacy.service.supabase", mock_supa):
            response = client.post(
                "/pharmacy/dispense",
                headers=_auth(pharmacist_token),
                json={"prescription_status_id": PRESCRIPTION_STATUS_ID, "patient_id": PATIENT_ID},
            )

    assert response.status_code == 404
    mock_supa.table.return_value.update.assert_not_called()
    mock_supa.table.return_value.insert.assert_not_called()


def test_dispense_already_dispensed_409(pharmacist_token):
    """6. A dispensed prescription cannot be dispensed again."""
    mock_supa = _mock_supabase(_existing(status="dispensed"))

    with patch("app.pharmacy.routes.pharmacy_service.check_pharmacy_consent", return_value=True):
        with patch("app.pharmacy.service.supabase", mock_supa):
            response = client.post(
                "/pharmacy/dispense",
                headers=_auth(pharmacist_token),
                json={"prescription_status_id": PRESCRIPTION_STATUS_ID, "patient_id": PATIENT_ID},
            )

    assert response.status_code == 409
    mock_supa.table.return_value.insert.assert_not_called()


def test_dispense_race_lost_409(pharmacist_token):
    """6b. If the conditional update matches nothing (someone else dispensed), return 409."""
    mock_supa = _mock_supabase(_existing(), update_data=[])

    with patch("app.pharmacy.routes.pharmacy_service.check_pharmacy_consent", return_value=True):
        with patch("app.pharmacy.service.supabase", mock_supa):
            response = client.post(
                "/pharmacy/dispense",
                headers=_auth(pharmacist_token),
                json={"prescription_status_id": PRESCRIPTION_STATUS_ID, "patient_id": PATIENT_ID},
            )

    assert response.status_code == 409
    mock_supa.table.return_value.insert.assert_not_called()


def test_dispense_without_consent_403(pharmacist_token):
    """7. No consent → 403 before any database access."""
    mock_supa = MagicMock()
    with patch("app.pharmacy.routes.pharmacy_service.check_pharmacy_consent", return_value=False):
        with patch("app.pharmacy.service.supabase", mock_supa):
            response = client.post(
                "/pharmacy/dispense",
                headers=_auth(pharmacist_token),
                json={"prescription_status_id": PRESCRIPTION_STATUS_ID, "patient_id": PATIENT_ID},
            )
    assert response.status_code == 403
    mock_supa.table.assert_not_called()


def test_patient_lookup_returns_identity_only(pharmacist_token):
    """8. Lookup exposes only id, patient_code and name."""
    patient_row = {
        "id": PATIENT_ID,
        "patient_code": "LFL-J6MTOC",
        "name": "Test Patient",
        "phone": "9999999999",
        "password_hash": "secret-hash",
        "blood_group": "O+",
    }
    with patch("app.pharmacy.routes.patient_service.get_patient_by_code", return_value=patient_row):
        with patch("app.pharmacy.routes.write_access_log"):
            response = client.get(
                "/pharmacy/patients/code/LFL-J6MTOC",
                headers=_auth(pharmacist_token),
            )
    assert response.status_code == 200
    assert set(response.json().keys()) == {"id", "patient_code", "name"}


def test_access_request_uses_pharmacist_role(pharmacist_token):
    """9. Consent request is created with actor_role='pharmacist'."""
    row = {
        "id": "consent-1",
        "doctor_id": PHARMACIST_ID,
        "patient_id": PATIENT_ID,
        "status": "pending",
        "requested_at": "2026-09-15T10:00:00Z",
        "responded_at": None,
        "expires_at": None,
    }
    with patch("app.pharmacy.routes.consent_service.request_consent", return_value=row) as mock_req:
        response = client.post(
            "/pharmacy/access-request",
            headers=_auth(pharmacist_token),
            json={"patient_id": PATIENT_ID},
        )
    assert response.status_code == 200
    mock_req.assert_called_once_with(PHARMACIST_ID, PATIENT_ID, actor_role="pharmacist")


@pytest.mark.parametrize("method,path,body", [
    ("get", "/pharmacy/patients/code/LFL-J6MTOC", None),
    ("post", "/pharmacy/access-request", {"patient_id": PATIENT_ID}),
    ("get", "/pharmacy/access-requests", None),
    ("post", "/pharmacy/dispense", {"prescription_status_id": PRESCRIPTION_STATUS_ID, "patient_id": PATIENT_ID}),
    ("get", "/pharmacy/dispense-history", None),
])
def test_doctor_rejected_everywhere(doctor_token, method, path, body):
    """10. Every pharmacy endpoint rejects a doctor token."""
    kwargs = {"headers": _auth(doctor_token)}
    if body is not None:
        kwargs["json"] = body
    response = getattr(client, method)(path, **kwargs)
    assert response.status_code == 403
