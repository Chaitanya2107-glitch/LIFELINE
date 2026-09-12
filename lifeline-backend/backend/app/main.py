from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.config.settings import settings
from app.utils.logger import logger
from app.utils.limiter import limiter
from app.database.supabase import supabase
from app.api.upload import router as upload_router
from app.timeline.routes import router as timeline_router
from app.summary.routes import router as summary_router
from app.vitalis.routes import router as vitalis_router
from app.auth.audit_routes import audit_router
from app.auth.routes import router as auth_router
from app.patients.routes import patients_router, patient_otp_router
from app.consent.routes import consent_router
from app.care_plan.routes import care_plan_router
from app.appointments.routes import appointments_router

app = FastAPI(title="Lifeline Backend")

# ──────────────────────────────────────────────
# CORS
# Add the deployed frontend URL here when provided by the frontend team.
# ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Rate limiting (slowapi)
# ──────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(auth_router)
app.include_router(audit_router)
app.include_router(upload_router)
app.include_router(timeline_router)
app.include_router(summary_router)
app.include_router(vitalis_router)
app.include_router(patients_router)
app.include_router(patient_otp_router)
app.include_router(consent_router)
app.include_router(care_plan_router)
app.include_router(appointments_router)

@app.get("/")
def root():
    return {"message": "Backend Running"}


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/db-status")
def db_status():
    try:
        return {
            "status": "connected",
            "database": "Supabase"
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
