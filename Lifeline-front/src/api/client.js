/**
 * src/api/client.js
 * Central fetch wrapper for all Lifeline API calls.
 *
 * - Base URL read from import.meta.env.VITE_API_URL (never hardcoded)
 * - Attaches Authorization: Bearer <token> from localStorage automatically
 * - On 401: clears token and redirects to /doctor/login
 * - On 429: shows a "too many requests" toast via a custom DOM event
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "lifeline_token";

// ── Token helpers ─────────────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Toast helper (dispatches a DOM event that App.jsx can listen to) ──────────

function emitToast(message) {
  window.dispatchEvent(new CustomEvent("lifeline:toast", { detail: { message } }));
}

// ── Core request ──────────────────────────────────────────────────────────────

/**
 * Makes an authenticated request to the backend.
 *
 * @param {string} path      - e.g. "/auth/me"
 * @param {RequestInit} opts - standard fetch options (method, body, headers, …)
 * @returns {Promise<any>}   - parsed JSON response body
 * @throws {Error}           - with a human-readable `.message` on non-2xx responses
 */
export async function request(path, opts = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };

  // When sending FormData, let the browser set Content-Type (with boundary)
  if (opts.body instanceof FormData) {
    delete headers["Content-Type"];
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = "/doctor/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (response.status === 429) {
    emitToast("Too many requests — please wait a moment before trying again.");
    throw new Error("Too many requests.");
  }

  // Try to parse JSON for all responses (including error bodies)
  let data;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // FastAPI validation errors arrive as { detail: "string" | [...] }
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
        ? detail.map((e) => e.msg).join("; ")
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

// ── Convenience methods ───────────────────────────────────────────────────────

export const api = {
  get: (path, opts = {}) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts = {}) =>
    request(path, { ...opts, method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: (path, body, opts = {}) =>
    request(path, { ...opts, method: "PATCH", body: JSON.stringify(body) }),
  delete: (path, opts = {}) => request(path, { ...opts, method: "DELETE" }),
};
