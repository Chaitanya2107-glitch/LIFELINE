import { FileText, Eye, Sparkles } from "lucide-react";

function RecentReports() {
  const reports = [
    {
      name: "Complete Blood Count.pdf",
      date: "12 Jul 2026",
      type: "Blood Test",
      status: "AI Summary Ready",
    },
    {
      name: "MRI Lumbar Spine.pdf",
      date: "02 Mar 2026",
      type: "Radiology",
      status: "AI Summary Ready",
    },
    {
      name: "Prescription.pdf",
      date: "Today",
      type: "Prescription",
      status: "New Upload",
    },
  ];

  return (
    <section className="bg-orange-50 border border-orange-100 rounded-3xl shadow-sm p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            📄 Recent Reports
          </h2>

          <p className="text-slate-500">
            Your latest uploaded medical documents.
          </p>
        </div>

        <button className="text-blue-600 font-semibold hover:underline">
          View All
        </button>
      </div>

      <div className="space-y-5">
        {reports.map((report, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl p-5 border hover:shadow-md transition"
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-4 items-center">
                <div className="bg-orange-100 p-3 rounded-xl">
                  <FileText className="text-orange-600" />
                </div>

                <div>
                  <h3 className="font-semibold">
                    {report.name}
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    {report.type} • {report.date}
                  </p>
                </div>
              </div>

              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                {report.status}
              </span>
            </div>

            <div className="flex gap-3 mt-5">
              <button className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl hover:bg-slate-200 transition">
                <Eye size={18} />
                View
              </button>

              <button className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-200 transition">
                <Sparkles size={18} />
                AI Summary
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default RecentReports;