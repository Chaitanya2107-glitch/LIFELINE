import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAppData } from "./AppDataContext";
import { setToken, clearToken, getToken } from "../api/client.js";
import { getMe } from "../api/auth.js";
import { getPatientProfile } from "../api/patientAuth.js";

const AuthContext = createContext();

// Session timeout: 15 minutes of inactivity
const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  const { addAuditLog } = useAppData();

  // currentUser shape (doctor): { id, role, name, email, specialization, phone }
  // role values from backend are lowercase: "doctor", "patient", "clerk"
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  const timeoutRef = useRef(null);

  // ── Inactivity timer ────────────────────────────────────────────────────────

  const resetTimer = useCallback(() => {
    if (!currentUser) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setSessionExpired(true);
      addAuditLog({
        userId: currentUser.id,
        role: currentUser.role,
        action: "SESSION_EXPIRED",
        details: `Automatic logout after ${SESSION_TIMEOUT_MS / 60000} min inactivity`,
      });
      clearToken();
      setCurrentUser(null);
    }, SESSION_TIMEOUT_MS);
  }, [currentUser, addAuditLog]);

  useEffect(() => {
    if (!currentUser) return;
    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      clearTimeout(timeoutRef.current);
    };
  }, [currentUser, resetTimer]);

  // ── Bootstrap: restore session from stored token ────────────────────────────

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setBootstrapping(false);
      return;
    }

    // Decode role from JWT payload (base64url, no verification needed here —
    // the backend will reject an invalid token on the API call anyway).
    let role = null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      role = payload.role;
    } catch {
      // malformed token — clear and bail
      clearToken();
      setBootstrapping(false);
      return;
    }

    const bootstrap = role === "patient"
      ? getPatientProfile().then((profile) => ({
          id: profile.patient_code,
          patient_id: profile.id,
          role: "patient",
          name: profile.name,
          displayId: profile.patient_code,
          blood_group: profile.blood_group,
          email: profile.email,
          phone: profile.phone,
          date_of_birth: profile.date_of_birth,
          emergency_contacts: profile.emergency_contacts,
          conditions: profile.conditions,
        }))
      : getMe();

    bootstrap
      .then((user) => {
        setCurrentUser(user);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        setBootstrapping(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── login ───────────────────────────────────────────────────────────────────

  /**
   * Called after a successful /auth/login response.
   * @param {string} token  - JWT access_token from the backend
   * @param {object} user   - user object from GET /auth/me
   */
  const login = useCallback(
    (token, user) => {
      setToken(token);
      setCurrentUser(user);
      setSessionExpired(false);
      addAuditLog({
        userId: user.id,
        role: user.role,
        action: "LOGIN",
        details: `${user.role} ${user.id} logged in`,
      });
    },
    [addAuditLog]
  );

  // ── logout ──────────────────────────────────────────────────────────────────

  const logout = useCallback(
    (reason = "manual") => {
      if (currentUser) {
        addAuditLog({
          userId: currentUser.id,
          role: currentUser.role,
          action: reason === "session" ? "SESSION_EXPIRED" : "LOGOUT",
          details: `${currentUser.role} ${currentUser.id} logged out`,
        });
      }
      clearToken();
      setCurrentUser(null);
      clearTimeout(timeoutRef.current);
    },
    [currentUser, addAuditLog]
  );

  const acknowledgeExpiry = () => setSessionExpired(false);

  return (
    <AuthContext.Provider
      value={{ currentUser, login, logout, sessionExpired, acknowledgeExpiry, bootstrapping }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
