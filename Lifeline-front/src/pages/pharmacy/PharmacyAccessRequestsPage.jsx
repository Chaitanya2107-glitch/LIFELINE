import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, CheckCircle, XCircle, Clock, ChevronRight, Loader, AlertCircle } from "lucide-react";
import PharmacyLayout from "../../layouts/PharmacyLayout";
import {
  lookupPatient,
  requestPharmacyAccess,
  getPharmacyAccessRequests,
} from "../../api/pharmacy.js";
import { formatDateTime } from "./pharmacyFormat.js";

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
      const patient = await lookupPatient(code);
      await requestPharmacyAccess(patient.id);
      setMessage(`Access request sent to ${patient.name}. They must approve it before you can view prescriptions.`);
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
          className="w-full border border-slate-300 rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
      </div>
      <button
        type="submit"
        disabled={!lflCode.trim() || submitting}
        className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 text-sm flex items-center gap-2"
      >
        {submitting && <Loader size={14} className="animate-spin" />}
        Send Access Request
      </button>
      {message && (
        <p className={`w-full text-sm mt-1 ${isError ? "text-red-600" : "text-green-600"}`}>{message}</p>
      )}
    </form>
  );
}

const STATUS_STYLES = {
  pending: { badge: "bg-orange-100 text-orange-700", Icon: Clock },
  approved: { badge: "bg-green-100 text-green-700", Icon: CheckCircle },
  denied: { badge: "bg-red-100 text-red-700", Icon: XCircle },
};

function PharmacyAccessRequestsPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRequests = useCallback(() => {
    return getPharmacyAccessRequests()
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load access requests."))
      .finally(() => setLoading(false));
  }, []);

  // Refresh after a new request is sent.
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return (
    <PharmacyLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Patient Access</h1>
          <p className="text-slate-500 mt-2">Request permission to view a patient's prescriptions.</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8 text-sm text-emerald-800">
          <strong>How it works:</strong> Enter the patient's LFL code to send a request. The patient
          approves it from their Lifeline app. Once approved, you can view and dispense their
          prescriptions for 7 days.
        </div>

        <div className="bg-white border rounded-3xl p-8 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-5">Request Access</h2>
          <NewRequestForm onRequested={load} />
        </div>

        <div className="bg-white border rounded-3xl p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Your Requests</h2>

          {loading ? (
            <div className="flex justify-center py-8"><Loader size={28} className="animate-spin text-emerald-500" /></div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-600 text-sm"><AlertCircle size={15} />{error}</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
              <p>No access requests made yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const style = STATUS_STYLES[req.status] || STATUS_STYLES.denied;
                const expired = req.expires_at && new Date(req.expires_at) < new Date();
                return (
                  <div key={req.id} className="flex items-center gap-5 p-5 border rounded-2xl hover:bg-slate-50 transition">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 font-mono text-sm truncate">
                        Patient: {req.patient_id}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Requested: {formatDateTime(req.requested_at)}</p>
                      {req.responded_at && (
                        <p className="text-xs text-slate-400">Responded: {formatDateTime(req.responded_at)}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right flex flex-col items-end gap-2">
                      <span className={`text-xs font-semibold px-4 py-2 rounded-full ${expired ? "bg-slate-100 text-slate-500" : style.badge}`}>
                        <style.Icon size={14} className="inline mr-1" />
                        {expired ? "expired" : req.status}
                      </span>
                      {req.status === "approved" && req.expires_at && !expired && (
                        <p className="text-xs text-slate-400">
                          Expires: {new Date(req.expires_at).toLocaleDateString("en-IN")}
                        </p>
                      )}
                      {req.status === "approved" && !expired && (
                        <button
                          onClick={() => navigate("/pharmacy/prescriptions", { state: { patientId: req.patient_id } })}
                          className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        >
                          View Prescriptions
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </PharmacyLayout>
  );
}

export default PharmacyAccessRequestsPage;
