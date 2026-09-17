import { useState, useEffect } from "react";
import { History, Loader, AlertCircle, Pill } from "lucide-react";
import PharmacyLayout from "../../layouts/PharmacyLayout";
import { getDispenseHistory } from "../../api/pharmacy.js";
import { formatDateTime, medicineLabel, medicineDetails } from "./pharmacyFormat.js";

function PharmacyHistoryPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getDispenseHistory()
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || "Failed to load dispense history."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PharmacyLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Dispense History</h1>
          <p className="text-slate-500 mt-2">Every prescription you have dispensed. Each entry is also recorded in the audit log.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader size={28} className="animate-spin text-emerald-500" /></div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 text-sm"><AlertCircle size={15} />{error}</div>
        ) : events.length === 0 ? (
          <div className="bg-white border rounded-3xl p-10 text-center text-slate-400">
            <History size={40} className="mx-auto mb-3 opacity-40" />
            <p>Nothing dispensed yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((ev) => (
              <div key={ev.id} className="bg-white border rounded-3xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="font-bold text-slate-900">{ev.patient_name || "Patient"}</p>
                    <p className="text-xs font-mono text-slate-500">{ev.patient_code || ev.patient_id}</p>
                  </div>
                  <p className="text-xs text-slate-400 shrink-0">{formatDateTime(ev.dispensed_at)}</p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {(ev.items || []).map((med, i) => (
                    <li key={i} className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg text-xs">
                      <Pill size={12} />
                      <span className="font-semibold">{medicineLabel(med)}</span>
                      {medicineDetails(med) && <span className="text-emerald-600">{medicineDetails(med)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

      </div>
    </PharmacyLayout>
  );
}

export default PharmacyHistoryPage;
