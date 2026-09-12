/**
 * src/api/vitalis.js
 * Vitalis AI chat API call.
 */

import { api } from "./client.js";

/**
 * POST /vitalis/chat
 * Send a question to Vitalis (Groq-backed AI).
 *
 * - Patient token: no patient_id param needed (JWT carries it)
 * - Doctor token:  pass patient_id as query param
 *
 * @param {string}      question
 * @param {string|null} patientId  - patient UUID; omit for patient JWT
 * @returns {{ answer: string }}
 */
export function chatWithVitalis(question, patientId = null) {
  const qs = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
  return api.post(`/vitalis/chat${qs}`, { question });
}
