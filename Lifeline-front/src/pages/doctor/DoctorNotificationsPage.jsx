import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DoctorLayout from "../../layouts/DoctorLayout";
import { Bell, ChevronRight, CheckCircle, XCircle, Clock, Loader } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyAccess } from "../../api/consent.js";

function DoctorNotificationsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyAccess();
      // Sort newest first (by responded_at, falling back to requested_at)
      const sorted = [...data].sort((a, b) => {
        const aTime = a.responded_at || a.requested_at || a.created_at;
        const bTime = b.responded_at || b.requested_at || b.created_at;
        return new Date(bTime) - new Date(aTime);
      });
      setMyRequests(sorted);
    } catch {
      setMyRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lowercase status comparisons per API contract
  const notifications = myRequests.map((req) => {
    if (req.status === "approved") {
      return {
        id: req.id || req.request_id,
        type: "success",
        title: "Access Request Approved",
        body: `Patient (${req.patient_id}) approved your request to view their medical records.`,
        action: { label: "View Records", patientId: req.patient_id },
        time: req.responded_at,
        expiresAt: req.expires_at,
      };
    }
    if (req.status === "denied") {
      return {
        id: req.id || req.request_id,
        type: "error",
        title: "Access Request Denied",
        body: `Patient (${req.patient_id}) denied your request to view their medical records.`,
        action: null,
        time: req.responded_at,
        expiresAt: null,
      };
    }
    return {
      id: req.id || req.request_id,
      type: "info",
      title: "Access Request Pending",
      body: `Your request to access patient ${req.patient_id}'s records is awaiting approval.`,
      action: null,
      time: req.requested_at || req.created_at,
      expiresAt: null,
    };
  });

  const styleMap = {
    success: { card: "bg-green-50 border-green-200", title: "text-green-900", body: "text-green-700", meta: "text-green-600" },
    error:   { card: "bg-red-50 border-red-200",     title: "text-red-900",   body: "text-red-700",   meta: "text-red-500" },
    info:    { card: "bg-blue-50 border-blue-200",   title: "text-blue-900",  body: "text-blue-700",  meta: "text-blue-500" },
  };

  const iconMap = {
    success: <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />,
    error:   <XCircle    size={18} className="text-red-500   shrink-0 mt-0.5" />,
    info:    <Clock      size={18} className="text-blue-400  shrink-0 mt-0.5" />,
  };

  return (
    <DoctorLayout>
      <div className="p-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-2">Updates on your access requests and activity.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader size={28} className="animate-spin text-blue-400" /></div>
        ) : notifications.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <Bell size={48} className="mx-auto mb-4 opacity-30" />
            <p>No notifications yet. They will appear here when patients respond to your requests.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => {
              const s = styleMap[n.type];
              return (
                <div key={n.id} className={`border rounded-2xl p-5 ${s.card}`}>
                  <div className="flex items-start gap-3">
                    {iconMap[n.type]}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <p className={`font-bold text-sm ${s.title}`}>{n.title}</p>
                        {n.time && (
                          <p className={`text-xs shrink-0 whitespace-nowrap ${s.meta}`}>
                            {new Date(n.time).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${s.body}`}>{n.body}</p>
                      {n.expiresAt && (
                        <p className={`text-xs mt-1.5 ${s.meta}`}>
                          Access expires{" "}
                          {new Date(n.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      {n.action && (
                        <button
                          onClick={() =>
                            navigate("/doctor/patients", {
                              state: { autoSelectPatientId: n.action.patientId },
                            })
                          }
                          className="mt-3 inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                        >
                          {n.action.label}
                          <ChevronRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}

export default DoctorNotificationsPage;
