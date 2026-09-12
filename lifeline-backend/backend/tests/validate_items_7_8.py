"""Validation tests for Items 7 and 8."""
from unittest.mock import patch, MagicMock

# ── Item 7: get_all_medical_records join + flatten ────────────────────────────

mock_rows = [
    {
        "id": "rec-1", "patient_id": "pat-1", "uploaded_by": 7,
        "file_name": "report.pdf", "status": "verified",
        "users": {"name": "Dr. Smith"},
    },
    {
        "id": "rec-2", "patient_id": "pat-1", "uploaded_by": None,
        "file_name": None, "status": None,
        "users": None,
    },
]

with patch("app.services.medical_record_service.supabase") as mock_supa:
    mock_supa.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = mock_rows

    from app.services.medical_record_service import get_all_medical_records
    result = get_all_medical_records("pat-1")

    select_arg = mock_supa.table.return_value.select.call_args[0][0]
    assert "users!uploaded_by(name)" in select_arg, f"Missing FK join: {select_arg}"
    print("PASS [7]: select includes users!uploaded_by(name)")

    assert result[0]["uploader_name"] == "Dr. Smith"
    assert "users" not in result[0]
    print("PASS [7]: uploader_name populated from users.name")
    print("PASS [7]: raw 'users' key removed from response")

    assert result[1]["uploader_name"] is None
    assert "users" not in result[1]
    print("PASS [7]: uploader_name=None when uploaded_by is NULL (no crash)")


# ── Item 8: get_record_file route logic ───────────────────────────────────────

import inspect
from app.api.upload import get_record_file, STORAGE_BUCKET
sig = inspect.signature(get_record_file)
params = list(sig.parameters.keys())
assert "record_id" in params, f"Missing record_id param: {params}"
assert "current_user" in params, f"Missing current_user param: {params}"
print("PASS [8]: get_record_file has correct parameters")

# Verify route is registered
from app.api.upload import router
routes = {r.path: list(r.methods) for r in router.routes if hasattr(r, "methods")}
assert "/records/{record_id}/file" in routes, f"Route not registered: {list(routes.keys())}"
assert "GET" in routes["/records/{record_id}/file"]
print("PASS [8]: GET /records/{record_id}/file route registered")

# Simulate: record not found -> 404
from fastapi import HTTPException
with patch("app.api.upload.supabase") as mock_supa2:
    mock_supa2.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
    import asyncio
    try:
        asyncio.run(get_record_file("nonexistent-id", {"role": "patient", "patient_id": "pat-1"}))
        assert False, "Should have raised 404"
    except HTTPException as e:
        assert e.status_code == 404
        print("PASS [8]: 404 when record not found")

# Simulate: record exists but file_url is None -> 404
with patch("app.api.upload.supabase") as mock_supa3:
    mock_supa3.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "rec-1", "patient_id": "pat-1", "file_url": None}
    ]
    try:
        asyncio.run(get_record_file("rec-1", {"role": "patient", "patient_id": "pat-1"}))
        assert False, "Should have raised 404"
    except HTTPException as e:
        assert e.status_code == 404
        print("PASS [8]: 404 when file_url is None")

# Simulate: patient accessing their own record with valid file_url -> signed URL returned
with patch("app.api.upload.supabase") as mock_supa4:
    with patch("app.api.upload.resolve_patient_id", return_value="pat-1"):
        mock_supa4.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
            {"id": "rec-1", "patient_id": "pat-1", "file_url": "pat-1/rec-1/report.pdf"}
        ]
        mock_supa4.storage.from_.return_value.create_signed_url.return_value = {
            "signedUrl": "https://supabase.co/storage/v1/object/sign/medical-reports/pat-1/rec-1/report.pdf?token=abc",
            "signedURL": None,
        }
        response = asyncio.run(get_record_file("rec-1", {"role": "patient", "patient_id": "pat-1"}))
        assert response["signed_url"].startswith("https://")
        assert response["expires_in"] == 3600
        # Verify it called the right bucket
        mock_supa4.storage.from_.assert_called_with(STORAGE_BUCKET)
        # Verify it used the stored path
        create_call = mock_supa4.storage.from_.return_value.create_signed_url.call_args
        assert create_call[0][0] == "pat-1/rec-1/report.pdf"
        assert create_call[0][1] == 3600
        print("PASS [8]: signed_url returned with correct URL and expires_in=3600")
        print("PASS [8]: create_signed_url called with correct bucket and path")

# Simulate: clerk token -> 403
from app.services.medical_record_service import resolve_patient_id as real_resolve
with patch("app.api.upload.supabase") as mock_supa5:
    mock_supa5.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": "rec-1", "patient_id": "pat-1", "file_url": "pat-1/rec-1/report.pdf"}
    ]
    try:
        asyncio.run(get_record_file("rec-1", {"role": "clerk", "user_id": 99}))
        assert False, "Should have raised 403"
    except HTTPException as e:
        assert e.status_code == 403
        print("PASS [8]: 403 for clerk token")

print()
print("Items 7 and 8 — ALL UNIT TESTS PASSED")
