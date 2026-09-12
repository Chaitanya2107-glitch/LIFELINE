/**
 * src/api/timeline.js
 * Timeline and summary API calls.
 */

import { api } from "./client.js";

/**
 * GET /timeline/
 * Returns health timeline events for a patient.
 * - Patient token: no param needed (JWT carries patient_id)
 * - Doctor token:  pass patientId query param
 *
 * @param {string|null} patientId  - patient UUID; omit for patient JWT
 * @returns {object[]} array of timeline event objects
 */
export function getTimeline(patientId = null) {
  const qs = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
  return api.get(`/timeline/${qs}`);
}

/**
 * GET /summary/
 * Returns an AI-generated health summary for a patient.
 * - Patient token: no param needed
 * - Doctor token:  pass patientId query param
 *
 * @param {string|null} patientId
 * @returns {object} summary object
 */
export function getSummary(patientId = null) {
  const qs = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
  return api.get(`/summary/${qs}`);
}
