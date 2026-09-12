/**
 * src/api/consent.js
 * Consent (access request) API calls — doctor side.
 */

import { api } from "./client.js";

/**
 * POST /consent/request
 * Doctor requests access to a patient's records.
 * @param {string} patientId  - patient UUID
 * @returns {object} consent request record
 */
export function requestConsent(patientId) {
  return api.post("/consent/request", { patient_id: patientId });
}

/**
 * GET /consent/my-access
 * Returns all consent requests made by the currently authenticated doctor.
 * @returns {object[]} array of consent request objects
 */
export function getMyAccess() {
  return api.get("/consent/my-access");
}

/**
 * GET /consent/status/{patientId}
 * Returns the consent status for a specific patient (from the doctor's perspective).
 * @param {string} patientId  - patient UUID
 * @returns {object} consent status object
 */
export function getConsentStatus(patientId) {
  return api.get(`/consent/status/${encodeURIComponent(patientId)}`);
}
