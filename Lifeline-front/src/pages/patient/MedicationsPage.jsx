import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import { Pill, Calendar, RefreshCw, FileText, AlertCircle, Clock, Loader2 } from "lucide-react";
import { getRecords } from "../../api/records.js";

function daysUntilRefill(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function RefillBadge({ dateStr }) {
  const days = daysUntilRefill(dateStr);
  if (days === null) return null;
  if (days < 0) return (
    <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
      <AlertCircle size={11} /> Overdue
    </span>
  );
  if (days <= 7) return (
    <span className="flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-semibold px-2.5 py-1 rounded-full">
      <Clock size={11} /> Refill in {days}d
    </span>
  );
  if (days <= 30) return (
    <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-semibold px-2.5 py-1 rounded-full">
      <RefreshCw size={11} /> Refill in {days}d
    </span>
  );
  return (
    <span className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
      <RefreshCw size={11} /> Refill {new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
    </span>
  );
}

function MedicationsPage() {
  const { currentUser } = useAuth();
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.patient_id) return;
    getRecords(currentUser.patient_id)
      .then((records) => {
        // Extract medicines from every record, attach source file name
        const meds = [];
        (Array.isArray(records) ? records : []).forEach((r) => {
          (r.medicines || []).forEach((m) => {
            meds.push({ ...m, sourceReport: r.file_name, reportId: r.id, reportDate: r.dates?.[0] || r.created_at });
          });
        });
        setMedications(meds);
      })
      .catch(() => setMedications([]))
      .finally(() => setLoading(false));
  }, [currentUser?.patient_id]);

  // Deduplicate by name (keep latest entry)
  const seen = new Set();
  const unique = medications.filter((m) => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });

  // Backend does not include refillDate — treat all as active if duration is not a past date
  const active = unique.filter((m) => !m.refillDate || daysUntilRefill(m.refillDate) >= 0);
  const past = unique.filter((m) => m.refillDate && daysUntilRefill(m.refillDate) < 0);

  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading medications…
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-10 max-w-4xl">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <Pill size={32} className="text-green-600" /> Medications
          </h1>
          <p className="text-slate-500 mt-2">
            Medications extracted from verified reports uploaded by your doctors.
          </p>
        </div>

        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 text-sm text-amber-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          Always follow your doctor's instructions. Medication information here is extracted from official reports for reference only.
          Never adjust dosages without consulting your physician.
        </div>

        {medications.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <Pill size={48} className="mx-auto mb-4 opacity-30" />
            <p>No medication information extracted yet. Ask your doctor to upload your prescription.</p>
          </div>
        ) : (
          <>
            {/* Active / Ongoing */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full" /> Active Medications
                <span className="text-sm font-normal text-slate-500">({active.length})</span>
              </h2>
              {active.length === 0 ? (
                <p className="text-slate-400 text-sm">No active medications.</p>
              ) : (
                <div className="space-y-4">
                  {active.map((m, i) => (
                    <div key={i} className="bg-white border rounded-2xl p-6 shadow-sm">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{m.name}</h3>
                          <p className="text-sm text-slate-500 mt-0.5">{m.dosage} · {m.frequency}</p>
                        </div>
                        <RefillBadge dateStr={m.refillDate} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t text-xs text-slate-500">
                        <div><p className="font-semibold text-slate-600 mb-0.5">Dosage</p><p>{m.dosage}</p></div>
                        <div><p className="font-semibold text-slate-600 mb-0.5">Frequency</p><p>{m.frequency}</p></div>
                        <div><p className="font-semibold text-slate-600 mb-0.5">Duration</p><p>{m.duration || "—"}</p></div>
                        <div>
                          <p className="font-semibold text-slate-600 mb-0.5">Source</p>
                          <p className="flex items-center gap-1 truncate"><FileText size={11} />{m.sourceReport?.replace(/_/g, " ").replace(/\.\w+$/, "")}</p>
                        </div>
                      </div>
                      {m.refillDate && (
                        <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
                          <Calendar size={11} /> Refill date: {new Date(m.refillDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past */}
            {past.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-slate-400 rounded-full" /> Past / Completed
                  <span className="text-sm font-normal text-slate-500">({past.length})</span>
                </h2>
                <div className="space-y-3">
                  {past.map((m, i) => (
                    <div key={i} className="bg-white border rounded-2xl p-5 flex items-center gap-4 opacity-60">
                      <Pill size={18} className="text-slate-400 shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-700">{m.name} — {m.dosage}</p>
                        <p className="text-xs text-slate-500">{m.frequency} · {m.duration}</p>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">{m.reportDate?.slice(0, 10)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PatientLayout>
  );
}

export default MedicationsPage;
