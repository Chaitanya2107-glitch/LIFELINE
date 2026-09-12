/**
 * src/api/carePlan.js
 * Care plan API calls.
 */

import { api } from "./client.js";

/**
 * GET /care-plan
 * Returns care plan items for the authenticated patient (JWT carries patient_id).
 * @returns {object[]} array of care plan item objects
 */
export function getCarePlan() {
  return api.get("/care-plan");
}

/**
 * PATCH /care-plan/{id}
 * Update the status of a care plan item.
 * @param {string} id      - care plan item UUID
 * @param {string} status  - lowercase: "pending" | "ongoing" | "completed"
 * @returns {object} updated care plan item
 */
export function updateCarePlanItem(id, status) {
  return api.patch(`/care-plan/${encodeURIComponent(id)}`, { status });
}

/**
 * GET /care-plan?patient_id={patientId}
 * Doctor fetches care plan items for a specific patient (requires approved consent).
 * @param {string} patientId  - patient UUID
 * @returns {object[]} array of care plan item objects
 */
export function getCarePlanForPatient(patientId) {
  return api.get(`/care-plan?patient_id=${encodeURIComponent(patientId)}`);
}
