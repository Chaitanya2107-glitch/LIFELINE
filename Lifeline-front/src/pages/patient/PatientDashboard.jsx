import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import {
  FileText, ClipboardList, Activity, Pill, FlaskConical, CalendarDays,
  ClipboardCheck, Sparkles, Clipboard, ShieldAlert, ChevronRight,
  Bell, CheckCircle, AlertOctagon, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { Link } from "react-router-dom";
import LabSparkline from "../../components/patient/LabSparkline";
import { getRecords } from "../../api/records.js";
import { getAppointments } from "../../api/appointments.js";
import { getCarePlan } from "../../api/carePlan.js";
import { api } from "../../api/client.js";

function QuickCard({ icon: Icon, title, value, subtitle, color, to }) {
  return (
    <Link to={to}>
      <div className="bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={18} />
          </div>
          <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition mt-1" />
        </div>
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        <p className="text-sm font-semibold text-slate-700 mt-0.5">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </Link>
  );
}

function FeatureCard({ icon: Icon, title, description, to, color }) {
  return (
    <Link to={to}>
      <div className="bg-white rounded-2xl border p-5 hover:shadow-md transition cursor-pointer group flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition shrink-0 mt-1" />
      </div>
    </Link>
  );
}

function PatientDashboard() {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [carePlan, setCarePlan] = useState([]);
  const [pendingConsents, setPendingConsents] = useState([]);

  useEffect(() => {
    if (!currentUser?.patient_id) return;

    getRecords(currentUser.patient_id)
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch(() => setReports([]));

    getAppointments()
      .then((data) => setAppointments(Array.isArray(data) ? data : []))
      .catch(() => setAppointments([]));

    getCarePlan()
      .then((data) => setCarePlan(Array.isArray(data) ? data : []))
      .catch(() => setCarePlan([]));

    api.get("/consent/pending")
      .then((data) => setPendingConsents(Array.isArray(data) ? data.filter((c) => c.status === "pending") : []))
      .catch(() => setPendingConsents([]));
  }, [currentUser?.patient_id]);

  if (!currentUser) return null;

  const upcomingAppts = appointments.filter((a) => a.status === "upcoming");
  const pendingCare = carePlan.filter((c) => c.status !== "completed");
  const recentReports = [...reports].slice(0, 3);

  // Build lab trends map for sparklines
  const labs = {};
  reports.forEach((r) => {
    (Array.isArray(r.lab_values) ? r.lab_values : []).forEach((lv) => {
      if (!labs[lv.name]) labs[lv.name] = [];
      labs[lv.name].push(lv);
    });
  });
  Object.keys(labs).forEach((k) => labs[k].sort((a, b) => new Date(a.date) - new Date(b.date)));
  const labCount = Object.keys(labs).length;

  // Active medication count (unique names across all records)
  const medicationNames = new Set();
  reports.forEach((r) => (r.medicines || []).forEach((m) => medicationNames.add(m.name)));

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <PatientLayout>
      <div className="p-8">

        {/* Header */}
        <div className="mb-8">
          <p className="text-slate-500 text-sm">{today}</p>
          <h1 className="text-4xl font-bold text-slate-900 mt-1">
            Welcome back, {currentUser.name.split(" ")[0]} 👋
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
            <span className="font-mono text-xs">{currentUser.displayId}</span>
            {currentUser.blood_group && (
              <>
                <span className="w-1 h-1 bg-slate-400 rounded-full" />
                <span>Blood Group: <strong className="text-slate-700">{currentUser.blood_group}</strong></span>
              </>
            )}
          </div>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8">
          <ShieldAlert size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            <strong>Your records are secure.</strong>{" "}
            All reports are uploaded exclusively by verified doctors — you own the information, they contribute it.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <QuickCard
            icon={FileText} title="Medical Reports" value={reports.length}
            subtitle="Verified by doctors" color="bg-blue-100 text-blue-600" to="/patient/reports"
          />
          <QuickCard
            icon={CalendarDays} title="Upcoming Appointments" value={upcomingAppts.length}
            subtitle={upcomingAppts[0]?.date ? `Next: ${upcomingAppts[0].date}` : "None scheduled"}
            color="bg-purple-100 text-purple-600" to="/patient/appointments"
          />
          <QuickCard
            icon={ClipboardCheck} title="Care Plan Items" value={pendingCare.length}
            subtitle="Active & pending" color="bg-orange-100 text-orange-600" to="/patient/care-plan"
          />
          <QuickCard
            icon={Bell} title="Access Requests" value={pendingConsents.length}
            subtitle={pendingConsents.length > 0 ? "Needs your review" : "All resolved"}
            color={pendingConsents.length > 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}
            to="/patient/access-requests"
          />
        </div>

        {/* Lab Trends Widget */}
        {labCount > 0 && (
          <section className="bg-white border rounded-2xl p-6 shadow-sm mb-8">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FlaskConical size={17} className="text-cyan-600" /> Lab Progress
              </h2>
              <Link to="/patient/labs" className="text-blue-600 text-xs font-semibold hover:underline">
                View All Biomarkers →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const allMarkers = Object.keys(labs);
                const abnormal = allMarkers.filter((m) => labs[m][labs[m].length - 1]?.normal === false);
                const normal = allMarkers.filter((m) => labs[m][labs[m].length - 1]?.normal !== false);
                const toShow = [...abnormal, ...normal].slice(0, 3);
                return toShow.map((name) => {
                  const values = labs[name];
                  const latest = values[values.length - 1];
                  const isNormal = latest.normal !== false;
                  const len = values.length;
                  const prev = len >= 2 ? parseFloat(values[len - 2].value) : null;
                  const curr = parseFloat(latest.value);
                  const TrendIcon = prev === null ? Minus : curr > prev ? TrendingUp : curr < prev ? TrendingDown : Minus;
                  const trendColor = prev === null ? "text-slate-400" : curr > prev ? "text-red-500" : curr < prev ? "text-green-500" : "text-slate-400";
                  return (
                    <Link key={name} to="/patient/labs">
                      <div className="border rounded-xl p-4 hover:bg-slate-50 transition cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-700 truncate">{name}</span>
                          <TrendIcon size={13} className={trendColor} />
                        </div>
                        <div className="flex items-end justify-between mb-2">
                          <span className={`text-xl font-bold ${isNormal ? "text-green-700" : "text-red-600"}`}>
                            {latest.value}
                            <span className="text-xs font-normal text-slate-400 ml-1">{latest.unit}</span>
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${isNormal ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {isNormal ? "Normal" : "Attention"}
                          </span>
                        </div>
                        <LabSparkline values={values} normal={isNormal} width={140} height={40} />
                      </div>
                    </Link>
                  );
                });
              })()}
            </div>
          </section>
        )}

        <div className="grid xl:grid-cols-3 gap-6 mb-8">

          {/* Recent Reports */}
          <section className="xl:col-span-2 bg-white border rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText size={17} className="text-blue-600" /> Recent Reports
              </h2>
              <Link to="/patient/reports" className="text-blue-600 text-xs font-semibold hover:underline">
                View All →
              </Link>
            </div>
            {recentReports.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No reports yet. Your doctor will upload them after consultation.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReports.map((r) => (
                  <Link key={r.id} to="/patient/reports">
                    <div className="flex items-center gap-4 p-4 border rounded-xl hover:bg-slate-50 transition">
                      <div className="bg-blue-100 p-2.5 rounded-xl shrink-0">
                        <FileText size={15} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{(r.file_name || "").replace(/_/g, " ")}</p>
                        <p className="text-xs text-slate-500">{r.report_type} · {r.uploader_name}</p>
                      </div>
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0">
                        {r.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Pending Access Requests */}
          <section className="bg-white border rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList size={17} className="text-orange-600" /> Access Requests
              </h2>
              <Link to="/patient/access-requests" className="text-blue-600 text-xs font-semibold hover:underline">
                Manage →
              </Link>
            </div>
            {pendingConsents.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <CheckCircle size={32} className="mx-auto mb-2 opacity-30 text-green-400" />
                <p className="text-sm">No pending requests.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingConsents.map((req) => (
                  <div key={req.id} className="p-4 border border-orange-200 bg-orange-50 rounded-xl">
                    <p className="font-semibold text-slate-800 text-sm">{req.doctor_name || "Doctor"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Requesting access to your records</p>
                    <Link
                      to="/patient/access-requests"
                      className="inline-block mt-2 text-xs font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition"
                    >
                      Review →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Health features grid */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Your Health on Lifeline</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Sparkles} title="Vitalis AI Assistant"
              description="Ask questions about your reports, medications, and health history in plain language."
              color="bg-blue-100 text-blue-600" to="/patient/vitalis"
            />
            <FeatureCard
              icon={Activity} title="Health Journey"
              description="Your chronological medical history from verified reports."
              color="bg-indigo-100 text-indigo-600" to="/patient/journey"
            />
            <FeatureCard
              icon={FlaskConical} title="Lab Trends"
              description={`${labCount} biomarker${labCount !== 1 ? "s" : ""} tracked over time from your reports.`}
              color="bg-cyan-100 text-cyan-600" to="/patient/labs"
            />
            <FeatureCard
              icon={Pill} title="Medications"
              description={medicationNames.size > 0 ? `${medicationNames.size} medication(s) extracted from your reports.` : "Track medications from verified prescriptions."}
              color="bg-green-100 text-green-600" to="/patient/medications"
            />
            <FeatureCard
              icon={ClipboardCheck} title="Care Plan"
              description={`${pendingCare.length} active item${pendingCare.length !== 1 ? "s" : ""} — follow-ups, screenings, and health goals.`}
              color="bg-purple-100 text-purple-600" to="/patient/care-plan"
            />
            <FeatureCard
              icon={Clipboard} title="Visit Brief"
              description="Prepare for your next appointment — diagnoses, medications, follow-ups at a glance."
              color="bg-slate-100 text-slate-600" to="/patient/visit-brief"
            />
            <FeatureCard
              icon={CalendarDays} title="Appointments"
              description={`${upcomingAppts.length} upcoming appointment${upcomingAppts.length !== 1 ? "s" : ""}.`}
              color="bg-rose-100 text-rose-600" to="/patient/appointments"
            />
            <FeatureCard
              icon={FileText} title="All Reports"
              description={`${reports.length} verified report${reports.length !== 1 ? "s" : ""} from your doctors — view originals.`}
              color="bg-teal-100 text-teal-600" to="/patient/reports"
            />
            <FeatureCard
              icon={Bell} title="Notifications"
              description="Stay updated on new reports, access requests, and reminders."
              color="bg-amber-100 text-amber-600" to="/patient/notifications"
            />
            <FeatureCard
              icon={AlertOctagon} title="Emergency Profile & Family Group"
              description="Your critical health info, allergies, conditions, and emergency contacts — ready when it matters."
              color="bg-red-100 text-red-600" to="/patient/emergency"
            />
          </div>
        </div>

      </div>
    </PatientLayout>
  );
}

export default PatientDashboard;
