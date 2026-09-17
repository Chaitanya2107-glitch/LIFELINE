/**
 * src/api/pharmacy.js
 * Pharmacy portal API calls — pharmacist registration, patient lookup,
 * access requests, prescriptions and dispensing.
 *
 * Pharmacist login uses the shared POST /auth/login + GET /auth/me
 * (see loginDoctor / getMe in auth.js).
 */

import { api } from "./client.js";

/**
 * POST /auth/register  (role = "pharmacist")
 * The pharmacy licence number is stored in med_reg_no and is required.
 */
export function registerPharmacist(name, email, phone, licenceNo, password) {
  return api.post("/auth/register", {
    name,
    email,
    phone,
    med_reg_no: licenceNo,
    password,
    role: "pharmacist",
  });
}

/**
 * GET /pharmacy/patients/code/{code}
 * @returns {{ id: string, patient_code: string, name: string }}
 */
export function lookupPatient(code) {
  return api.get(`/pharmacy/patients/code/${encodeURIComponent(code)}`);
}

/** POST /pharmacy/access-request — ask the patient for access. */
export function requestPharmacyAccess(patientId) {
  return api.post("/pharmacy/access-request", { patient_id: patientId });
}

/** GET /pharmacy/access-requests — all of this pharmacist's requests. */
export function getPharmacyAccessRequests() {
  return api.get("/pharmacy/access-requests");
}

/** GET /pharmacy/prescriptions?patient_id= — requires approved access. */
export function getPrescriptions(patientId) {
  return api.get(`/pharmacy/prescriptions?patient_id=${encodeURIComponent(patientId)}`);
}

/**
 * POST /pharmacy/dispense
 * @param {string} prescriptionStatusId
 * @param {string} patientId
 * @param {object[]} items  - medicines dispensed (empty = all on the prescription)
 */
export function dispensePrescription(prescriptionStatusId, patientId, items = []) {
  return api.post("/pharmacy/dispense", {
    prescription_status_id: prescriptionStatusId,
    patient_id: patientId,
    items,
  });
}

/** GET /pharmacy/dispense-history — this pharmacist's dispense events. */
export function getDispenseHistory() {
  return api.get("/pharmacy/dispense-history");
}
