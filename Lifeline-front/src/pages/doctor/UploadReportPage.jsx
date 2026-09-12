import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Upload, FileText, User, CheckCircle, AlertCircle,
  ShieldCheck, Loader,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import DoctorLayout from "../../layouts/DoctorLayout";
import { searchPatients } from "../../api/patients.js";
import { uploadRecord } from "../../api/records.js";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_FILE_SIZE_MB = 10;

const REPORT_TYPES = [
  "Blood Test", "Radiology", "X-Ray", "Prescription", "Pathology",
  "Cardiology", "Neurology", "Discharge Summary", "General Report",
];

// ── Step badge ────────────────────────────────────────────────────────────────
function StepBadge({ n, done }) {
  return (
    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${done ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}>
      {done ? <CheckCircle size={14} /> : n}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function UploadReportPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { currentUser } = useAuth();

  const fileInputRef = useRef(null);

  // Step 1 — identify patient
  const [patientQuery, setPatientQuery]     = useState("");
  const [patientFound, setPatientFound]     = useState(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientError, setPatientError]     = useState("");

  // Step 2 — report type
  const [reportType, setReportType] = useState("");

  // Step 3 — file
  const [file, setFile]           = useState(null);
  const [fileError, setFileError] = useState("");

  // Upload
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [isUploading,   setIsUploading]   = useState(false);
  const [uploadError,   setUploadError]   = useState("");

  // Pre-fill patient from navigation state (PatientSearchPage "Upload" button)
  useEffect(() => {
    const prefilledId = location.state?.patientId;
    if (prefilledId) {
      setPatientQuery(prefilledId);
      setPatientLoading(true);
      searchPatients(prefilledId)
        .then((p) => setPatientFound(p))
        .catch(() => {/* silent — user can search manually */})
        .finally(() => setPatientLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 1 handlers ──────────────────────────────────────────────────────────

  const handlePatientLookup = async () => {
    setPatientError("");
    setPatientFound(null);
    const code = patientQuery.trim();
    if (!code) return;
    setPatientLoading(true);
    try {
      const p = await searchPatients(code);
      setPatientFound(p);
    } catch (err) {
      setPatientError(err.message || "No patient found with this LFL code.");
    } finally {
      setPatientLoading(false);
    }
  };

  // ── Step 3 handlers ──────────────────────────────────────────────────────────

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    setFileError("");
    setFile(null);
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError("Invalid file type. Only PDF, JPG, and PNG files are accepted.");
      return;
    }
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError("Invalid file extension.");
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`File size exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
      return;
    }
    setFile(f);
  };

  // ── Upload handler ───────────────────────────────────────────────────────────

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!patientFound || !reportType || !file) return;
    setUploadError("");
    setIsUploading(true);
    try {
      const record = await uploadRecord(patientFound.id, file, reportType);
      setUploadSuccess(record);
      setFile(null);
    } catch (err) {
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setPatientQuery("");
    setReportType("");
    setFile(null);
    setFileError("");
    setPatientFound(null);
    setPatientError("");
    setUploadSuccess(null);
    setUploadError("");
  };

  const step1Done = !!patientFound;
  const step2Done = !!reportType;
  const step3Done = !!file && !fileError;

  return (
    <DoctorLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Upload Medical Report</h1>
          <p className="text-slate-500 mt-2">
            Upload a report on behalf of a patient. Your doctor credentials authorize the upload.
          </p>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-8">
          <ShieldCheck size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-700 text-sm">Doctor-authenticated upload</p>
            <p className="text-blue-600 text-sm mt-1">
              Your staff JWT authenticates you as the uploader. All uploads are audit-logged
              against your account and the patient's record.
            </p>
          </div>
        </div>

        {uploadSuccess ? (
          /* ── Success ── */
          <div className="bg-white border border-green-200 rounded-3xl p-10 shadow-sm text-center max-w-xl mx-auto">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">Report Uploaded Successfully</h2>
            <div className="text-left bg-slate-50 rounded-2xl p-5 space-y-2 text-sm mb-8">
              <p><span className="text-slate-500">Record ID:</span>{" "}<span className="font-mono font-bold">{uploadSuccess.id}</span></p>
              <p><span className="text-slate-500">Patient:</span>{" "}{patientFound?.name}</p>
              <p><span className="text-slate-500">Type:</span>{" "}{uploadSuccess.report_type}</p>
              <p><span className="text-slate-500">File:</span>{" "}{uploadSuccess.file_name}</p>
              <p><span className="text-slate-500">Status:</span>{" "}<span className="text-green-700 font-semibold">{uploadSuccess.status}</span></p>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={handleReset} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-sm">
                Upload Another Report
              </button>
              <button onClick={() => navigate("/doctor/records")} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-200 transition text-sm">
                View All Records
              </button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleUpload} className="max-w-2xl space-y-6">

            {/* Step 1 — Identify Patient */}
            <div className="bg-white border rounded-3xl p-8 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <StepBadge n={1} done={step1Done} />
                Identify Patient
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setPatientFound(null);
                    setPatientError("");
                  }}
                  placeholder="LFL-J6MTOC"
                  className="flex-1 border border-slate-300 rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handlePatientLookup}
                  disabled={patientLoading || !patientQuery.trim()}
                  className="bg-blue-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {patientLoading ? <Loader size={15} className="animate-spin" /> : null}
                  Find Patient
                </button>
              </div>
              {patientError && (
                <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
                  <AlertCircle size={14} /> {patientError}
                </div>
              )}
              {patientFound && (
                <div className="mt-4 flex items-center gap-4 bg-green-50 border border-green-200 rounded-2xl p-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <User size={18} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{patientFound.name}</p>
                    <p className="text-xs font-mono text-green-600">{patientFound.patient_code}</p>
                  </div>
                  <CheckCircle size={18} className="text-green-600 ml-auto" />
                </div>
              )}
            </div>

            {/* Step 2 — Report Type */}
            <div className={`bg-white border rounded-3xl p-8 shadow-sm transition-opacity ${!step1Done ? "opacity-40 pointer-events-none" : ""}`}>
              <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <StepBadge n={2} done={step2Done} />
                Report Type
              </h3>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Select report type...</option>
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Step 3 — Select File */}
            <div className={`bg-white border rounded-3xl p-8 shadow-sm transition-opacity ${!step2Done ? "opacity-40 pointer-events-none" : ""}`}>
              <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <StepBadge n={3} done={step3Done} />
                Select File
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition"
              >
                <Upload size={32} className="mx-auto text-slate-400 mb-3" />
                <p className="font-semibold text-slate-600">Click to select file</p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG — max {MAX_FILE_SIZE_MB} MB</p>
              </button>
              {fileError && (
                <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
                  <AlertCircle size={14} /> {fileError}
                </div>
              )}
              {file && !fileError && (
                <div className="mt-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <FileText size={18} className="text-blue-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 text-sm truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-red-600">&#x2715;</button>
                </div>
              )}
            </div>

            {/* Upload error */}
            {uploadError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle size={15} /> {uploadError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!step1Done || !step2Done || !step3Done || isUploading}
              className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload Medical Report
                </>
              )}
            </button>

          </form>
        )}

      </div>
    </DoctorLayout>
  );
}

export default UploadReportPage;
