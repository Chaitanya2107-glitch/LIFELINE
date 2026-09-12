"""Care plan service.

All Supabase interactions for the care_plan table.
HTTP concerns stay in routes — this service returns data or None.

Public API used by routes:
    get_care_plan_items(patient_id)  -> list[dict]
    update_care_plan_status(item_id, patient_id, status, role) -> dict | str

Internal API called from the upload pipeline:
    create_care_plan_item(patient_id, description, source_record_id) -> dict
"""

from app.database.supabase import supabase
from app.utils.logger import logger


# ──────────────────────────────────────────────
# Internal — called from upload pipeline
# ──────────────────────────────────────────────

def create_care_plan_item(
    patient_id: str,
    description: str,
    source_record_id: str,
) -> dict:
    """Insert one care_plan row derived from an AI-extracted follow-up string.

    The title is the first 120 characters of the description (truncated with
    ellipsis if longer) so the frontend always has a short display label.

    Idempotency: if a row with the same source_record_id + description already
    exists we return it instead of inserting a duplicate.  This makes the
    upload pipeline safe to retry without creating double entries.
    """
    # Guard: empty description would produce a meaningless row
    description = description.strip()
    if not description:
        return {}

    # Idempotency check — same source record + same description text
    existing = (
        supabase
        .table("care_plan")
        .select("*")
        .eq("source_record_id", source_record_id)
        .eq("description", description)
        .limit(1)
        .execute()
    )
    if existing.data:
        logger.info(
            "Care plan item already exists for record {} — skipping duplicate",
            source_record_id,
        )
        return existing.data[0]

    title = description[:120] + ("…" if len(description) > 120 else "")

    response = (
        supabase
        .table("care_plan")
        .insert({
            "patient_id": patient_id,
            "category": "Follow-up",
            "title": title,
            "description": description,
            "status": "pending",
            "priority": "medium",
            "source_record_id": source_record_id,
        })
        .execute()
    )

    row = response.data[0]
    logger.info(
        "Care plan item created | id={} | patient_id={} | source_record_id={}",
        row["id"],
        patient_id,
        source_record_id,
    )
    return row


# ──────────────────────────────────────────────
# Route-facing
# ──────────────────────────────────────────────

def get_care_plan_items(patient_id: str) -> list[dict]:
    """Return all care plan items for a patient, newest first."""
    response = (
        supabase
        .table("care_plan")
        .select("*")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


def update_care_plan_status(
    item_id: str,
    patient_id: str,
    new_status: str,
    role: str,
) -> dict | str:
    """Update the status of a care plan item.

    Authorization rules:
      - patient: can only update their own items (ownership enforced here).
      - doctor:  ownership is pre-checked in the route via resolve_patient_id
                 (consent already verified before this is called).

    Returns:
        dict          — the updated row on success.
        "not_found"   — item_id does not exist.
        "forbidden"   — patient trying to update another patient's item.
    """
    # Fetch the item to verify it exists and check ownership
    result = (
        supabase
        .table("care_plan")
        .select("*")
        .eq("id", item_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return "not_found"

    item = result.data[0]

    # Patient ownership guard — doctors bypass this (consent already checked)
    if role == "patient" and item["patient_id"] != patient_id:
        return "forbidden"

    updated = (
        supabase
        .table("care_plan")
        .update({"status": new_status})
        .eq("id", item_id)
        .execute()
    )
    return updated.data[0]
