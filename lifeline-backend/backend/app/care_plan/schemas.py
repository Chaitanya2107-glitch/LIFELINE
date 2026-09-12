from pydantic import BaseModel, field_validator


class CarePlanItem(BaseModel):
    """Response schema — one row from the care_plan table."""
    id: str
    patient_id: str
    category: str
    title: str
    description: str
    due_date: str | None
    status: str
    priority: str
    source_record_id: str | None
    created_at: str


class UpdateCarePlanBody(BaseModel):
    """Body for PATCH /care-plan/{item_id} — only status is writable."""
    status: str

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, v: str) -> str:
        allowed = {"pending", "ongoing", "completed"}
        if v not in allowed:
            raise ValueError(
                f"status must be one of: {', '.join(sorted(allowed))}"
            )
        return v
