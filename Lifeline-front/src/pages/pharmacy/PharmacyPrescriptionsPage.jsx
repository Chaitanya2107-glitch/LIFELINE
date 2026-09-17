import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import { Search, Pill, Loader, AlertCircle, CheckCircle, ShieldAlert, FileText } from "lucide-react";
import PharmacyLayout from "../../layouts/PharmacyLayout";
import {
  lookupPatient,
  requestPharmacyAccess,
  getPrescriptions,
  dispensePrescription,
} from "../../api/pharmacy.js";
import { formatDateTime, medicineLabel, medicineDetails } from "./pharmacyFormat.js";

const STATUS_BADGE = {
  prescribed: "bg-blue-100 text-blue-700",
  sent_to_pharmacy: "bg-orange-100 text-orange-700",
  dispensed: "bg-green-100 text-green-700",
};

// ─── One prescription card ───────────────────────────────────────────────────

function PrescriptionCard({ rx, patientId, onDispensed }) {
  const medicines = rx.medicines || [];
  const [selected, setSelected] = useState(() => medicines.map(() => true));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isDispensed = rx.status === "dispensed";

  const toggle = (i) => setSelected((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  const chosen = medicines.filter((_, i) => selected[i]);

  const handleDispense = async () => {
    if (chosen.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await dispensePrescription(rx.id, patientId, chosen);
      onDispensed(rx.id);
    } catch (err) {
      setError(err.message || "Failed to dispense.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border rounded-3xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-bold text-slate-900 flex items-center gap-2">
            <FileText size={16} className="text-slate-400" />
            {rx.report_type || "Medical record"}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {rx.prescribed_by ? `Uploaded by ${rx.prescribed_by} · ` : ""}
            {formatDateTime(rx.record_date || rx.created_at)}
          </p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${STATUS_BADGE[rx.status] || "bg-slate-100 text-slate-600"}`}>
          {rx.status.replace(/_/g, " ")}
        </span>
      </div>

      {medicines.length === 0 ? (
        <p className="text-sm text-slate-400">No medicines listed on this record.</p>
      ) : (
        <ul className="space-y-2">
          {medicines.map((med, i) => (
            <li key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              {!isDispensed && (
                <input
                  type="checkbox"
                  checked={selected[i]}
                  onChange={() => toggle(i)}
                  className="w-4 h-4 accent-emerald-600"
                />
              )}
              <Pill size={16} className="text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{medicineLabel(med)}</p>
                {medicineDetails(med) && <p className="text-xs text-slate-500">{medicineDetails(med)}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="flex items-center gap-2 text-red-600 text-sm mt-4"><AlertCircle size={14} />{error}</p>
      )}

      {isDispensed ? (
        <p className="flex items-center gap-2 text-green-700 text-sm font-semibold mt-5">
          <CheckCircle size={16} /> Dispensed {rx.updated_at ? `on ${formatDateTime(rx.updated_at)}` : ""}
        </p>
      ) : medicines.length > 0 && (
        <button
          onClick={handleDispense}
          disabled={busy || chosen.length === 0}
          className="mt-5 flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 text-sm"
        >
          {busy ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={16} />}
          Mark {chosen.length} of {medicines.length} as Dispensed
        </button>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

function PharmacyPrescriptionsPage() {
  const location = useLocation();
  // Arriving from "View Prescriptions" on the access page.
  const initialPatientId = location.state?.patientId;

  const [code, setCode] = useState("");
  const [patient, setPatient] = useState(initialPatientId ? { id: initialPatientId } : null); // { id, name?, patient_code? }
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(Boolean(initialPatientId));
  const [error, setError] = useState("");
  const [noAccess, setNoAccess] = useState(false);
  const [requestMsg, setRequestMsg] = useState("");

  // Async part only — state is set in callbacks.
  const fetchPrescriptions = useCallback((patientId) => {
    return getPrescriptions(patientId)
      .then((data) => setPrescriptions(Array.isArray(data) ? data : []))
      .catch((err) => {
        if ((err.message || "").toLowerCase().includes("consent")) {
          setNoAccess(true);
        } else {
          setError(err.message || "Failed to load prescriptions.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const loadPrescriptions = useCallback((p) => {
    setPatient(p);
    setLoading(true);
    setError("");
    setNoAccess(false);
    setRequestMsg("");
    setPrescriptions([]);
    return fetchPrescriptions(p.id);
  }, [fetchPrescriptions]);

  useEffect(() => {
    if (initialPatientId) fetchPrescriptions(initialPatientId);
  }, [initialPatientId, fetchPrescriptions]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    setLoading(true);
    try {
      const p = await lookupPatient(code.trim());
      await loadPrescriptions(p);
    } catch (err) {
      setPatient(null);
      setError(err.message || "Patient not found.");
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    try {
      await requestPharmacyAccess(patient.id);
      setRequestMsg("Access request sent. The patient must approve it in their Lifeline app.");
    } catch (err) {
      setRequestMsg(err.message || "Failed to send request.");
    }
  };

  const handleDispensed = (rxId) => {
    const now = new Date().toISOString();
    setPrescriptions((prev) =>
      prev.map((rx) => (rx.id === rxId ? { ...rx, status: "dispensed", updated_at: now } : rx))
    );
  };

  const pending = prescriptions.filter((rx) => rx.status !== "dispensed");
  const done = prescriptions.filter((rx) => rx.status === "dispensed");

  return (
    <PharmacyLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Prescriptions</h1>
          <p className="text-slate-500 mt-2">Look up a patient to view and dispense their prescriptions.</p>
        </div>

        <form onSubmit={handleSearch} className="bg-white border rounded-3xl p-6 shadow-sm mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Patient LFL Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="LFL-J6MTOC"
              className="w-full border border-slate-300 rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!code.trim() || loading}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 text-sm flex items-center gap-2"
          >
            <Search size={16} /> Find Patient
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-6"><AlertCircle size={15} />{error}</div>
        )}

        {patient && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">{patient.name || "Patient"}</h2>
            <p className="text-sm font-mono text-slate-500">{patient.patient_code || patient.id}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader size={28} className="animate-spin text-emerald-500" /></div>
        ) : noAccess ? (
          <div className="bg-orange-50 border border-orange-200 rounded-3xl p-8 text-center">
            <ShieldAlert size={40} className="mx-auto mb-3 text-orange-500" />
            <p className="font-semibold text-slate-800">You don't have approved access to this patient.</p>
            <p className="text-sm text-slate-500 mt-1 mb-5">Send a request — the patient approves it from their app.</p>
            {requestMsg ? (
              <p className="text-sm text-slate-700">{requestMsg}</p>
            ) : (
              <button
                onClick={handleRequestAccess}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition text-sm"
              >
                Request Access
              </button>
            )}
            <p className="mt-4">
              <Link to="/pharmacy/access-requests" className="text-emerald-700 text-sm font-semibold hover:underline">
                View your access requests →
              </Link>
            </p>
          </div>
        ) : patient && prescriptions.length === 0 && !error ? (
          <div className="bg-white border rounded-3xl p-10 text-center text-slate-400">
            <Pill size={40} className="mx-auto mb-3 opacity-40" />
            <p>No prescriptions found for this patient.</p>
          </div>
        ) : patient && (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold text-slate-800 mb-4">To Dispense ({pending.length})</h3>
              {pending.length === 0 ? (
                <p className="text-sm text-slate-400">Everything has been dispensed.</p>
              ) : (
                <div className="grid lg:grid-cols-2 gap-5">
                  {pending.map((rx) => (
                    <PrescriptionCard key={rx.id} rx={rx} patientId={patient.id} onDispensed={handleDispensed} />
                  ))}
                </div>
              )}
            </section>
            {done.length > 0 && (
              <section>
                <h3 className="text-lg font-bold text-slate-800 mb-4">Dispensed ({done.length})</h3>
                <div className="grid lg:grid-cols-2 gap-5">
                  {done.map((rx) => (
                    <PrescriptionCard key={rx.id} rx={rx} patientId={patient.id} onDispensed={handleDispensed} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

      </div>
    </PharmacyLayout>
  );
}

export default PharmacyPrescriptionsPage;
