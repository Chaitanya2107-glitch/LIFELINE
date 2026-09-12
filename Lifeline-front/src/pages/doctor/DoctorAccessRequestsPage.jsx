import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DoctorLayout from "../../layouts/DoctorLayout";
import { ClipboardList, CheckCircle, XCircle, Clock, ChevronRight, Loader, AlertCircle } from "lucide-react";
import { requestConsent, getMyAccess } from "../../api/consent.js";
import { searchPatients } from "../../api/patients.js";

// ─── New Request Form ─────────────────────────────────────────────────────────

function NewRequestForm({ onRequested }) {
  const [lflCode, setLflCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = lflCode.trim();
    if (!code) return;
    setSubmitting(true);
    setMessage("");
    try {
      // First resolve the LFL code to a UUID
      const patient = await searchPatients(code);
      await requestConsent(patient.id);
      setMessage(`Access request sent for ${patient.name}.`);
      setIsError(false);
      setLflCode("");
      onRequested();
    } catch (err) {
      setMessage(err.message || "Failed to send access request.");
      setIsError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
      <div className="flex-1 min-w-48">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Patient LFL Code</label>
        <input
          type="text"
          value={lflCode}
          onChange={(e) => setLflCode(e.target.value)}
          placeholder="LFL-J6MTOC"
          className="w-full border border-slate-300 rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>
      <button
        type="submit"
        disabled={!lflCode.trim() || submitting}
        className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50 text-sm flex items-center gap-2"
      >
        {submitting && <Loader size={14} className="animate-spin" />}
        Send Access Request
      </button>
      {message && (
        <p className={`w-full text-sm mt-1 ${isError ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function DoctorAccessRequestsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMyAccess();
      setMyRequests(data);
    } catch (err) {
      setError(err.message || "Failed to load access requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lowercase status comparisons per API contract
  const getStatusBadge = (status) => {
    if (status === "pending") return "bg-orange-100 text-orange-700";
    if (status === "approved") return "bg-green-100 text-green-700";
    return "bg-red-100 text-red-700";
  };

  const getStatusIcon = (status) => {
    if (status === "approved") return <CheckCircle size={14} className="inline mr-1" />;
    if (status === "denied") return <XCircle size={14} className="inline mr-1" />;
    return <Clock size={14} className="inline mr-1" />;
  };

  return (
    <DoctorLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Access Requests</h1>
          <p className="text-slate-500 mt-2">
            Manage your requests to access previous patient medical records.
          </p>
        </div>

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-8 text-sm text-blue-700">
          <strong>How it works:</strong> When you request access to a patient's previous medical records,
          the patient receives the request and must approve it. You can only view their full history after
          approval. You always have access to reports <em>you</em> uploaded directly.
        </div>

        {/* New request */}
        <div className="bg-white border rounded-3xl p-8 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-5">
            Request Access to a Patient's Records
          </h2>
          <NewRequestForm onRequested={load} />
        </div>

        {/* Existing requests */}
        <div className="bg-white border rounded-3xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Your Requests</h2>

          {loading ? (
            <div className="flex justify-center py-8"><Loader size={28} className="animate-spin text-blue-400" /></div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-600 text-sm"><AlertCircle size={15} />{error}</div>
          ) : myRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
              <p>No access requests made yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myRequests.map((req) => (
                <div
                  key={req.id || req.request_id}
                  className="flex items-center gap-5 p-5 border rounded-2xl hover:bg-slate-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 font-mono text-sm">
                      Patient: {req.patient_id}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Requested:{" "}
                      {new Date(req.requested_at || req.created_at || Date.now()).toLocaleString("en-IN")}
                    </p>
                    {req.responded_at && (
                      <p className="text-xs text-slate-400">
                        Responded:{" "}
                        {new Date(req.responded_at).toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-2">
                    <span className={`text-xs font-semibold px-4 py-2 rounded-full ${getStatusBadge(req.status)}`}>
                      {getStatusIcon(req.status)}
                      {req.status}
                    </span>
                    {req.expires_at && req.status === "approved" && (
                      <p className="text-xs text-slate-400">
                        Expires: {new Date(req.expires_at).toLocaleDateString("en-IN")}
                      </p>
                    )}
                    {req.status === "approved" && (
                      <button
                        onClick={() =>
                          navigate("/doctor/patients", {
                            state: { autoSelectPatientId: req.patient_id },
                          })
                        }
                        className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                      >
                        View Records
                        <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </DoctorLayout>
  );
}

export default DoctorAccessRequestsPage;
