import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import DoctorLayout from "../../layouts/DoctorLayout";
import { Activity, Filter, Loader } from "lucide-react";
import { api } from "../../api/client.js";

const ACTION_COLORS = {
  // frontend-only (AppDataContext)
  LOGIN:                    "bg-green-100 text-green-700",
  LOGOUT:                   "bg-slate-100 text-slate-600",
  SESSION_EXPIRED:          "bg-orange-100 text-orange-700",
  // backend-persisted (access_logs)
  doctor_login:             "bg-green-100 text-green-700",
  clerk_login:              "bg-green-100 text-green-700",
  patient_searched:         "bg-blue-100 text-blue-700",
  consent_requested:        "bg-yellow-100 text-yellow-700",
  consent_approved:         "bg-green-100 text-green-700",
  consent_denied:           "bg-red-100 text-red-700",
  record_uploaded:          "bg-blue-100 text-blue-700",
  records_accessed:         "bg-purple-100 text-purple-700",
  record_file_downloaded:   "bg-purple-100 text-purple-700",
};

/**
 * Format a metadata JSONB object (or null) into a compact readable string
 * suitable for the Details column.  Never renders medical record contents.
 */
function formatMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return "—";
  return Object.entries(metadata)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

function DoctorAuditPage() {
  const { currentUser } = useAuth();
  const [filter, setFilter] = useState("ALL");
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get("/audit-logs");
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch {
      // Endpoint not yet ready — show empty state gracefully
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "ALL" ? auditLogs : auditLogs.filter((l) => l.action === filter);
  const uniqueActions = [...new Set(auditLogs.map((l) => l.action))];

  return (
    <DoctorLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-slate-500 mt-2">
            Every action recorded in the system — with timestamp.
          </p>
        </div>

        {/* Filter */}
        {!loading && auditLogs.length > 0 && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <Filter size={16} className="text-slate-400" />
            {["ALL", ...uniqueActions].map((a) => (
              <button
                key={a}
                onClick={() => setFilter(a)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                  filter === a
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader size={32} className="animate-spin text-blue-400" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border p-12 text-center text-slate-400">
            <Activity size={48} className="mx-auto mb-4 opacity-30" />
            <p>No audit entries yet. Actions will appear here as you use the system.</p>
          </div>
        ) : (
          <div className="bg-white border rounded-3xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-6 py-4 text-slate-600 font-semibold">Log ID</th>
                  <th className="text-left px-6 py-4 text-slate-600 font-semibold">Action</th>
                  <th className="text-left px-6 py-4 text-slate-600 font-semibold">Details</th>
                  <th className="text-left px-6 py-4 text-slate-600 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((log) => (
                  <tr key={log.id || log.logId || log.log_id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">{log.id || log.logId || log.log_id}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${ACTION_COLORS[log.action] || "bg-slate-100 text-slate-600"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={log.metadata ? JSON.stringify(log.metadata) : undefined}>
                      {formatMetadata(log.metadata)}
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp || log.created_at || Date.now()).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </DoctorLayout>
  );
}

export default DoctorAuditPage;
