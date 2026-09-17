import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, CheckCircle, Pill, Loader, History } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import PharmacyLayout from "../../layouts/PharmacyLayout";
import { getPharmacyAccessRequests, getDispenseHistory } from "../../api/pharmacy.js";
import { formatDateTime, medicineLabel } from "./pharmacyFormat.js";

function PharmacyDashboard() {
  const { currentUser } = useAuth();
  const [accesses, setAccesses] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getPharmacyAccessRequests().catch(() => []),
      getDispenseHistory().catch(() => []),
    ])
      .then(([a, h]) => {
        setAccesses(Array.isArray(a) ? a : []);
        setHistory(Array.isArray(h) ? h : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (!currentUser) return null;

  const stats = [
    {
      label: "Pending Requests",
      value: accesses.filter((r) => r.status === "pending").length,
      icon: ClipboardList,
      color: "bg-orange-100 text-orange-700",
      link: "/pharmacy/access-requests",
    },
    {
      label: "Approved Patients",
      value: accesses.filter((r) => r.status === "approved").length,
      icon: CheckCircle,
      color: "bg-green-100 text-green-700",
      link: "/pharmacy/prescriptions",
    },
    {
      label: "Prescriptions Dispensed",
      value: history.length,
      icon: Pill,
      color: "bg-emerald-100 text-emerald-700",
      link: "/pharmacy/history",
    },
  ];

  return (
    <PharmacyLayout>
      <div className="p-10">

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900">Good Day, {currentUser.name} 👋</h1>
          <p className="text-slate-500 mt-2">
            <span className="font-mono text-sm">ID: {currentUser.displayId}</span>
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader size={28} className="animate-spin text-emerald-500" /></div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-6 mb-10">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <Link key={s.label} to={s.link} className="bg-white border rounded-3xl p-6 shadow-sm hover:shadow-md transition">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${s.color}`}>
                      <Icon size={20} />
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-sm text-slate-500 mt-1">{s.label}</p>
                  </Link>
                );
              })}
            </div>

            <div className="bg-white border rounded-3xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Recently Dispensed</h2>
                <Link to="/pharmacy/history" className="text-sm text-emerald-700 font-semibold hover:underline">
                  View all
                </Link>
              </div>
              {history.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <History size={40} className="mx-auto mb-3 opacity-40" />
                  <p>Nothing dispensed yet.</p>
                  <Link to="/pharmacy/prescriptions" className="text-emerald-700 text-sm font-semibold hover:underline mt-2 inline-block">
                    Find a patient's prescriptions →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="flex items-center gap-4 p-4 border rounded-2xl">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                        <Pill size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">
                          {ev.patient_name || "Patient"}{" "}
                          <span className="font-mono text-xs text-slate-400">{ev.patient_code}</span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {(ev.items || []).map(medicineLabel).join(", ") || "—"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 shrink-0">{formatDateTime(ev.dispensed_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </PharmacyLayout>
  );
}

export default PharmacyDashboard;
