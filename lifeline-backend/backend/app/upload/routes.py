"""
app/upload/routes.py -- RETIRED

This router was superseded by app/api/upload.py in Step 4 of the
Lifeline migration.

DO NOT register this router in main.py.

Reasons for retirement:
- Uses the pre-Step-4 user_id ownership model (medical_records.user_id)
- Does not enforce role-based access control (any JWT accepted)
- Does not integrate the OCR/AI medical extraction pipeline
- Writes to the `reports` table with user_id referencing users.id (old schema)
- current_user["user_id"] would KeyError on patient tokens (no user_id claim)

The active upload and record endpoints are in app/api/upload.py:
  POST /upload          -- upload + OCR + AI + save medical record (staff only)
  GET  /medical-records -- retrieve records (role-aware, consent-gated)

The raw file storage path (Supabase Storage bucket: medical-reports) and the
`reports` table may be re-evaluated or retired in a future step.
"""
