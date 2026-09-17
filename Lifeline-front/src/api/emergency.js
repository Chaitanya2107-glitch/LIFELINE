/**
 * src/api/emergency.js
 * Public emergency info API — no auth required.
 *
 * The backend endpoint is intentionally unauthenticated so that a first
 * responder with no Lifeline account can scan a QR code and view critical info.
 *
 * client.js already handles the token conditionally:
 *   token ? { Authorization: `Bearer ${token}` } : {}
 * So this call works correctly whether the visitor is logged in or not —
 * a logged-out visitor (no token in localStorage) simply sends no auth header,
 * and the backend endpoint ignores auth entirely.
 */

import { api } from "./client.js";

/**
 * GET /emergency/{token}
 * Fetch public emergency info for the patient identified by the token.
 * @param {string} token  - URL-safe random token from the QR code
 * @returns {{ name, blood_group, date_of_birth, conditions, emergency_contacts, allergies }}
 * @throws {Error} with message "This emergency code is not valid or has expired." on 404
 */
export function getPublicEmergencyInfo(token) {
  return api.get(`/emergency/${token}`);
}
