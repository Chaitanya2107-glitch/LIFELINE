/**
 * src/api/patientAuth.js
 * Patient auth and profile API calls.
 *
 * All field names and endpoint paths match the API contract exactly.
 */

import { api } from "./client.js";

/**
 * POST /patient/register
 * Patient self-registration — no LFL code is supplied by the patient.
 * The backend generates and returns a unique LFL code in the 201 response.
 *
 * @param {string} name
 * @param {string} phone
 * @param {string} password
 * @param {string|null} email       - optional
 * @param {string|null} dateOfBirth - optional, "YYYY-MM-DD"
 * @returns {{ id, patient_code, name, phone, email, date_of_birth, created_at }}
 */
export function registerPatient(name, phone, password, email = null, dateOfBirth = null) {
  const body = { name, phone, password };
  if (email) body.email = email;
  if (dateOfBirth) body.date_of_birth = dateOfBirth;
  return api.post("/patient/register", body);
}

/**
 * POST /patient/login
 * @param {string} lflCode
 * @param {string} password
 * @returns {{ access_token: string, token_type: string }}
 */
export function loginPatient(lflCode, password) {
  return api.post("/patient/login", { lfl_code: lflCode, password });
}

/**
 * GET /patient/profile
 * Returns the authenticated patient's full profile.
 * Uses patient_id from JWT — no query param needed.
 * @returns {{ id, patient_code, name, phone, email, date_of_birth,
 *             blood_group, emergency_contacts, conditions, created_at }}
 */
export function getPatientProfile() {
  return api.get("/patient/profile");
}

/**
 * PATCH /patient/profile
 * Updates the patient's own profile fields (partial update).
 * @param {object} data  - any subset of { blood_group, email, phone, emergency_contacts, conditions }
 * @returns {object} updated patient object
 */
export function updatePatientProfile(data) {
  return api.patch("/patient/profile", data);
}
