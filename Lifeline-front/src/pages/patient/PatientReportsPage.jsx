import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import {
  FileText, ShieldCheck, Lock, Eye, Calendar, Stethoscope,
  ChevronDown, ChevronUp, Sparkles, FileSearch, X, ZoomIn, ZoomOut,
  Download, Loader2,
} from "lucide-react";
import { getRecords, getFileUrl } from "../../api/records.js";

// ── Original Report Viewer Modal ──────────────────────────────────────────────
function ReportViewerModal({ report, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [fileUrl, setFileUrl] = useState(report.fileRef || null);
  const [loadingFile, setLoadingFile] = useState(!report.fileRef && !!report.id);

  useEffect(() => {
    if (report.fileRef || !report.id) return;
    getFileUrl(report.id)
      .then(({ signed_url }) => setFileUrl(signed_url))
      .catch(() => {/* no signed URL available — fallback to info view */})
      .finally(() => setLoadingFile(false));
  }, [report.id, report.fileRef]);

  const isPDF = report.file_name?.toLowerCase().endsWith(".pdf");
  const isImage =
    report.file_name?.toLowerCase().endsWith(".jpg") ||
    report.file_name?.toLowerCase().endsWith(".jpeg") ||
    report.file_name?.toLowerCase().endsWith(".png");

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex flex-col" onClick={onClose}>
      <div
        className="flex flex-col w-full h-full max-w-5xl mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900 text-white px-6 py-4 shrink-0">
          <div>
            <p className="font-bold text-sm truncate max-w-lg">{(report.file_name || report.fileName || "").replace(/_/g, " ")}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {report.report_type || report.reportType} · {report.uploader_name || report.uploaderName} ·{" "}
              {new Date(report.created_at || report.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {fileUrl && isImage && (
              <>
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
                  title="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
                  title="Zoom in"
                >
                  <ZoomIn size={16} />
                </button>
              </>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                download={report.fileName}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
              >
                <Download size={13} />
                Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Document area */}
        <div className="flex-1 overflow-auto bg-slate-800 p-6">
          {loadingFile ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <Loader2 size={32} className="animate-spin mr-3" /> Loading file…
            </div>
          ) : fileUrl && isPDF ? (
            <iframe
              src={fileUrl}
              title={report.fileName}
              className="w-full h-full rounded-xl"
              style={{ minHeight: "70vh" }}
            />
          ) : fileUrl && isImage ? (
            <div className="flex items-start justify-center min-h-full">
              <img
                src={fileUrl}
                alt={report.fileName}
                style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s" }}
                className="max-w-full rounded-xl shadow-lg"
              />
            </div>
          ) : (
            /* Fallback: show document information when no file URL is available */
           <div className="max-w-2xl mx-auto">
             <div className="bg-white rounded-2xl p-8 shadow-lg">
               {/* Document header */}
               <div className="border-b border-slate-200 pb-6 mb-6">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                     <FileText size={22} className="text-blue-600" />
                   </div>
                   <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                     <ShieldCheck size={12} />
                     {report.status}
                   </span>
                 </div>
                 <h2 className="text-xl font-bold text-slate-900">{(report.file_name || report.fileName || "").replace(/_/g, " ").replace(/\.\w+$/, "")}</h2>
                 <p className="text-slate-500 text-sm mt-1">{report.report_type || report.reportType}</p>
               </div>

               {/* Report metadata */}
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-slate-50 rounded-xl p-4">
                   <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Report Date</p>
                   <p className="font-semibold text-slate-800">
                     {(report.dates?.[0] || report.extracted?.dates?.reportDate)
                       ? new Date(report.dates?.[0] || report.extracted.dates.reportDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                       : new Date(report.created_at || report.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                   </p>
                 </div>
                 <div className="bg-slate-50 rounded-xl p-4">
                   <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Ordering Doctor</p>
                   <p className="font-semibold text-slate-800">{report.uploader_name || report.uploaderName}</p>
                 </div>
                 {report.hospital && (
                   <div className="bg-slate-50 rounded-xl p-4">
                     <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Facility</p>
                     <p className="font-semibold text-slate-800">{report.hospital}</p>
                   </div>
                 )}
                 <div className="bg-slate-50 rounded-xl p-4">
                   <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Report ID</p>
                   <p className="font-mono text-slate-700 text-sm">{report.id || report.reportId}</p>
                 </div>
               </div>

               {/* Procedures / tests performed */}
               {report.procedures?.length > 0 && (
                 <div className="mb-6">
                   <p className="text-sm font-bold text-slate-700 mb-3">Tests / Procedures Performed</p>
                   <div className="flex flex-wrap gap-2">
                     {report.procedures.map((p, i) => (
                       <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-3 py-1.5 rounded-full">
                         {p}
                       </span>
                     ))}
                   </div>
                 </div>
               )}

               {/* Lab values */}
               {report.lab_values?.length > 0 && (
                 <div className="mb-6">
                   <p className="text-sm font-bold text-slate-700 mb-3">Laboratory Results</p>
                   <div className="border rounded-xl overflow-hidden">
                     <table className="w-full text-sm">
                       <thead>
                         <tr className="bg-slate-50 border-b">
                           <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Parameter</th>
                           <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Result</th>
                           <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Status</th>
                         </tr>
                       </thead>
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

               {/* Diagnoses */}
               {report.diagnosis?.length > 0 && (
                 <div className="mb-6">
                   <p className="text-sm font-bold text-slate-700 mb-3">Clinical Findings</p>
                   <div className="space-y-2">
                     {report.diagnosis.map((d, i) => (
                       <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                         <span className="text-orange-500 font-bold mt-0.5">→</span>
                         {d}
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* Follow-ups */}
               {report.follow_ups?.length > 0 && (
                 <div className="mb-6">
                   <p className="text-sm font-bold text-slate-700 mb-3">Recommendations</p>
                   <div className="space-y-2">
                     {report.follow_ups.map((f, i) => (
                       <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                         <span className="text-green-600 font-bold mt-0.5">✓</span>
                         {f}
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               <div className="mt-4 pt-4 border-t text-xs text-slate-400 text-center">
                 Original document — uploaded by {report.uploader_name || report.uploaderName} · {new Date(report.created_at || report.uploadedAt).toLocaleString("en-IN")}
               </div>
             </div>
           </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AI Summary Panel ──────────────────────────────────────────────────────────
function AISummaryPanel({ report }) {
  const [open, setOpen] = useState(false);

  // Backend does not return a "summary" field — nothing to show
  if (!report.summary || report.summary.length === 0) return null;

  return (
    <div className="mt-4 border border-purple-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-purple-50 hover:bg-purple-100 transition"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-purple-600" />
          <span className="font-semibold text-purple-800 text-sm">Lifeline AI Summary</span>
          <span className="text-xs text-purple-500 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
            Generated by Lifeline — not the original report
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-purple-500" /> : <ChevronDown size={16} className="text-purple-500" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-4 bg-purple-50/50">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3 text-xs text-purple-700">
            <strong>ℹ Lifeline Understanding</strong> — This summary was generated by Lifeline's AI from the uploaded report.
            It is not a substitute for the original document or professional medical advice.
          </div>
          <ul className="space-y-2">
            {report.summary.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-purple-500 font-bold shrink-0 mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
function PatientReportsPage() {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingReport, setViewingReport] = useState(null);

  useEffect(() => {
    if (!currentUser?.patient_id) return;
    getRecords(currentUser.patient_id)
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [currentUser?.patient_id]);

  const handleViewReport = (report) => {
    setViewingReport(report);
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading reports…
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">My Medical Reports</h1>
          <p className="text-slate-500 mt-2">Verified medical documents uploaded by your doctors. View original reports and Lifeline summaries.</p>
        </div>

        {/* No-upload notice */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
          <Lock size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <strong>Official medical reports are uploaded by authorized doctors only.</strong>
            {" "}This ensures all documents are genuine and prevents fake medical records.
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">No Reports Yet</h2>
            <p>Your doctor will upload reports to your account after your consultation.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {reports.map((r) => (
              <div key={r.id} className="bg-white border rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-start gap-5">
                  <div className="bg-blue-100 p-4 rounded-2xl shrink-0">
                    <FileText size={20} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-slate-900">{(r.file_name || "").replace(/_/g, " ")}</h3>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={13} />
                            {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span>{r.report_type}</span>
                          <span className="flex items-center gap-1.5">
                            <Stethoscope size={13} />
                            {r.uploader_name}
                          </span>
                          {r.hospital && <span>· {r.hospital}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
                          <ShieldCheck size={12} />
                          {r.status}
                        </span>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-500">
                      <div>
                        <p className="font-semibold text-slate-600 mb-0.5">Report ID</p>
                        <p className="font-mono">{r.id}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-600 mb-0.5">Uploaded By</p>
                        <p className="font-mono">{r.uploader_name}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-600 mb-0.5">Report Date</p>
                        <p>{r.dates?.[0] || r.created_at?.slice(0, 10)}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-600 mb-0.5">Verification</p>
                        <p className="text-green-600 font-semibold">{r.status}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => handleViewReport(r)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition bg-blue-600 text-white hover:bg-blue-700"
                      >
                        <FileSearch size={15} />
                        View Original Report
                      </button>
                    </div>

                    {/* AI Summary (collapsible, clearly distinct) */}
                    <AISummaryPanel report={r} />

                  </div>
                </div>
              </div>
            ))}
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
    </PatientLayout>
  );
}

export default PatientReportsPage;
