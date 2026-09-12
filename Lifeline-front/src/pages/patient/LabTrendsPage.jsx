import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import { TrendingUp, TrendingDown, Minus, FlaskConical, Info, Loader2 } from "lucide-react";
import LabChart from "../../components/patient/LabChart";
import { getRecords } from "../../api/records.js";

// Reference ranges (display only — not for diagnosis)
const REFERENCE_RANGES = {
  "Haemoglobin":       { low: 13.5, high: 17.5, unit: "g/dL" },
  "WBC":               { low: 4000, high: 11000, unit: "/μL" },
  "Platelets":         { low: 150000, high: 400000, unit: "/μL" },
  "Total Cholesterol": { low: 0, high: 200, unit: "mg/dL" },
  "LDL":               { low: 0, high: 100, unit: "mg/dL" },
  "HDL":               { low: 40, high: 60, unit: "mg/dL" },
  "HbA1c":             { low: 4.0, high: 5.7, unit: "%" },
  "Fasting Glucose":   { low: 70, high: 100, unit: "mg/dL" },
  "TSH":               { low: 0.4, high: 4.0, unit: "mIU/L" },
  "Vitamin D":         { low: 30, high: 100, unit: "ng/mL" },
};

function TrendIndicator({ values }) {
  if (values.length < 2) return <Minus size={14} className="text-slate-400" />;
  const last = parseFloat(values[values.length - 1].value);
  const prev = parseFloat(values[values.length - 2].value);
  if (last > prev) return <TrendingUp size={14} className="text-red-500" />;
  if (last < prev) return <TrendingDown size={14} className="text-green-500" />;
  return <Minus size={14} className="text-slate-400" />;
}


function LabCard({ name, values }) {
  const ref = REFERENCE_RANGES[name];
  const latest = values[values.length - 1];
  const latestNum = parseFloat(latest.value);
  const isNormal = latest.normal !== undefined
    ? latest.normal
    : ref ? (latestNum >= ref.low && latestNum <= ref.high) : true;

  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            {name}
            <TrendIndicator values={values} />
          </h3>
          {ref && (
            <p className="text-xs text-slate-400 mt-0.5">
              Reference: {ref.low}–{ref.high} {ref.unit}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold ${isNormal ? "text-green-700" : "text-red-600"}`}>
            {latest.value}
            <span className="text-sm font-normal text-slate-400 ml-1">{latest.unit}</span>
          </p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isNormal ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {isNormal ? "Normal" : "Attention"}
          </span>
        </div>
      </div>

      {/* Line chart */}
      {values.length >= 2 && (
        <div className="mb-4 -mx-1">
          <LabChart
            values={values}
            refLow={ref?.low}
            refHigh={ref?.high}
            normal={isNormal}
          />
          {ref && (
            <p className="text-xs text-slate-400 mt-1 text-center">
              Shaded band = reference range ({ref.low}–{ref.high} {ref.unit})
            </p>
          )}
        </div>
      )}

      {/* Data points table */}
      <div className="space-y-1.5">
        {[...values].reverse().map((v, i) => (
          <div key={i} className="flex items-center justify-between text-xs text-slate-500">
            <span>{new Date(v.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            <span className={`font-semibold ${v.normal ? "text-green-700" : "text-red-600"}`}>
              {v.value} {v.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabTrendsPage() {
  const { currentUser } = useAuth();
  const [trends, setTrends] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.patient_id) return;
    getRecords(currentUser.patient_id)
      .then((records) => {
        // Build trend map: group lab_values by name across all records, sort by date
        const labMap = {};
        (Array.isArray(records) ? records : []).forEach((r) => {
          (Array.isArray(r.lab_values) ? r.lab_values : []).forEach((lv) => {
            if (!labMap[lv.name]) labMap[lv.name] = [];
            labMap[lv.name].push({ ...lv, reportId: r.id, reportFile: r.file_name });
          });
        });
        Object.keys(labMap).forEach((k) => {
          labMap[k].sort((a, b) => new Date(a.date) - new Date(b.date));
        });
        setTrends(labMap);
      })
      .catch(() => setTrends({}))
      .finally(() => setLoading(false));
  }, [currentUser?.patient_id]);

  const markers = Object.keys(trends);

  const [activeFilter, setActiveFilter] = useState("All");
  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading lab trends…
        </div>
      </PatientLayout>
    );
  }

  const abnormal = markers.filter((m) => {
    const vals = trends[m];
    const last = vals[vals.length - 1];
    return last.normal === false;
  });
  const normal = markers.filter((m) => {
    const vals = trends[m];
    const last = vals[vals.length - 1];
    return last.normal !== false;
  });

  const displayed =
    activeFilter === "All" ? markers :
    activeFilter === "Needs Attention" ? abnormal :
    normal;

  return (
    <PatientLayout>
      <div className="p-10 max-w-5xl">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <FlaskConical size={32} className="text-blue-600" /> Lab Trends
          </h1>
          <p className="text-slate-500 mt-2">
            Track your lab values over time — extracted from verified medical reports.
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{markers.length}</p>
            <p className="text-xs text-blue-600 mt-1">Markers Tracked</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{normal.length}</p>
            <p className="text-xs text-green-600 mt-1">Within Range</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{abnormal.length}</p>
            <p className="text-xs text-red-600 mt-1">Needs Attention</p>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8 text-sm text-blue-700">
          <Info size={16} className="shrink-0 mt-0.5" />
          Reference ranges are shown for informational context only. Always discuss your results with your doctor.
          Lifeline does not provide medical diagnoses.
        </div>

        {/* Filters */}
        {markers.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {["All", "Needs Attention", "Normal"].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition border ${
                  activeFilter === f
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {f}
                {f === "Needs Attention" && abnormal.length > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{abnormal.length}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {markers.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <FlaskConical size={48} className="mx-auto mb-4 opacity-30" />
            <p>No lab values extracted yet. Ask your doctor to upload blood test or lab reports.</p>
          </div>
        ) : displayed.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No markers in this category.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {displayed.map((name) => (
              <LabCard key={name} name={name} values={trends[name]} />
            ))}
          </div>
        )}
      </div>
    </PatientLayout>
  );
}

export default LabTrendsPage;
