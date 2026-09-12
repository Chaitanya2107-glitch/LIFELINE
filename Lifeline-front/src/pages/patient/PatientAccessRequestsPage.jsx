import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import { ClipboardList, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { api } from "../../api/client.js";

// ── Consent API helpers (patient-side) ────────────────────────────────────────

function getPendingConsents() {
  return api.get("/consent/pending");
}

function respondToConsent(consentId, action) {
  // action: "approved" | "denied"
  return api.post(`/consent/${encodeURIComponent(consentId)}/respond`, { action });
}

// ─────────────────────────────────────────────────────────────────────────────

function PatientAccessRequestsPage() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    getPendingConsents()
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRespond = async (consentId, decision) => {
    setResponding(consentId);
    try {
      await respondToConsent(consentId, decision);
      // Move the request from pending to resolved locally
      setRequests((prev) =>
        prev.map((r) => r.id === consentId ? { ...r, status: decision } : r)
      );
    } catch {
      /* error shown via toast from client.js */
    } finally {
      setResponding(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  const getStatusBadge = (status) => {
    if (status === "pending") return "bg-orange-100 text-orange-700";
    if (status === "approved") return "bg-green-100 text-green-700";
    return "bg-red-100 text-red-700";
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading access requests…
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Access Requests</h1>
          <p className="text-slate-500 mt-2">
            Review requests from doctors who want to access your previous medical records.
          </p>
        </div>

        {/* Pending */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            Pending Requests
            {pending.length > 0 && (
              <span className="ml-2 bg-orange-100 text-orange-700 text-sm px-2.5 py-0.5 rounded-full font-semibold">
                {pending.length}
              </span>
            )}
          </h2>

          {pending.length === 0 ? (
            <div className="bg-white border rounded-2xl p-8 text-center text-slate-400">
              <CheckCircle size={40} className="mx-auto mb-3 opacity-30 text-green-400" />
              <p>No pending requests.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((req) => (
                <div key={req.id} className="bg-white border border-orange-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900 text-lg">
                        {req.doctor_name || "Doctor"}
                      </p>
                      <p className="text-sm font-mono text-slate-500">{req.doctor_id}</p>
                      {req.specialization && (
                        <p className="text-sm text-slate-500 mt-0.5">{req.specialization}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        Requested: {new Date(req.created_at || req.requestedAt).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shrink-0">
                      <Clock size={12} />
                      Pending
                    </span>
                  </div>

                  <div className="mt-4 p-4 bg-slate-50 rounded-2xl text-sm text-slate-600">
                    <strong>{req.doctor_name || "This doctor"}</strong> is requesting access to view your full medical
                    history. You can approve or deny this request.
                    If approved, access will expire in 7 days.
                  </div>

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => handleRespond(req.id, "approved")}
                      disabled={responding === req.id}
                      className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50 text-sm"
                    >
                      <CheckCircle size={16} />
                      Approve Access
                    </button>
                    <button
                      onClick={() => handleRespond(req.id, "denied")}
                      disabled={responding === req.id}
                      className="flex items-center gap-2 bg-red-100 text-red-700 px-6 py-3 rounded-xl font-semibold hover:bg-red-200 transition disabled:opacity-50 text-sm"
                    >
                      <XCircle size={16} />
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-4">Request History</h2>

          {resolved.length === 0 ? (
            <div className="bg-white border rounded-2xl p-8 text-center text-slate-400">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
              <p>No resolved requests yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resolved.map((req) => (
                <div key={req.id} className="bg-white border rounded-2xl p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{req.doctor_name || "Doctor"}</p>
                    <p className="text-xs font-mono text-slate-500">{req.doctor_id}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(req.created_at || req.requestedAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusBadge(req.status)}`}>
                    {req.status === "approved"
                      ? <><CheckCircle size={12} className="inline mr-1" />Approved</>
                      : <><XCircle size={12} className="inline mr-1" />Denied</>
                    }
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </PatientLayout>
  );
}

export default PatientAccessRequestsPage;
