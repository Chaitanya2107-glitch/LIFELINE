/**
 * src/api/appointments.js
 * Appointments API calls — patient requests, doctor confirms.
 *
 * Status flow:
 *   pending   — patient requested, waiting for the doctor
 *   upcoming  — doctor confirmed date / time / location
 *   rejected  — doctor declined (notes may hold the reason)
 *   completed — doctor marked the visit done
 *   cancelled — either side cancelled
 */

import { api } from "./client.js";

/**
 * GET /appointments
 * Appointments for the authenticated user (doctor or patient), with
 * doctor_name / doctor_specialization / patient_name / patient_code joined in.
 * @returns {object[]}
 */
export function getAppointments() {
  return api.get("/appointments");
}

/**
 * GET /appointments/doctors  (patient only)
 * @returns {{ id: number, name: string, specialization: string|null }[]}
 */
export function getBookableDoctors() {
  return api.get("/appointments/doctors");
}

/**
 * POST /appointments  (patient only)
 * Patient requests an appointment; created with status='pending'.
 * @param {object} data  - { doctor_id, date, time, type, reason? }
 *                         date/time are the patient's preferred slot.
 * @returns {object} created appointment
 */
export function requestAppointment(data) {
  return api.post("/appointments", data);
}

/**
 * PATCH /appointments/{id}
 * Doctor: edit date / time / location / notes, or change status.
 * Patient: may only set status='cancelled'.
 * @param {string} id
 * @param {object} data  - { status?, date?, time?, location?, notes? }
 * @returns {object} updated appointment
 */
export function updateAppointment(id, data) {
  return api.patch(`/appointments/${encodeURIComponent(id)}`, data);
}

/**
 * Doctor confirms a request with the final schedule (status='upcoming').
 * @param {string} id
 * @param {{ date: string, time: string, location: string, notes?: string }} schedule
 */
export function approveAppointment(id, schedule) {
  return updateAppointment(id, { ...schedule, status: "upcoming" });
}

/**
 * Doctor declines a request (status='rejected').
 * @param {string} id
 * @param {string} [reason]  - shown to the patient
 */
export function rejectAppointment(id, reason) {
  return updateAppointment(id, { status: "rejected", ...(reason ? { notes: reason } : {}) });
}

/** Doctor marks a confirmed appointment as done (status='completed'). */
export function completeAppointment(id) {
  return updateAppointment(id, { status: "completed" });
}

/**
 * DELETE /appointments/{id}
 * Cancel a pending or upcoming appointment (ownership enforced by backend).
 * @param {string} id
 * @returns {object} updated appointment with status='cancelled'
 */
export function cancelAppointment(id) {
  return api.delete(`/appointments/${encodeURIComponent(id)}`);
}
