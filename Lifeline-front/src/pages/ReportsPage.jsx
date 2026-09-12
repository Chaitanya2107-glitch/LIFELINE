import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../components/dashboard/Sidebar";
import Topbar from "../components/dashboard/Topbar";

import {
  Upload,
  FileText,
  Eye,
  Sparkles,
} from "lucide-react";

import { useReport } from "../context/ReportContext";

function ReportsPage() {
  const navigate = useNavigate();
  const { setSelectedReport } = useReport();

  const fileInputRef = useRef(null);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [summary, setSummary] = useState([]);

  const [reports, setReports] = useState([
    {
      id: 1,
      name: "Complete Blood Count.pdf",
      category: "Blood Test",
      date: "12 Jul 2026",
      status: "AI Summary Ready",
      preview: null,
      summary: [
        "🩸 Blood counts appear within expected range.",
        "❤️ No critical abnormalities detected.",
        "📅 Suggested follow-up after 12 months.",
      ],
    },
    {
      id: 2,
      name: "MRI Lumbar Spine.pdf",
      category: "Radiology",
      date: "02 Mar 2026",
      status: "AI Summary Ready",
      preview: null,
      summary: [
        "🩻 MRI images appear unremarkable.",
        "💪 No major structural abnormalities found.",
        "👨‍⚕️ Discuss findings with your physician.",
      ],
    },
    {
      id: 3,
      name: "Prescription.pdf",
      category: "Prescription",
      date: "Today",
      status: "New Upload",
      preview: null,
      summary: [
        "💊 Prescription contains medication instructions.",
        "⏰ Follow dosage schedule carefully.",
        "⚠️ Complete the full course as prescribed.",
      ],
    },
  ]);

  const handleUpload = (event) => {
    const file = event.target.files[0];

    if (!file) return;

    setUploadedFile(file.name);
    setIsAnalyzing(true);

    let category = "General Report";

    const lowerName = file.name.toLowerCase();

    if (
      lowerName.includes("blood") ||
      lowerName.includes("cbc") ||
      lowerName.includes("lab")
    ) {
      category = "Blood Test";
    } else if (
      lowerName.includes("mri") ||
      lowerName.includes("scan")
    ) {
      category = "Radiology";
    } else if (
      lowerName.includes("xray") ||
      lowerName.includes("x-ray")
    ) {
      category = "X-Ray";
    } else if (
      lowerName.includes("prescription") ||
      lowerName.includes("medicine")
    ) {
      category = "Prescription";
    }

    let aiSummary;

    if (category === "Blood Test") {
      aiSummary = [
        "🩸 Blood counts appear within expected range.",
        "❤️ No critical abnormalities detected.",
        "📅 Suggested follow-up after 12 months.",
      ];
    } else if (category === "Radiology") {
      aiSummary = [
        "🩻 MRI images appear unremarkable.",
        "💪 No major structural abnormalities found.",
        "👨‍⚕️ Discuss findings with your physician.",
      ];
    } else if (category === "X-Ray") {
      aiSummary = [
        "🦴 Bones appear aligned.",
        "✅ No obvious fracture detected.",
        "📋 Clinical review recommended.",
      ];
    } else if (category === "Prescription") {
      aiSummary = [
        "💊 Prescription contains medication instructions.",
        "⏰ Follow dosage schedule carefully.",
        "⚠️ Complete the full course as prescribed.",
      ];
    } else {
      aiSummary = [
        "📄 Report uploaded successfully.",
        "🤖 Lifeline AI generated a preliminary summary.",
        "👨‍⚕️ Review with your healthcare provider.",
      ];
    }

    setSummary(aiSummary);

    const newReport = {
      id: Date.now(),
      name: file.name,
      category,
      date: "Today",
      status: "Processing...",
      preview: URL.createObjectURL(file),
      file,
      summary: aiSummary,
    };

    setReports((prev) => [newReport, ...prev]);

    setTimeout(() => {
      setIsAnalyzing(false);

      setReports((prev) =>
        prev.map((report) =>
          report.id === newReport.id
            ? {
                ...report,
                status: "AI Summary Ready",
              }
            : report
        )
      );
    }, 3000);

    event.target.value = "";
  };

  const openReport = (report) => {
    setSelectedReport(report);
    navigate("/report-viewer");
  };

  const showAISummary = (report) => {
    setSummary(report.summary || []);
    setUploadedFile(report.name);
    setIsAnalyzing(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col shrink-0">
        <Sidebar />
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto p-10">

        <Topbar />

        {/* PAGE HEADER */}
        <div className="flex justify-between items-center mb-8">

          <div>
            <h1 className="text-4xl font-bold text-slate-900">
              Reports
            </h1>

            <p className="text-slate-500 mt-2">
              Upload, organize and review your medical records.
            </p>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={handleUpload}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition"
            >
              <Upload size={20} />
              Upload Report
            </button>
          </div>

        </div>

        {/* UPLOAD SUCCESS */}
        {uploadedFile && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <h3 className="font-semibold text-green-700">
              ✅ Report uploaded successfully!
            </h3>

            <p className="text-green-600 mt-1">
              {uploadedFile}
            </p>
          </div>
        )}

        {/* AI ANALYZING */}
        {uploadedFile && isAnalyzing && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">

            <h3 className="font-semibold text-blue-700">
              🤖 Lifeline AI is analyzing your report...
            </h3>

            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mt-4">
              <div className="h-3 w-3/4 bg-blue-600 rounded-full animate-pulse" />
            </div>

            <p className="text-sm text-slate-500 mt-3">
              Extracting medical terms • Creating summary • Updating timeline...
            </p>

          </div>
        )}

        {/* AI COMPLETE */}
        {uploadedFile && !isAnalyzing && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-6">

            <h3 className="text-xl font-bold text-green-700 mb-5">
              🩺 AI Analysis Complete
            </h3>

            <div className="space-y-3">

              {summary.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl p-3 shadow-sm"
                >
                  {item}
                </div>
              ))}

            </div>

          </div>
        )}

        {/* REPORTS LIST */}
        <div className="space-y-6">

          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-3xl shadow-sm border p-6"
            >

              <div className="flex justify-between items-center">

                {/* REPORT INFO */}
                <div className="flex items-center gap-5">

                  <div className="bg-blue-100 p-4 rounded-2xl">
                    <FileText className="text-blue-600" />
                  </div>

                  <div>

                    <h2 className="font-semibold text-xl">
                      {report.name}
                    </h2>

                    <p className="text-slate-500 mt-1">
                      {report.category} • {report.date}
                    </p>

                  </div>

                </div>

                {/* ACTIONS */}
                <div className="flex items-center gap-4">

                  {/* STATUS */}
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      report.status === "Processing..."
                        ? "bg-yellow-100 text-yellow-700 animate-pulse"
                        : report.status === "AI Summary Ready"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {report.status}
                  </span>

                  {/* VIEW */}
                  <button
                    onClick={() => openReport(report)}
                    className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl hover:bg-slate-200 transition"
                  >
                    <Eye size={18} />
                    View
                  </button>

                  {/* AI SUMMARY */}
                  <button
                    onClick={() => showAISummary(report)}
                    className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-200 transition"
                  >
                    <Sparkles size={18} />
                    AI Summary
                  </button>

                </div>

              </div>

            </div>
          ))}

        </div>

      </main>
    </div>
  );
}

export default ReportsPage;