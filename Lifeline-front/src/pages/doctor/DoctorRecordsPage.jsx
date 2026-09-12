import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import DoctorLayout from "../../layouts/DoctorLayout";
import {
  FileText, User, Calendar, FileSearch, ChevronDown, ChevronUp,
  X, Sparkles, ShieldCheck, ZoomIn, ZoomOut, Download, Clock, AlertTriangle, Loader,
} from "lucide-react";
import { getMyAccess } from "../../api/consent.js";
import { getRecords, getFileUrl } from "../../api/records.js";

// Returns { daysLeft, isExpired, label, color } for an approved-access report.
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

// ── Report Viewer Modal ────────────────────────────────────────────────────────
function ReportViewerModal({ report, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [fileUrl, setFileUrl] = useState(report._signedUrl || null);
  const [loadingFile, setLoadingFile] = useState(!fileUrl);

  useEffect(() => {
    if (fileUrl) return;
    getFileUrl(report.id)
      .then((res) => setFileUrl(res.signed_url))
      .catch(() => setFileUrl(null))
      .finally(() => setLoadingFile(false));
  }, [report.id, fileUrl]);

  const isPDF = report.file_name?.toLowerCase().endsWith(".pdf");
  const isImage = /\.(jpg|jpeg|png)$/i.test(report.file_name || "");
  const expiry = getExpiryInfo(report._expiresAt);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col" onClick={onClose}>
      <div className="flex flex-col w-full h-full max-w-5xl mx-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-4 shrink-0">
          <div>
            <p className="font-bold text-sm truncate max-w-lg">{(report.file_name || "Report").replace(/_/g, " ")}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {report.report_type} · {new Date(report.created_at || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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

        {/* Expiry warning */}
        {expiry && (
          <div className={`flex items-center gap-3 px-6 py-2.5 border-b text-sm font-medium ${expiry.isExpired ? "bg-red-900/80 border-red-700 text-red-100" : "bg-yellow-900/60 border-yellow-700 text-yellow-100"}`}>
            <AlertTriangle size={15} className="shrink-0" />
            {expiry.isExpired ? "Your approved access to this report has expired." : `Approved access ${expiry.label.toLowerCase()} — the patient's authorisation will end soon.`}
          </div>
        )}

        {/* Document area */}
        <div className="flex-1 overflow-auto bg-slate-800 p-6">
          {loadingFile ? (
            <div className="flex justify-center items-center h-48">
              <Loader size={32} className="animate-spin text-blue-400" />
            </div>
          ) : fileUrl && isPDF ? (
            <iframe src={fileUrl} title={report.file_name} className="w-full h-full rounded-xl" style={{ minHeight: "70vh" }} />
          ) : fileUrl && isImage ? (
            <div className="flex items-start justify-center min-h-full">
              <img src={fileUrl} alt={report.file_name} style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }} className="max-w-full rounded-xl shadow-lg" />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <div className="border-b border-slate-200 pb-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <FileText size={22} className="text-blue-600" />
                    </div>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                      <ShieldCheck size={12} />{report.status}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{(report.file_name || "").replace(/_/g, " ").replace(/\.\w+$/, "")}</h2>
                  <p className="text-slate-500 text-sm mt-1">{report.report_type}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Ordering Doctor</p>
                    <p className="font-semibold text-slate-800">{report.uploader_name || "—"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Report ID</p>
                    <p className="font-mono text-slate-700 text-sm">{report.id}</p>
                  </div>
                </div>

                {report.procedures?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-bold text-slate-700 mb-3">Tests / Procedures Performed</p>
                    <div className="flex flex-wrap gap-2">
                      {report.procedures.map((p, i) => (
                        <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-3 py-1.5 rounded-full">{p}</span>
                      ))}
                    </div>
                  </div>
                )}

                {report.lab_values?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-bold text-slate-700 mb-3">Laboratory Results</p>
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-slate-50 border-b">
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Parameter</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Result</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Status</th>
                        </tr></thead>
                        <tbody>
                          {report.lab_values.map((lv, i) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="px-4 py-2.5 text-slate-700 font-medium">{lv.name}</td>
                              <td className="px-4 py-2.5 font-mono text-slate-800">{lv.value} {lv.unit}</td>
                              <td className="px-4 py-2.5">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${lv.normal ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                                  {lv.normal ? "Normal" : "Attention"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {report.diagnosis?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-bold text-slate-700 mb-3">Clinical Findings</p>
                    <div className="space-y-2">
                      {report.diagnosis.map((d, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-orange-500 font-bold mt-0.5">→</span>{d}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {report.follow_ups?.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-bold text-slate-700 mb-3">Recommendations</p>
                    <div className="space-y-2">
                      {report.follow_ups.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-green-600 font-bold mt-0.5">✓</span>{f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t text-xs text-slate-400 text-center">
                  Uploaded by {report.uploader_name || "—"} · {new Date(report.created_at || Date.now()).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
function DoctorRecordsPage() {
  const { currentUser } = useAuth();
  const [viewingReport, setViewingReport] = useState(null);

  // All records accessible to this doctor: own uploads + approved-access records.
  // The backend returns both from GET /medical-records when called with doctor JWT
  // (consent middleware applies). We gather patient IDs from approved consents
  // and fetch records for each, then deduplicate.
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch the doctor's own consent/access list to know which patient IDs to query
      const accesses = await getMyAccess();

      // Approved accesses give us additional patient IDs
      const approvedPatientIds = accesses
        .filter((a) => a.status === "approved")
        .map((a) => ({ patientId: a.patient_id, expiresAt: a.expires_at }));

      // Fetch records for all accessible patients in parallel
      // Each call returns the records the backend allows (own + approved)
      const patientIds = [...new Set(approvedPatientIds.map((a) => a.patientId))];

      const fetches = patientIds.map((pid) =>
        getRecords(pid).then((recs) => {
          const accessEntry = approvedPatientIds.find((a) => a.patientId === pid);
          // Attach expiry info for display
          return recs.map((r) => ({ ...r, _expiresAt: accessEntry?.expiresAt || null }));
        }).catch(() => [])
      );

      const results = await Promise.all(fetches);
      const allRecords = results.flat();

      // Deduplicate by id
      const seen = new Set();
      const deduped = allRecords.filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      setRecords(deduped);
    } catch (err) {
      setError(err.message || "Failed to load records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <DoctorLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Medical Records</h1>
          <p className="text-slate-500 mt-2">
            Reports you uploaded + records you have been granted patient access to.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader size={36} className="animate-spin text-blue-400" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-6 text-sm">{error}</div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-3xl border p-12 text-center text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">No records yet</h2>
            <p>Upload a patient report to see it here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((r) => {
              const expiry = r._expiresAt ? getExpiryInfo(r._expiresAt) : null;
              return (
                <div key={r.id} className="bg-white border rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                  <div className="flex items-center gap-5">
                    <div className="bg-blue-100 p-4 rounded-2xl shrink-0">
                      <FileText size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900">{(r.file_name || "Report").replace(/_/g, " ")}</h3>
                      <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} />
                          {new Date(r.created_at || Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <span>{r.report_type}</span>
                        {r.uploader_name && <span>Uploaded by: {r.uploader_name}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                        {r.status}
                      </span>
                      {expiry && (
                        <span className={`flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full border ${expiry.color}`}>
                          <Clock size={11} />
                          {expiry.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="mt-5 pt-5 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-500">
                    <div>
                      <p className="font-semibold text-slate-700 mb-0.5">Record ID</p>
                      <p className="font-mono truncate">{r.id}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 mb-0.5">File</p>
                      <p>{r.file_name || "—"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 mb-0.5">Verification</p>
                      <p className="text-green-600 font-semibold">{r.status}</p>
                    </div>
                    {r._expiresAt && (
                      <div>
                        <p className="font-semibold text-slate-700 mb-0.5 flex items-center gap-1">
                          <Clock size={11} /> Access Expires
                        </p>
                        <p className={getExpiryInfo(r._expiresAt)?.isExpired ? "text-red-600 font-semibold" : "text-slate-600"}>
                          {new Date(r._expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* View button */}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => setViewingReport(r)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                    >
                      <FileSearch size={15} />
                      View Report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Report viewer modal */}
        {viewingReport && (
          <ReportViewerModal
            report={viewingReport}
            onClose={() => setViewingReport(null)}
          />
        )}

      </div>
    </DoctorLayout>
  );
}

export default DoctorRecordsPage;
