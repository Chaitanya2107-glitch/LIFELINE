import { createContext, useContext, useState, useCallback } from "react";

const AppDataContext = createContext();

// ── Kept for legacy OTP flow (PatientOTPPage / OTPVerificationModal) ──────────
// These components are not part of the real backend integration yet.
// They will be removed when the OTP pages are retired.

// ─── Mock Medical Registration Registry ──────────────────────────────────────
// Kept as an export in case any component still references it during transition.
export const MOCK_MEDICAL_REGISTRY = [
  { regNo: "MED-REG-001", name: "Pre-registered slot 1" },
  { regNo: "MED-REG-002", name: "Pre-registered slot 2" },
  { regNo: "MED-REG-003", name: "Pre-registered slot 3" },
  { regNo: "MED-REG-004", name: "Pre-registered slot 4" },
  { regNo: "MED-REG-005", name: "Pre-registered slot 5" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowISO() { return new Date().toISOString(); }
function makeId(prefix) { return `${prefix}-${Date.now().toString().slice(-6)}`; }

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppDataProvider({ children }) {
  // ── Audit Log — still client-side until a real audit endpoint is ready ────
  const [auditLogs, setAuditLogs] = useState([]);

  const addAuditLog = useCallback((entry) => {
    setAuditLogs((prev) => [
      { logId: makeId("LOG"), timestamp: nowISO(), ...entry },
      ...prev,
    ]);
  }, []);

  // ── OTP — legacy, kept for PatientOTPPage / OTPVerificationModal ──────────
  // These pages use a mock OTP flow that was part of the old demo upload pipeline.
  // They will be retired once the real upload pipeline is in place.
  const [otpStore, setOtpStore] = useState({});

  const generateOTP = useCallback((patientId) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 12 * 60 * 1000).toISOString();
    setOtpStore((prev) => ({ ...prev, [patientId]: { code, expiresAt, used: false, attempts: 0 } }));
    return code;
  }, []);

  const verifyOTP = useCallback((patientId, enteredCode) => {
    const entry = otpStore[patientId];
    if (!entry) return { success: false, reason: "No OTP generated" };
    if (entry.used) return { success: false, reason: "OTP already used" };
    if (new Date() > new Date(entry.expiresAt)) return { success: false, reason: "OTP expired" };
    if (entry.attempts >= 3) return { success: false, reason: "Too many attempts" };
    if (entry.code !== enteredCode) {
      setOtpStore((prev) => ({ ...prev, [patientId]: { ...prev[patientId], attempts: prev[patientId].attempts + 1 } }));
      return { success: false, reason: "Incorrect OTP" };
    }
    setOtpStore((prev) => ({ ...prev, [patientId]: { ...prev[patientId], used: true } }));
    return { success: true };
  }, [otpStore]);

  return (
    <AppDataContext.Provider value={{
      // Audit
      auditLogs,
      addAuditLog,
      // Legacy OTP (PatientOTPPage / OTPVerificationModal only)
      generateOTP,
      verifyOTP,
      otpStore,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData() {
  return useContext(AppDataContext);
}
