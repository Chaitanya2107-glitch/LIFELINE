/**
 * src/api/patients.js
 * Patient lookup and creation API calls.
 */

import { api } from "./client.js";

/**
 * GET /patients/code/{code}
 * Search by LFL code (e.g. "LFL-J6MTOC").
 * @param {string} code
 * @returns {object} patient record
 */
export function searchPatients(code) {
  return api.get(`/patients/code/${encodeURIComponent(code)}`);
}

/**
 * GET /patients/{id}
 * Fetch a patient by their UUID.
 * @param {string} id  - UUID string
 * @returns {object} patient record
 */
export function getPatientById(id) {
  return api.get(`/patients/${encodeURIComponent(id)}`);
}

/**
 * POST /patients/
 * Create a new patient record (doctor/clerk only).
 * @param {string} name
 * @param {string} phone
 * @param {string} dob   - "YYYY-MM-DD"
 * @returns {object} created patient record
 */
export function createPatient(name, phone, dob) {
  return api.post("/patients/", { name, phone, date_of_birth: dob });
}
