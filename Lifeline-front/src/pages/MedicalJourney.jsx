
import Sidebar from "../components/dashboard/Sidebar";
import Topbar from "../components/dashboard/Topbar";
import { useReport } from "../context/ReportContext";
import {
  Calendar,
  FileText,
  Sparkles,
  Activity,
} from "lucide-react";

function MedicalJourney() {
  const { journey } = useReport();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-10">
        <Topbar />

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900">
            Medical Journey
          </h1>

          <p className="text-slate-500 mt-2">
            Keep track of your medical history and important health events.
          </p>
        </div>

        {/* Empty State */}
        {journey.length === 0 && (
          <div className="bg-white rounded-3xl shadow-sm border p-12 text-center">
            <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Activity
                size={38}
                className="text-blue-600"
              />
            </div>

            <h2 className="text-2xl font-bold text-slate-800">
              Your Medical Journey Starts Here
            </h2>

            <p className="text-slate-500 mt-3 max-w-lg mx-auto">
              Reports that you add to your Medical Journey will appear here
              in chronological order.
            </p>
          </div>
        )}

        {/* Timeline */}
        {journey.length > 0 && (
          <div className="relative">

            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-1 bg-blue-100 rounded-full" />

            <div className="space-y-8">
              {journey.map((report) => (
                <div
                  key={report.id}
                  className="relative flex gap-6"
                >
                  {/* Timeline Icon */}
                  <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-md">
                    <FileText
                      size={22}
                      className="text-white"
                    />
                  </div>

                  {/* Report Card */}
                  <div className="flex-1 bg-white rounded-3xl border shadow-sm p-6">

                    <div className="flex justify-between items-start gap-4">

                      <div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                          <Calendar size={16} />
                          {report.date}
                        </div>

                        <h2 className="text-xl font-bold text-slate-900">
                          {report.name}
                        </h2>

                        <p className="text-slate-500 mt-1">
                          {report.category}
                        </p>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                        AI Summary Ready
                      </span>
                    </div>

                    {/* Summary */}
                    {report.summary &&
                      report.summary.length > 0 && (
                        <div className="mt-5 bg-blue-50 rounded-2xl p-4">

                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles
                              size={18}
                              className="text-blue-600"
                            />

                            <h3 className="font-semibold text-blue-700">
                              AI Summary
                            </h3>
                          </div>

                          <div className="space-y-2">
                            {report.summary.map(
                              (item, index) => (
                                <p
                                  key={index}
                                  className="text-slate-700"
                                >
                                  {item}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default MedicalJourney;

