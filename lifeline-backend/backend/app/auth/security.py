from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config.settings import settings


SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.JWT_EXPIRE_MINUTES

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash a plain-text password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expire_minutes: int | None = None) -> str:
    """Create a JWT access token.

    Args:
        data: Claims to encode into the token.
        expire_minutes: Optional override for expiry duration.
                        Defaults to settings.JWT_EXPIRE_MINUTES.
    """
    to_encode = data.copy()

    minutes = expire_minutes if expire_minutes is not None else ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_access_token(token: str):
    """Decode and verify a JWT. Returns payload dict or None."""
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        return payload

    except JWTError:
        return None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Dependency: verify JWT and return the decoded payload.

    Available payload keys after Step 2:
      - user_id  (int)   — for doctor/clerk tokens
      - role     (str)   — 'doctor' | 'clerk' | 'patient'
      - sub      (str)   — email (doctor/clerk) or patient_code (patient, Step 3+)
    """
    token = credentials.credentials

    payload = verify_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    return payload


def require_doctor(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency: allow only users with role='doctor'.

    Use on any endpoint that doctors can access but clerks cannot
    (e.g. reading patient records, generating summaries, Vitalis chat).
    """
    if current_user.get("role") != "doctor":
        raise HTTPException(
            status_code=403,
            detail="Doctor access required"
        )
    return current_user


def require_staff(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency: allow users with role='doctor' OR role='clerk'.

    Use on any endpoint that both staff roles share
    (e.g. creating patients, uploading reports).
    """
    if current_user.get("role") not in {"doctor", "clerk"}:
        raise HTTPException(
            status_code=403,
            detail="Staff access required"
        )
    return current_user


def require_patient(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency: allow only tokens with role='patient'.

    Use on patient-portal endpoints (timeline, summary, Vitalis)
    when accessed by a patient via their short-lived OTP-issued token.
    """
    if current_user.get("role") != "patient":
        raise HTTPException(
            status_code=403,
            detail="Patient access required"
        )
    return current_user

