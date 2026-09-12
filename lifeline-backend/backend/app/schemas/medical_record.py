from pydantic import BaseModel, Field


class MedicineItem(BaseModel):
    name: str = ""
    dosage: str = ""
    frequency: str = ""
    duration: str = ""


class LabValueItem(BaseModel):
    name: str = ""
    value: str = ""
    unit: str = ""
    date: str | None = None
    normal: bool = True


class MedicalRecord(BaseModel):
    doctor: str | None = None
    hospital: str | None = None

    dates: list[str] = Field(default_factory=list)

    diagnosis: list[str] = Field(default_factory=list)
    medicines: list[MedicineItem] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)

    lab_values: list[LabValueItem] = Field(default_factory=list)

    procedures: list[str] = Field(default_factory=list)
    follow_ups: list[str] = Field(default_factory=list)

    raw_text: str = ""
