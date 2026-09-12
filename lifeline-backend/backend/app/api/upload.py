import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, Depends

from app.ai.ocr_manager import extract_text
from app.ai.ai_manager import extract_medical_data
from app.ai.parser import parse_ai_response, AIResponseError
from app.ai.validator import validate_medical_record
from app.auth.security import (
    get_current_user,
    require_staff,
)
from app.care_plan.service import create_care_plan_item
from app.database.supabase import supabase
from app.patients.service import get_patient_by_id
from app.services.medical_record_service import (
    get_record_by_hash,
    get_all_medical_records,
    resolve_patient_id,
    save_medical_record,
)
from app.services.audit_service import write_access_log
from app.utils.hash import generate_report_hash
from app.utils.logger import logger

STORAGE_BUCKET = "medical-reports"


router = APIRouter()


def _upload_to_storage(file_path: Path, patient_id: str, record_id: str) -> str:
    """Upload a local file to Supabase Storage.

    Returns the storage path (not a signed URL).
    Path format: {patient_id}/{record_id}/{file_name}
    """
    storage_path = f"{patient_id}/{record_id}/{file_path.name}"
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    content_type_map = {
        ".pdf":  "application/pdf",
        ".png":  "image/png",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
    }
    content_type = content_type_map.get(file_path.suffix.lower(), "application/octet-stream")

    supabase.storage.from_(STORAGE_BUCKET).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": content_type},
    )
    return storage_path


# ── POST /upload ──────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_report(
    patient_id: str = Form(..., description="UUID of the patient this report belongs to"),
    file: UploadFile = File(...),
    report_type: str | None = Form(None, description="Type of report, e.g. 'Blood Test', 'X-Ray'"),
    current_user: dict = Depends(require_staff),
):
    """Upload a medical report for a specific patient.

    Accessible by: doctor, clerk.
    Requires a valid staff JWT (doctor or clerk).
    Runs the full OCR -> AI extraction -> structured record pipeline.
    Deduplicates against existing records for the same patient.
    Stores the original file in Supabase Storage (private bucket).
    """
    # ── Validate patient exists before running expensive OCR ──────────────────
    patient = get_patient_by_id(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing.")

    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg"}
    file_name = file.filename
    suffix = Path(file_name).suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only PDF, PNG, JPG and JPEG files are supported.",
        )

    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    file_path = upload_dir / file_name

    try:
        # Persist file locally for OCR
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # OCR — unchanged pipeline
        text = extract_text(str(file_path))
        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="Unable to extract readable text from the uploaded report.",
            )

        # Deduplication — keyed on patient_id + content hash
        report_hash = generate_report_hash(text)
        existing_record = get_record_by_hash(patient_id, report_hash)
        if existing_record:
            return {
                "message": "Duplicate report detected.",
                "record": existing_record,
            }

        # AI extraction — unchanged pipeline
        try:
            ai_response = extract_medical_data(text)
            parsed = parse_ai_response(ai_response)
            record = validate_medical_record(parsed)
        except AIResponseError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid medical data extracted: {e}",
            )

        # Pre-generate record ID so it can be used in the Storage path
        record_id = str(uuid.uuid4())

        # Upload original file to Supabase Storage (private bucket)
        # This happens while the local file still exists (before finally block)
        storage_path: str | None = None
        try:
            storage_path = _upload_to_storage(file_path, patient_id, record_id)
        except Exception as exc:
            # Storage failure is non-fatal: the record is still saved without a file_url.
            logger.warning(
                "Storage upload failed for record {} — continuing without file_url. Error: {}",
                record_id,
                str(exc),
            )

        # Build record dict — include new BE-2 fields alongside existing ones
        data = record.model_dump()
        data["id"] = record_id
        data["report_hash"] = report_hash
        data["patient_id"] = patient_id
        data["uploaded_by"] = current_user["user_id"]
        data["file_name"] = file_name
        data["report_type"] = report_type
        data["status"] = "verified"
        data["file_url"] = storage_path  # None if upload failed

        saved_record = save_medical_record(data)

        # Create care plan items for every AI-extracted follow-up.
        follow_ups = data.get("follow_ups") or []
        for follow_up_text in follow_ups:
            try:
                create_care_plan_item(
                    patient_id=patient_id,
                    description=follow_up_text,
                    source_record_id=record_id,
                )
            except Exception as exc:
                logger.warning(
                    "Care plan item creation failed for record {} follow-up '{}': {}",
                    record_id,
                    follow_up_text[:60],
                    str(exc),
                )

        # Audit: record every successful upload against the actor and patient.
        write_access_log(
            actor_role=current_user["role"],
            action="record_uploaded",
            actor_user_id=current_user["user_id"],
            patient_id=patient_id,
            metadata={
                "record_id": saved_record["id"],
                "report_hash": report_hash,
                "file_name": file_name,
            },
        )

        return saved_record

    finally:
        if file_path.exists():
            file_path.unlink()


@router.get("/medical-records")
async def get_medical_records(
    patient_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve medical records.

    - Patient token: returns the authenticated patient's own records.
      The patient_id query parameter is ignored.
    - Doctor token: patient_id query parameter is required.
      The doctor must hold an approved consent for the patient.
    - Clerk token: 403 — clerks cannot read records.
    """
    resolved_patient_id = resolve_patient_id(current_user, patient_id)
    records = get_all_medical_records(resolved_patient_id)

    write_access_log(
        actor_role=current_user["role"],
        action="records_accessed",
        actor_user_id=current_user.get("user_id"),
        actor_patient_id=current_user.get("patient_id"),
        patient_id=resolved_patient_id,
        metadata={"record_count": len(records)},
    )

    return records


@router.get("/records/{record_id}/file")
async def get_record_file(
    record_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return a short-lived signed download URL for a stored medical report.

    Access control mirrors GET /medical-records:
    - Patient token: can only fetch files for their own records.
    - Doctor token: must hold an approved consent for the record's patient.
    - Clerk token: 403.

    Returns:
        { "signed_url": "https://...", "expires_in": 3600 }
    """
    result = (
        supabase
        .table("medical_records")
        .select("id, patient_id, file_url")
        .eq("id", record_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Record not found")

    record = result.data[0]
    record_patient_id = record["patient_id"]
    file_url = record.get("file_url")

    if not file_url:
        raise HTTPException(
            status_code=404,
            detail="No file stored for this record",
        )

    resolved = resolve_patient_id(current_user, record_patient_id)

    if resolved != record_patient_id:
        raise HTTPException(status_code=403, detail="Access denied")

    SIGNED_URL_EXPIRY = 3600
    try:
        signed = (
            supabase
            .storage
            .from_(STORAGE_BUCKET)
            .create_signed_url(file_url, SIGNED_URL_EXPIRY)
        )
    except Exception as exc:
        logger.error("Signed URL generation failed for path {}: {}", file_url, str(exc))
        raise HTTPException(
            status_code=502,
            detail="Could not generate download URL — storage error",
        )

    url = signed.get("signedUrl") or signed.get("signedURL")
    if not url:
        raise HTTPException(
            status_code=502,
            detail="Could not generate download URL",
        )

    write_access_log(
        actor_role=current_user["role"],
        action="record_file_downloaded",
        actor_user_id=current_user.get("user_id"),
        actor_patient_id=current_user.get("patient_id"),
        patient_id=record_patient_id,
        metadata={"record_id": record_id},
    )

    return {"signed_url": url, "expires_in": SIGNED_URL_EXPIRY}
