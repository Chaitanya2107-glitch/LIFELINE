from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    specialization: Optional[str] = None
    # Nullable at DB level; required for role='doctor' by the validator below.
    med_reg_no: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: str) -> str:
        allowed = {"doctor", "clerk"}
        if v not in allowed:
            raise ValueError(f"role must be one of: {', '.join(sorted(allowed))}")
        return v

    @model_validator(mode="after")
    def med_reg_no_required_for_doctors(self) -> "RegisterRequest":
        """Doctors must supply a medical registration number.

        Clerks do not require one.  The DB column is nullable to support clerks,
        but the application layer enforces presence for the 'doctor' role here.
        """
        if self.role == "doctor" and not self.med_reg_no:
            raise ValueError(
                "med_reg_no is required for doctors"
            )
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: str

    class Config:
        from_attributes = True
