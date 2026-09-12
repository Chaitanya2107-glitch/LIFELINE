import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search, User, FileText, Upload, ClipboardList, ChevronRight,
  Activity, Clipboard, CheckCircle, ChevronDown, ChevronUp,
  Stethoscope, FlaskConical, Tag, FileSearch, X, ShieldCheck,
  ZoomIn, ZoomOut, Download, Sparkles, Clock, AlertTriangle, Loader,
  ClipboardCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import DoctorLayout from "../../layouts/DoctorLayout";
import { searchPatients } from "../../api/patients.js";
import { getRecords } from "../../api/records.js";
import { requestConsent, getConsentStatus } from "../../api/consent.js";
import { getCarePlanForPatient, updateCarePlanItem } from "../../api/carePlan.js";

// ─── Expiry helpers ────────────────────────────────────────────────────────────
function getExpiryInfo(expiresAt) {
  if (!expiresAt) return null;
  const msLeft = new Date(expiresAt) - Date.now();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) {
    return { daysLeft: 0, isExpired: true, label: "Access Expired", color: "bg-red-100 text-red-700 border-red-200" };
  }
  if (daysLeft <= 2) {
    return { daysLeft, isExpired: false, label: `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`, color: "bg-orange-100 text-orange-700 border-orange-200" };
  }
  return { daysLeft, isExpired: false, label: `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`, color: "bg-yellow-50 text-yellow-700 border-yellow-200" };
}

// ─── Inline Report Viewer Modal ───────────────────────────────────────────────
function ReportViewerModal({ report, patient, expiresAt, onClose }) {
  const [zoom, setZoom] = useState(1);
  const isPDF = report.file_name?.toLowerCase().endsWith(".pdf");
  const isImage = /\.(jpg|jpeg|png)$/i.test(report.file_name || "");
  // fileRef may be a signed URL stored on the report object after "View" is clicked
  const fileUrl = report._signedUrl || null;
  const expiry = getExpiryInfo(expiresAt);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col" onClick={onClose}>
      <div className="flex flex-col w-full h-full max-w-5xl mx-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-4 shrink-0">
          <div>
            <p className="font-bold text-sm truncate max-w-lg">{(report.file_name || "Report").replace(/_/g, " ")}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {report.report_type} · {patient?.name || report.patient_id} ·{" "}
              {new Date(report.created_at || report.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {fileUrl && isImage && (
              <>
                <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"><ZoomOut size={16} /></button>
                <span className="text-xs font-mono">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"><ZoomIn size={16} /></button>
              </>
            )}
            {fileUrl && (
              <a href={fileUrl} download={report.file_name} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
                <Download size={13} />Download
              </a>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"><X size={18} /></button>
          </div>
        </div>
        {expiry && (
          <div className={`flex items-center gap-3 px-6 py-2.5 border-b text-sm font-medium ${expiry.isExpired ? "bg-red-900/80 border-red-700 text-red-100" : "bg-yellow-900/60 border-yellow-700 text-yellow-100"}`}>
            <AlertTriangle size={15} className="shrink-0" />
            {expiry.isExpired
              ? "Your approved access to this report has expired. The patient would need to re-approve."
              : `Approved access ${expiry.label.toLowerCase()} — the patient's authorisation will end soon.`}
          </div>
        )}
        <div className="flex-1 overflow-auto bg-slate-800 p-6">
          {fileUrl && isPDF ? (
            <iframe src={fileUrl} title={report.file_name} className="w-full h-full rounded-xl" style={{ minHeight: "70vh" }} />
          ) : fileUrl && isImage ? (
            <div className="flex items-start justify-center min-h-full">
              <img src={fileUrl} alt={report.file_name} style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }} className="max-w-full rounded-xl shadow-lg" />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <div className="border-b border-slate-200 pb-5 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center"><FileText size={20} className="text-blue-600" /></div>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1"><ShieldCheck size={12} />{report.status}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{(report.file_name || "").replace(/_/g, " ").replace(/\.\w+$/, "")}</h2>
                  <p className="text-slate-500 text-sm mt-1">{report.report_type}</p>
                  <p className="text-xs text-blue-600 font-medium mt-1">Patient: {patient?.name || report.patient_id}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Ordering Doctor</p><p className="font-semibold text-slate-800 text-sm">{report.uploader_name || "—"}</p></div>
                  <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Report ID</p><p className="font-mono text-slate-700 text-sm">{report.id}</p></div>
                </div>
                {report.procedures?.length > 0 && <div className="mb-5"><p className="text-sm font-bold text-slate-700 mb-2">Tests / Procedures</p><div className="flex flex-wrap gap-2">{report.procedures.map((p, i) => <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-3 py-1 rounded-full">{p}</span>)}</div></div>}
                {report.lab_values?.length > 0 && <div className="mb-5"><p className="text-sm font-bold text-slate-700 mb-2">Lab Results</p><div className="border rounded-xl overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-slate-50 border-b"><th className="text-left px-3 py-2 font-semibold text-slate-600">Parameter</th><th className="text-left px-3 py-2 font-semibold text-slate-600">Result</th><th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th></tr></thead><tbody>{report.lab_values.map((lv, i) => <tr key={i} className="border-b last:border-0"><td className="px-3 py-2 text-slate-700 font-medium">{lv.name}</td><td className="px-3 py-2 font-mono text-slate-800">{lv.value} {lv.unit}</td><td className="px-3 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lv.normal ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>{lv.normal ? "Normal" : "Attention"}</span></td></tr>)}</tbody></table></div></div>}
                {report.diagnosis?.length > 0 && <div className="mb-5"><p className="text-sm font-bold text-slate-700 mb-2">Findings</p>{report.diagnosis.map((d, i) => <div key={i} className="flex items-start gap-2 text-sm text-slate-700 mb-1"><span className="text-orange-500 font-bold mt-0.5">→</span>{d}</div>)}</div>}
                {report.follow_ups?.length > 0 && <div className="mb-5"><p className="text-sm font-bold text-slate-700 mb-2">Recommendations</p>{report.follow_ups.map((f, i) => <div key={i} className="flex items-start gap-2 text-sm text-slate-700 mb-1"><span className="text-green-600 font-bold mt-0.5">✓</span>{f}</div>)}</div>}
                <div className="mt-4 pt-4 border-t text-xs text-slate-400 text-center">Uploaded by {report.uploader_name || "—"} · {new Date(report.created_at || report.uploadedAt || Date.now()).toLocaleString("en-IN")}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Expandable authorized section ───────────────────────────────────────────
function AuthorizedSection({ title, icon: Icon, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white border rounded-3xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-8 py-5 hover:bg-slate-50 transition"
      >
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Icon size={18} className="text-blue-600" /> {title}
        </h3>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open && <div className="px-8 pb-8">{children}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function PatientSearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);

  // Records and consent state for selected patient
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [consentInfo, setConsentInfo] = useState(null);  // null | consent object
  const [requestingConsent, setRequestingConsent] = useState(false);
  const [consentMessage, setConsentMessage] = useState("");

  // Care plan state for selected patient (doctor view — requires approved consent)
  const [carePlan, setCarePlan] = useState([]);
  const [carePlanLoading, setCarePlanLoading] = useState(false);
  const [carePlanError, setCarePlanError] = useState("");

  // Auto-select patient when navigated here from a notification/access request
  useEffect(() => {
    const autoId = location.state?.autoSelectPatientId;
    if (autoId) {
      setSelectedPatient({ id: autoId, name: autoId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch records + consent when a patient is selected
  useEffect(() => {
    if (!selectedPatient?.id) return;

    setRecordsLoading(true);
    setRecords([]);
    setConsentInfo(null);
    setCarePlan([]);
    setCarePlanError("");

    // Fetch consent status and records in parallel
    Promise.allSettled([
      getRecords(selectedPatient.id),
      getConsentStatus(selectedPatient.id),
    ]).then(([recResult, conResult]) => {
      if (recResult.status === "fulfilled") setRecords(recResult.value);
      if (conResult.status === "fulfilled") setConsentInfo(conResult.value);
    }).finally(() => setRecordsLoading(false));
  }, [selectedPatient?.id]);

  // Fetch care plan once we know consent is approved
  useEffect(() => {
    if (!selectedPatient?.id || consentInfo?.status !== "approved") return;
    setCarePlanLoading(true);
    setCarePlanError("");
    getCarePlanForPatient(selectedPatient.id)
      .then((data) => setCarePlan(Array.isArray(data) ? data : []))
      .catch((err) => setCarePlanError(err.message || "Failed to load care plan."))
      .finally(() => setCarePlanLoading(false));
  }, [selectedPatient?.id, consentInfo?.status]);

  const handleCarePlanStatusChange = useCallback((itemId, newStatus) => {
    updateCarePlanItem(itemId, newStatus)
      .then((updated) =>
        setCarePlan((prev) => prev.map((c) => c.id === updated.id ? updated : c))
      )
      .catch((err) => alert(err.message || "Failed to update care plan item."));
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    const code = query.trim();
    if (!code) return;
    setSearchError("");
    setSearchLoading(true);
    setSelectedPatient(null);
    try {
      const patient = await searchPatients(code);
      setSelectedPatient(patient);
      setQuery("");
    } catch (err) {
      setSearchError(err.message || "No patient found with this LFL code.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!selectedPatient) return;
    setRequestingConsent(true);
    setConsentMessage("");
    try {
      const result = await requestConsent(selectedPatient.id);
      setConsentInfo(result);
      setConsentMessage("Access request sent — awaiting patient approval.");
    } catch (err) {
      setConsentMessage(err.message || "Failed to send access request.");
    } finally {
      setRequestingConsent(false);
    }
  };

  // Lowercase status comparisons per API contract
  const hasFullAccess = consentInfo?.status === "approved";
  const isPending = consentInfo?.status === "pending";
  const isDenied = consentInfo?.status === "denied";

  return (
    <DoctorLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Patient Search</h1>
          <p className="text-slate-500 mt-2">
            Search by Lifeline Code (LFL-XXXXXX) to view a patient's profile, upload reports, or request record access.
          </p>
        </div>

        {/* Search box */}
        <form onSubmit={handleSearch} className="relative max-w-xl mb-8 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSearchError(""); }}
              placeholder="Enter LFL code — e.g. LFL-J6MTOC"
              className="w-full border border-slate-300 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={searchLoading || !query.trim()}
            className="bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {searchLoading ? <Loader size={15} className="animate-spin" /> : <Search size={15} />}
            Search
          </button>
        </form>

        {searchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-4 mb-8 text-sm">
            {searchError}
          </div>
        )}

        {/* Selected patient panel */}
        {selectedPatient && (
          <div className="space-y-6">

            {/* Patient info card */}
            <div className="bg-white border rounded-3xl p-8 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <User size={28} className="text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedPatient.name}</h2>
                    <p className="text-blue-600 font-mono text-sm mt-0.5">{selectedPatient.patient_code || selectedPatient.id}</p>
                    {selectedPatient.phone && (
                      <p className="text-slate-500 text-sm mt-1">Phone: {selectedPatient.phone}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedPatient(null); setRecords([]); setConsentInfo(null); setConsentMessage(""); }}
                  className="text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕ Clear
                </button>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t">
                <button
                  onClick={() => navigate("/doctor/upload", { state: { patientId: selectedPatient.id } })}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
                >
                  <Upload size={16} /> Upload Report
                </button>

                {(!consentInfo || isDenied) && (
                  <button
                    onClick={handleRequestAccess}
                    disabled={requestingConsent}
                    className="flex items-center gap-2 bg-orange-100 text-orange-700 px-5 py-3 rounded-xl font-semibold hover:bg-orange-200 transition text-sm disabled:opacity-50"
                  >
                    {requestingConsent ? <Loader size={15} className="animate-spin" /> : <ClipboardList size={16} />}
                    Request Full History Access
                  </button>
                )}

                {isPending && (
                  <div className="flex items-center gap-2 bg-yellow-100 text-yellow-700 px-5 py-3 rounded-xl text-sm font-semibold">
                    <ClipboardList size={16} /> Access Request Pending Patient Approval
                  </div>
                )}

                {hasFullAccess && (
                  <div className="flex items-center gap-2 bg-green-100 text-green-700 px-5 py-3 rounded-xl text-sm font-semibold">
                    <CheckCircle size={16} /> Full History Access Approved
                    {consentInfo?.expires_at && (
                      <span className="text-xs ml-1 opacity-75">
                        · Expires {new Date(consentInfo.expires_at).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {consentMessage && (
                <p className="mt-3 text-sm text-blue-600">{consentMessage}</p>
              )}
            </div>

            {/* Access expiry banner */}
            {hasFullAccess && consentInfo?.expires_at && (() => {
              const expiry = getExpiryInfo(consentInfo.expires_at);
              if (!expiry) return null;
              return (
                <div className={`flex items-center gap-3 p-4 rounded-2xl border text-sm font-medium ${expiry.isExpired ? "bg-red-50 border-red-200 text-red-700" : expiry.daysLeft <= 2 ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"}`}>
                  <AlertTriangle size={16} className="shrink-0" />
                  {expiry.isExpired
                    ? "Your approved access to this patient's records has expired."
                    : <>Approved access <strong>{expiry.label.toLowerCase()}</strong> — valid until <strong>{new Date(consentInfo.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</strong>.</>}
                </div>
              );
            })()}

            {/* Medical Records */}
            <div className="bg-white border rounded-3xl p-8 shadow-sm">
              <h3 className="text-xl font-bold text-slate-800 mb-6">
                Medical Reports
                {recordsLoading && <span className="text-sm font-normal text-slate-400 ml-2">Loading…</span>}
              </h3>

              {recordsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader size={28} className="animate-spin text-blue-400" />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText size={40} className="mx-auto mb-3 opacity-40" />
                  <p>No records accessible. Upload a report or request access to existing records.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((r) => (
                    <div key={r.id} className="border rounded-2xl p-5 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-xl shrink-0">
                          <FileText size={18} className="text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800">{(r.file_name || "Report").replace(/_/g, " ")}</p>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {r.report_type} · {r.uploader_name || "—"} ·{" "}
                            {new Date(r.created_at || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {r.diagnosis?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {r.diagnosis.map((d, i) => (
                                <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{d}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0">
                          {r.status}
                        </span>
                      </div>
                      <div className="mt-3 pl-1">
                        <button
                          onClick={() => setViewingReport(r)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                        >
                          <FileSearch size={14} />
                          View Report
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Care Plan — only visible when doctor has approved consent */}
            {hasFullAccess && (
              <div className="bg-white border rounded-3xl p-8 shadow-sm">
                <h3 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <ClipboardCheck size={20} className="text-purple-600" />
                  Care Plan
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Follow-up actions extracted from this patient's uploaded reports.
                </p>

                {carePlanLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader size={24} className="animate-spin text-purple-400" />
                  </div>
                ) : carePlanError ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                    {carePlanError}
                  </div>
                ) : carePlan.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <ClipboardCheck size={36} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No care plan items yet. They are generated automatically when reports with follow-up instructions are uploaded.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {carePlan.map((item) => {
                      const isOverdue = item.due_date && item.status !== "completed" && new Date(item.due_date) < new Date();
                      const statusColors = {
                        pending:   "bg-orange-50 border-orange-200 text-orange-700",
                        ongoing:   "bg-blue-50 border-blue-200 text-blue-700",
                        completed: "bg-green-50 border-green-200 text-green-700",
                      };
                      const priorityColors = {
                        high:   "bg-red-100 text-red-700",
                        medium: "bg-orange-100 text-orange-700",
                        low:    "bg-slate-100 text-slate-600",
                      };
                      return (
                        <div
                          key={item.id}
                          className={`border rounded-2xl p-4 ${isOverdue ? "border-red-200 bg-red-50/30" : "bg-white"}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap gap-2 mb-1.5">
                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusColors[item.status] || "bg-slate-50 border-slate-200 text-slate-600"}`}>
                                  {isOverdue ? "⚠ Overdue" : item.status}
                                </span>
                                {item.priority && (
                                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${priorityColors[item.priority] || "bg-slate-100 text-slate-600"}`}>
                                    {item.priority} priority
                                  </span>
                                )}
                              </div>
                              <p className="font-semibold text-slate-900 text-sm leading-snug">{item.title}</p>
                              {item.description && item.title !== item.description && (
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                              )}
                              {item.due_date && (
                                <p className={`text-xs mt-1.5 flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                                  <Clock size={11} />
                                  Due: {new Date(item.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                              )}
                            </div>

                            {/* Status selector */}
                            {item.status !== "completed" && (
                              <select
                                value={item.status}
                                onChange={(e) => handleCarePlanStatusChange(item.id, e.target.value)}
                                className="shrink-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
                              >
                                <option value="pending">Pending</option>
                                <option value="ongoing">Ongoing</option>
                                <option value="completed">Completed</option>
                              </select>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Report viewer modal */}
        {viewingReport && (
          <ReportViewerModal
            report={viewingReport}
            patient={selectedPatient}
            expiresAt={hasFullAccess ? consentInfo?.expires_at : null}
            onClose={() => setViewingReport(null)}
          />
        )}

      </div>
    </DoctorLayout>
  );
}

export default PatientSearchPage;
