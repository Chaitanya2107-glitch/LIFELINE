import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import DoctorLayout from "../../layouts/DoctorLayout";
import {
  Upload, ClipboardList, FileText, Users, Activity, CheckCircle, Loader,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getMyAccess } from "../../api/consent.js";
import { getRecords } from "../../api/records.js";

function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function DoctorDashboard() {
  const { currentUser } = useAuth();
  const [accesses, setAccesses] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyAccess();
      setAccesses(Array.isArray(data) ? data : []);
    } catch {
      setAccesses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!currentUser) return null;

  // Stats derived from real API data
  // Lowercase status comparisons per API contract
  const pendingRequests = accesses.filter((r) => r.status === "pending");
  const approvedRequests = accesses.filter((r) => r.status === "approved");
  const recentRequests = accesses.slice(0, 4);

  const stats = [
    {
      label: "Pending Requests",
      value: pendingRequests.length,
      icon: ClipboardList,
      color: "bg-orange-100 text-orange-700",
      link: "/doctor/access-requests",
    },
    {
      label: "Approved Access",
      value: approvedRequests.length,
      icon: CheckCircle,
      color: "bg-green-100 text-green-700",
      link: "/doctor/access-requests",
    },
    {
      label: "Total Requests",
      value: accesses.length,
      icon: Users,
      color: "bg-purple-100 text-purple-700",
      link: "/doctor/access-requests",
    },
  ];

  return (
    <DoctorLayout>
      <div className="p-10">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900">
            Good Day, {currentUser.name} 👋
          </h1>
          <p className="text-slate-500 mt-2">
            {currentUser.specialization && <>{currentUser.specialization} &nbsp;•&nbsp;</>}
            <span className="font-mono text-sm">ID: {currentUser.id}</span>
          </p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="flex items-center gap-3 mb-10 text-slate-400 text-sm">
            <Loader size={16} className="animate-spin" /> Loading dashboard data…
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <Link key={i} to={s.link}>
                  <div className="bg-white rounded-2xl shadow-sm border p-6 hover:shadow-md transition cursor-pointer">
                    <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${s.color} mb-4`}>
                      <Icon size={14} className="mr-1.5" />
                      {s.label}
                    </div>
                    <p className="text-4xl font-bold text-slate-900">{s.value}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">

          {/* Quick Links */}
          <section className="bg-white rounded-3xl border shadow-sm p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Upload size={18} className="text-blue-600" /> Quick Actions
                </h2>
              </div>
            </div>
            <div className="space-y-3">
              <Link to="/doctor/upload" className="flex items-center gap-3 p-4 border rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition">
                <Upload size={16} className="text-blue-600" />
                <span className="font-semibold text-slate-700 text-sm">Upload a Report</span>
              </Link>
              <Link to="/doctor/patients" className="flex items-center gap-3 p-4 border rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition">
                <Users size={16} className="text-blue-600" />
                <span className="font-semibold text-slate-700 text-sm">Search Patients</span>
              </Link>
              <Link to="/doctor/records" className="flex items-center gap-3 p-4 border rounded-2xl hover:bg-blue-50 hover:border-blue-200 transition">
                <FileText size={16} className="text-blue-600" />
                <span className="font-semibold text-slate-700 text-sm">View Medical Records</span>
              </Link>
            </div>
          </section>

          {/* Access Requests */}
          <section className="bg-white rounded-3xl border shadow-sm p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardList size={18} className="text-orange-600" /> Access Requests
                </h2>
                <p className="text-slate-500 text-sm mt-1">Your requests for patient records</p>
              </div>
              <Link to="/doctor/access-requests" className="text-blue-600 text-sm font-semibold hover:underline">
                View All
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader size={24} className="animate-spin text-blue-400" /></div>
            ) : recentRequests.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                <p>No access requests yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentRequests.map((req) => (
                  <div key={req.id || req.request_id} className="flex items-center gap-4 p-4 border rounded-2xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm font-mono">
                        {req.patient_id}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Requested: {formatDate(req.requested_at || req.created_at)}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      req.status === "pending"  ? "bg-orange-100 text-orange-700" :
                      req.status === "approved" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </DoctorLayout>
  );
}

export default DoctorDashboard;
