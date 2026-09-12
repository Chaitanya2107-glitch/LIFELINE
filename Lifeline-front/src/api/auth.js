/**
 * src/api/auth.js
 * Auth API calls — doctor/clerk login, registration, and /me.
 *
 * All field names and endpoint paths match the API contract exactly.
 */

import { api } from "./client.js";

/**
 * POST /auth/login
 * @param {string} email
 * @param {string} password
 * @returns {{ access_token: string, token_type: string }}
 */
export function loginDoctor(email, password) {
  return api.post("/auth/login", { email, password });
}

/**
 * POST /auth/register  (returns 201)
 * Registers a doctor account. med_reg_no is required for role='doctor' and
 * is enforced by the backend; no external registry verification is performed.
 * @param {string} name
 * @param {string} email
 * @param {string} phone
 * @param {string} specialization
 * @param {string} medRegNo
 * @param {string} password
 * @returns {{ message: string, user: object[] }}
 */
export function registerDoctor(name, email, phone, specialization, medRegNo, password) {
  return api.post("/auth/register", {
    name,
    email,
    phone,
    specialization,
    med_reg_no: medRegNo,
    password,
    role: "doctor",
  });
}

/**
 * GET /auth/me
 * The backend returns { message, user: { sub, user_id, role, … } }.
 * We unwrap the envelope here so callers always receive the user object directly.
 * @returns {{ sub: string, user_id: number, role: string, specialization?: string, phone?: string }}
 */
export function getMe() {
  return api.get("/auth/me").then((res) => res.user);
}
