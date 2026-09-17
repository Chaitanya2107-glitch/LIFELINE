"""Appointments routes.

Route declaration order (literals before parameterised):

  GET    /appointments/doctors      -- patient: doctors available to book with
  GET    /appointments              -- patient: own; doctor: own
  POST   /appointments              -- patient only; requests an appointment (status='pending')
  PATCH  /appointments/{id}         -- doctor approves/declines/completes/edits; patient cancels
  DELETE /appointments/{id}         -- cancel (sets status='cancelled', owner only)

Request flow (patient asks, doctor confirms):
  1. Patient calls POST /appointments with a doctor, preferred date/time and reason.
  2. Doctor calls PATCH /appointments/{id} with status='upcoming' plus the
     confirmed date, time and location — or status='rejected' to decline.
  3. Patient sees the confirmed appointment in GET /appointments.
  4. Doctor may later mark it 'completed'; either side may cancel.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from app.appointments import service as appt_service
from app.appointments.schemas import (
    Appointment,
    CreateAppointmentBody,
    DoctorOption,
    UpdateAppointmentBody,
)
from app.auth.security import (
    get_current_user,
    require_patient,
)
from app.utils.limiter import limiter

appointments_router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
)

_ERRORS = {
    "not_found": (404, "Appointment not found"),
    "forbidden": (403, "Access denied"),
    "forbidden_transition": (403, "You are not allowed to make this change"),
    "invalid_transition": (409, "This change is not allowed for the current appointment state"),
    "missing_schedule": (422, "Date, time and location are required to confirm an appointment"),
    "doctor_not_found": (404, "Doctor not found"),
    "duplicate_pending": (409, "You already have a pending request with this doctor"),
}


def _raise_if_error(result):
    if isinstance(result, str):
        status_code, detail = _ERRORS[result]
        raise HTTPException(status_code=status_code, detail=detail)
    return result


def _owner_id(current_user: dict):
    """Return (role, owner id) for patient/doctor tokens; 403 for anyone else."""
    role = current_user.get("role")
    if role == "patient":
        return role, current_user["patient_id"]
    if role == "doctor":
        return role, current_user["user_id"]
    raise HTTPException(status_code=403, detail="Access denied")


# ── GET /appointments/doctors ──────────────────────────────────────────────────

@appointments_router.get("/doctors", response_model=list[DoctorOption])
def list_doctors(
    current_user: dict = Depends(require_patient),
):
    """List doctors the patient can request an appointment with.

    Accessible by: patient only. Returns id, name and specialization only.
    """
    return appt_service.list_doctors()


# ── GET /appointments ──────────────────────────────────────────────────────────

@appointments_router.get("", response_model=list[Appointment])
def get_appointments(
    current_user: dict = Depends(get_current_user),
):
    """Return appointments for the authenticated caller.

    - Patient token: all appointments where patient_id matches JWT.
    - Doctor token:  all appointments where doctor_id matches JWT
      (incoming requests included).
    - Anyone else:   403.
    """
    role, owner_id = _owner_id(current_user)
    if role == "patient":
        return appt_service.get_appointments(role="patient", user_id=None, patient_id=owner_id)
    return appt_service.get_appointments(role="doctor", user_id=owner_id)


# ── POST /appointments ─────────────────────────────────────────────────────────

@appointments_router.post("", response_model=Appointment, status_code=201)
@limiter.limit("10/minute")
def create_appointment(
    request: Request,
    body: CreateAppointmentBody,
    current_user: dict = Depends(require_patient),
):
    """Patient requests an appointment with a doctor.

    Accessible by: patient only.
    Created with status='pending'. The doctor confirms the final date,
    time and location (PATCH status='upcoming') or declines it.
    409 if the patient already has a pending request with this doctor.
    """
    result = appt_service.create_appointment(
        patient_id=current_user["patient_id"],
        data=body.model_dump(),
    )
    return _raise_if_error(result)


# ── PATCH /appointments/{id} ───────────────────────────────────────────────────

@appointments_router.patch("/{appt_id}", response_model=Appointment)
def update_appointment(
    appt_id: str,
    body: UpdateAppointmentBody,
    current_user: dict = Depends(get_current_user),
):
    """Update an appointment.

    - Doctor:  approve a request (status='upcoming' with date, time, location),
               decline it (status='rejected', optional notes as the reason),
               mark 'completed', cancel, or edit date/time/location/notes.
    - Patient: may only cancel (status='cancelled').
    - Others:  403.

    Ownership is always enforced: patient must own patient_id, doctor must own doctor_id.
    """
    role, owner_id = _owner_id(current_user)

    result = appt_service.update_appointment(
        appt_id=appt_id,
        role=role,
        user_id=owner_id,
        payload=body.model_dump(exclude_unset=True),
    )
    return _raise_if_error(result)


# ── DELETE /appointments/{id} ──────────────────────────────────────────────────

@appointments_router.delete("/{appt_id}", response_model=Appointment)
def cancel_appointment(
    appt_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Cancel a pending or upcoming appointment (sets status to 'cancelled').

    - Patient token: must own the appointment.
    - Doctor token:  must own the appointment.
    - Others:        403.
    """
    role, owner_id = _owner_id(current_user)

    result = appt_service.cancel_appointment(
        appt_id=appt_id,
        role=role,
        user_id=owner_id,
    )
    return _raise_if_error(result)
