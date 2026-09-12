import { useState, useEffect } from "react";
import PatientLayout from "../../layouts/PatientLayout";
import { Bell, FileText, ClipboardList, Pill, CalendarDays, ClipboardCheck, CheckCircle, AlertTriangle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import { api } from "../../api/client.js";
import { getAppointments } from "../../api/appointments.js";

const TYPE_META = {
  report:       { color: "bg-green-50 border-green-200", dot: "bg-green-500", icon: FileText, label: "New Report" },
  request:      { color: "bg-orange-50 border-orange-200", dot: "bg-orange-500", icon: ClipboardList, label: "Access Request" },
  approved:     { color: "bg-blue-50 border-blue-200", dot: "bg-blue-500", icon: CheckCircle, label: "Access Approved" },
  denied:       { color: "bg-red-50 border-red-200", dot: "bg-red-500", icon: AlertTriangle, label: "Access Denied" },
  appointment:  { color: "bg-indigo-50 border-indigo-200", dot: "bg-indigo-500", icon: CalendarDays, label: "Appointment" },
  careplan:     { color: "bg-amber-50 border-amber-200", dot: "bg-amber-500", icon: ClipboardCheck, label: "Care Plan" },
};

function PatientNotificationsPage() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.patient_id) return;

    Promise.allSettled([
      api.get(`/medical-records?patient_id=${encodeURIComponent(currentUser.patient_id)}`),
      api.get("/consent/pending"),
      getAppointments(),
    ]).then(([reportsRes, consentsRes, apptsRes]) => {
      const reports = reportsRes.status === "fulfilled" && Array.isArray(reportsRes.value) ? reportsRes.value : [];
      const consents = consentsRes.status === "fulfilled" && Array.isArray(consentsRes.value) ? consentsRes.value : [];
      const appointments = apptsRes.status === "fulfilled" && Array.isArray(apptsRes.value) ? apptsRes.value : [];

      const items = [
        // New reports
        ...reports.map((r) => ({
          id: `report-${r.id}`,
          type: "report",
          title: "New Report Available",
          body: `${r.uploader_name || "Your doctor"} uploaded "${(r.file_name || "").replace(/_/g, " ")}" to your account.`,
          time: r.created_at,
          link: "/patient/reports",
        })),

        // Pending consent requests
        ...consents.filter((c) => c.status === "pending").map((c) => ({
          id: `consent-${c.id}`,
          type: "request",
          title: "Access Request Received",
          body: `${c.doctor_name || "A doctor"} is requesting access to your previous medical records.`,
          time: c.created_at,
          link: "/patient/access-requests",
        })),

        // Upcoming appointments
        ...appointments.filter((a) => a.status === "upcoming").map((a) => ({
          id: `appt-${a.id}`,
          type: "appointment",
          title: "Upcoming Appointment",
          body: `${a.type || "Appointment"} on ${a.date} at ${a.time}${a.location ? ` — ${a.location}` : ""}.`,
          time: new Date(a.date + "T09:00:00").toISOString(),
          link: "/patient/appointments",
        })),
      ].filter((n) => n.time).sort((a, b) => new Date(b.time) - new Date(a.time));

      setNotifications(items);
    }).finally(() => setLoading(false));
  }, [currentUser?.patient_id]);

  return (
    <PatientLayout>
      <div className="p-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-2">
            All recent activity across your Lifeline account.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[20vh] text-slate-400">
            <Bell size={32} className="animate-pulse mr-3" /> Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <Bell size={48} className="mx-auto mb-4 opacity-30" />
            <p>No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.report;
              const Icon = meta.icon;
              return (
                <Link key={n.id} to={n.link || "#"}>
                  <div className={`flex items-start gap-4 border rounded-2xl p-5 hover:opacity-90 transition ${meta.color}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${meta.dot}`}>
                      <Icon size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 text-sm">{n.title}</p>
                        <p className="text-xs text-slate-500 shrink-0">
                          {new Date(n.time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5 leading-relaxed">{n.body}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PatientLayout>
  );
}

export default PatientNotificationsPage;
