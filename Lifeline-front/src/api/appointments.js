/**
 * src/api/appointments.js
 * Appointments API calls — doctor and patient sides.
 */

import { api } from "./client.js";

/**
 * GET /appointments
 * Returns appointments for the authenticated user (doctor or patient).
 * @returns {object[]} array of appointment objects
 */
export function getAppointments() {
  return api.get("/appointments");
}

/**
 * POST /appointments
 * Doctor creates a pending appointment for a patient (requires consent).
 * The appointment is created with status='pending' — the patient must approve it.
 * @param {object} data  - { patient_id, date, time, type, location?, notes? }
 * @returns {object} created appointment (status='pending')
 */
export function createAppointment(data) {
  return api.post("/appointments", data);
}

/**
 * PATCH /appointments/{id}
 * Update status, notes, or location of an appointment.
 *
 * Doctor may set: 'completed', 'cancelled'
 * Patient may set: 'upcoming' (approve), 'rejected', 'cancelled'
 *
 * @param {string} id    - appointment UUID
 * @param {object} data  - { status?, notes?, location? }
 * @returns {object} updated appointment
 */
export function updateAppointment(id, data) {
  return api.patch(`/appointments/${encodeURIComponent(id)}`, data);
}

/**
 * Patient approves a pending appointment (sets status='upcoming').
 * Shorthand around updateAppointment for clarity at the call site.
 * @param {string} id  - appointment UUID
 * @returns {object} updated appointment with status='upcoming'
 */
export function approveAppointment(id) {
  return api.patch(`/appointments/${encodeURIComponent(id)}`, { status: "upcoming" });
}

/**
 * Patient rejects a pending appointment (sets status='rejected').
 * @param {string} id  - appointment UUID
 * @returns {object} updated appointment with status='rejected'
 */
export function rejectAppointment(id) {
  return api.patch(`/appointments/${encodeURIComponent(id)}`, { status: "rejected" });
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
