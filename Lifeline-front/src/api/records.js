/**
 * src/api/records.js
 * Medical records API calls.
 */

import { api, getToken } from "./client.js";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/**
 * GET /medical-records?patient_id={patientId}
 * Returns all medical records for a patient (requires consent for non-own records).
 * @param {string} patientId  - patient UUID
 * @returns {object[]} array of medical record objects
 */
export function getRecords(patientId) {
  return api.get(`/medical-records?patient_id=${encodeURIComponent(patientId)}`);
}

/**
 * POST /upload
 * Upload a medical report file (multipart/form-data).
 * Requires a valid staff JWT; no OTP/upload-token needed.
 * @param {string} patientId
 * @param {File}   file
 * @param {string} reportType
 * @returns {object} created medical record
 */
export async function uploadRecord(patientId, file, reportType) {
  const formData = new FormData();
  formData.append("patient_id", patientId);
  formData.append("file", file);
  formData.append("report_type", reportType);

  // Use fetch directly so FormData boundary is set correctly by the browser.
  const token = getToken();
  const response = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let message = `Upload failed (${response.status})`;
    try {
      const data = await response.json();
      const detail = data?.detail;
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail)) message = detail.map((e) => e.msg).join("; ");
    } catch { /* ignore parse error */ }
    throw new Error(message);
  }

  return response.json();
}

/**
 * GET /records/{recordId}/file
 * Returns a signed URL for viewing/downloading the original file.
 * @param {string} recordId  - UUID of the medical record
 * @returns {{ signed_url: string, expires_in: number }}
 */
export function getFileUrl(recordId) {
  return api.get(`/records/${encodeURIComponent(recordId)}/file`);
}
