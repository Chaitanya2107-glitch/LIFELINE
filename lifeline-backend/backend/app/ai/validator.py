from app.schemas.medical_record import MedicalRecord


def validate_medical_record(data: dict) -> MedicalRecord:
    """
    Validate AI output using the MedicalRecord schema.
    """

    return MedicalRecord(**data)
