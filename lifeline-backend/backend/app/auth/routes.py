from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.auth.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database.supabase import supabase
from app.services.audit_service import write_access_log
from app.utils.limiter import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", status_code=201)
def register(user: RegisterRequest):

    # Check if email already exists
    existing = (
        supabase.table("users")
        .select("id")
        .eq("email", user.email)
        .limit(1)
        .execute()
    )

    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Build insert payload.
    # med_reg_no is always persisted for doctors (enforced by RegisterRequest
    # model_validator); it is omitted for clerks who do not supply one.
    insert_payload: dict = {
        "email": user.email,
        "password_hash": hash_password(user.password),
        "name": user.name,
        "role": user.role,
    }
    if user.specialization is not None:
        insert_payload["specialization"] = user.specialization
    if user.med_reg_no is not None:
        insert_payload["med_reg_no"] = user.med_reg_no
    if user.phone is not None:
        insert_payload["phone"] = user.phone

    # Insert user
    result = (
        supabase.table("users")
        .insert(insert_payload)
        .execute()
    )

    return {
        "message": "User registered successfully",
        "user": result.data
    }


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, user: LoginRequest):

    # Find user by email
    result = (
        supabase.table("users")
        .select("*")
        .eq("email", user.email)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    db_user = result.data[0]

    # Verify password
    if not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # Create JWT
    token = create_access_token(
        {
            "sub": db_user["email"],
            "user_id": db_user["id"],
            "role": db_user["role"]
        }
    )

    # Persist login audit event.  Action label is role-dynamic: doctor_login / clerk_login.
    # Only fires on successful authentication — wrong-password attempts are rejected above.
    # Never stores the password or the JWT.
    write_access_log(
        actor_role=db_user["role"],
        action=f"{db_user['role']}_login",
        actor_user_id=db_user["id"],
        metadata={"email": db_user["email"]},
    )

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    payload = dict(current_user)

    # Enrich the payload with profile fields for doctor and clerk tokens.
    # The JWT encodes only { sub, user_id, role }; name, email, and the
    # other profile columns must be fetched from the users table.
    if current_user.get("role") in {"doctor", "clerk"} and current_user.get("user_id"):
        row = (
            supabase.table("users")
            .select("name, email, specialization, phone, med_reg_no")
            .eq("id", current_user["user_id"])
            .limit(1)
            .execute()
        )
        if row.data:
            r = row.data[0]
            payload["name"]           = r.get("name")
            payload["email"]          = r.get("email")
            payload["specialization"] = r.get("specialization")
            payload["phone"]          = r.get("phone")
            payload["med_reg_no"]     = r.get("med_reg_no")

    # Add convenience aliases so all frontend consumers work without changes:
    #   currentUser.id       — same integer value as user_id
    #   currentUser.displayId — human-readable doctor identifier shown in UI
    user_id = current_user.get("user_id")
    if user_id is not None:
        payload["id"] = user_id
        payload["displayId"] = f"DOC-{user_id}"

    return {
        "message": "Authenticated successfully",
        "user": payload
    }
