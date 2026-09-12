/**
 * src/api/appointments.js
 * Appointments API calls — doctor side.
 */

import { api } from "./client.js";

/**
 * GET /appointments
 * Returns appointments for the authenticated doctor.
 * @returns {object[]} array of appointment objects
 */
export function getAppointments() {
  return api.get("/appointments");
}

/**
 * POST /appointments/request-otp
 * Initiate patient OTP authorisation for a pending appointment.
 * Returns the OTP in the response body (demo mode).
 * @param {string} patientCode  - LFL code e.g. "LFL-J6MTOC"
 * @returns {{ patient_code, otp, expires_in_minutes }}
 */
export function requestApptOtp(patientCode) {
  return api.post("/appointments/request-otp", { patient_code: patientCode });
}

/**
 * POST /appointments/verify-otp
 * Verify the patient-provided OTP and obtain a scoped appt-auth token.
 * The returned appt_token must be passed to createAppointment() and is held
 * only in React component state — never stored in localStorage or cookies.
 * @param {string} patientCode
 * @param {string} otp
 * @returns {{ appt_token: string, expires_in_minutes: number }}
 */
export function verifyApptOtp(patientCode, otp) {
  return api.post("/appointments/verify-otp", { patient_code: patientCode, otp });
}

/**
 * POST /appointments
 * Doctor creates an appointment for a patient (requires consent + OTP token).
 * @param {object} data  - { patient_id, date, time, type, location?, notes?, appt_token }
 * @returns {object} created appointment
 */
export function createAppointment(data) {
  return api.post("/appointments", data);
}

/**
 * PATCH /appointments/{id}
 * Update status, notes, or location of an appointment.
 * @param {string} id    - appointment UUID
 * @param {object} data  - { status?, notes?, location? }
 * @returns {object} updated appointment
 */
export function updateAppointment(id, data) {
  return api.patch(`/appointments/${encodeURIComponent(id)}`, data);
}

/**
 * DELETE /appointments/{id}
 * Cancel an appointment (sets status to 'cancelled', ownership enforced by backend).
 * @param {string} id  - appointment UUID
 * @returns {object} updated appointment with status='cancelled'
 */
export function cancelAppointment(id) {
  return api.delete(`/appointments/${encodeURIComponent(id)}`);
}
