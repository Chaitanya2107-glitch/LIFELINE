import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/dashboard/Topbar";
import { useReport } from "../context/ReportContext";
import {
  FileText,
  Sparkles,
  BookOpen,
  MessageCircle,
  Calendar,
  Check,
} from "lucide-react";

function ReportViewer() {
  const navigate = useNavigate();

  const { selectedReport, addToJourney } = useReport();

  const [addedToJourney, setAddedToJourney] = useState(false);

  if (!selectedReport) {
    return (
      <div className="flex-1 overflow-y-auto p-10">
        <Topbar />

        <div className="bg-white rounded-3xl p-10 shadow-sm text-center">
          <h2 className="text-3xl font-bold text-slate-800">
            No Report Selected
          </h2>

          <p className="text-slate-500 mt-4">
            Go back to Reports and choose a report to view.
          </p>

          <button
            onClick={() => navigate("/reports")}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition"
          >
            Go to Reports
          </button>
        </div>
      </div>
    );
  }

  const fileName = selectedReport.name.toLowerCase();

  const isImage =
    selectedReport.preview &&
    (fileName.endsWith(".png") ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg"));

  const isPDF =
    selectedReport.preview &&
    fileName.endsWith(".pdf");

  const handleAddToJourney = () => {
    if (!addedToJourney) {
      addToJourney(selectedReport);
      setAddedToJourney(true);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-10">
      <Topbar />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">
          {selectedReport.name}
        </h1>

        <p className="text-slate-500 mt-2">
          {selectedReport.date} • {selectedReport.category}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">

        {/* LEFT PANEL */}
        <section className="bg-white rounded-3xl shadow-sm p-8">

          <div className="flex items-center gap-3 mb-6">
            <FileText className="text-blue-600" />

            <h2 className="text-2xl font-bold">
              Report Preview
            </h2>
          </div>

          <div className="rounded-2xl overflow-hidden border h-[650px] bg-slate-50 flex items-center justify-center">

            {isImage && (
              <img
                src={selectedReport.preview}
                alt={selectedReport.name}
                className="w-full h-full object-contain"
              />
            )}

            {isPDF && (
              <iframe
                src={selectedReport.preview}
                title="PDF Preview"
                className="w-full h-full"
              />
            )}

            {!selectedReport.preview && (
              <div className="text-center">
                <FileText
                  size={80}
                  className="mx-auto text-slate-300 mb-4"
                />

                <p className="text-slate-500">
                  Preview unavailable
                </p>
              </div>
            )}

          </div>
        </section>

        {/* RIGHT PANEL */}
        <div className="space-y-8">

          {/* AI Summary */}
          <section className="bg-white rounded-3xl shadow-sm p-8">

            <div className="flex items-center gap-3 mb-5">
              <Sparkles className="text-blue-600" />

              <h2 className="text-2xl font-bold">
                AI Summary
              </h2>
            </div>

            <div className="bg-blue-50 rounded-2xl p-5 space-y-3">

              {selectedReport.summary &&
                selectedReport.summary.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl p-3 shadow-sm"
                  >
                    {item}
                  </div>
                ))}

            </div>
          </section>

          {/* Medical Terms */}
          <section className="bg-white rounded-3xl shadow-sm p-8">

            <div className="flex items-center gap-3 mb-5">
              <BookOpen className="text-green-600" />

              <h2 className="text-2xl font-bold">
                Medical Terms Explained
              </h2>
            </div>

            <div className="space-y-4">

              <div className="border rounded-2xl p-4">
                <h3 className="font-semibold">
                  Hemoglobin
                </h3>

                <p className="text-slate-600 mt-2">
                  A protein in red blood cells that carries oxygen
                  throughout the body.
                </p>
              </div>

              <div className="border rounded-2xl p-4">
                <h3 className="font-semibold">
                  White Blood Cells
                </h3>

                <p className="text-slate-600 mt-2">
                  Cells that protect your body against infections.
                </p>
              </div>

            </div>
          </section>

          {/* Questions */}
          <section className="bg-white rounded-3xl shadow-sm p-8">

            <div className="flex items-center gap-3 mb-5">
              <MessageCircle className="text-purple-600" />

              <h2 className="text-2xl font-bold">
                Questions to Ask Your Doctor
              </h2>
            </div>

            <ul className="space-y-3 list-disc pl-6 text-slate-700">

              <li>
                Are these findings within the expected range?
              </li>

              <li>
                Should I repeat this test in the future?
              </li>

              <li>
                Do I need any medication or lifestyle changes?
              </li>

              <li>
                Is any follow-up imaging or blood work required?
              </li>

            </ul>
          </section>

          {/* Medical Journey */}
          <button
            onClick={handleAddToJourney}
            disabled={addedToJourney}
            className={`w-full rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 transition ${
              addedToJourney
                ? "bg-green-600 text-white cursor-default"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {addedToJourney ? (
              <>
                <Check size={20} />
                Added to Medical Journey
              </>
            ) : (
              <>
                <Calendar size={20} />
                Add to Medical Journey
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  );
}

export default ReportViewer;