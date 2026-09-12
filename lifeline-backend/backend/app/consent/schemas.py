from pydantic import BaseModel, field_validator


class ConsentRequestResponse(BaseModel):
    """Returned on every consent endpoint response."""
    id: str
    doctor_id: int
    patient_id: str
    status: str
    requested_at: str
    responded_at: str | None
    expires_at: str | None


class RequestConsentBody(BaseModel):
    """Body for POST /consent/request — doctor supplies the patient UUID."""
    patient_id: str


class RespondToConsentRequest(BaseModel):
    """Body for POST /consent/{consent_id}/respond — patient approves or denies."""
    action: str

    @field_validator("action")
    @classmethod
    def action_must_be_valid(cls, v: str) -> str:
        allowed = {"approved", "denied"}
        if v not in allowed:
            raise ValueError(
                f"action must be one of: {', '.join(sorted(allowed))}"
            )
        return v


class ConsentStatusResponse(BaseModel):
    """Response for GET /consent/status/{patient_id}."""
    patient_id: str
    has_consent: bool
