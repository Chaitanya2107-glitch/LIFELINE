import { createContext, useContext, useState, useCallback } from "react";

const AppDataContext = createContext();

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

  return (
    <AppDataContext.Provider value={{
      // Audit
      auditLogs,
      addAuditLog,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData() {
  return useContext(AppDataContext);
}
