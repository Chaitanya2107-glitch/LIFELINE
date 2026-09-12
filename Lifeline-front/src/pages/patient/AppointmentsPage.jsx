import { useState, useEffect } from "react";
import PatientLayout from "../../layouts/PatientLayout";
import {
  CalendarDays, Stethoscope, MapPin, Clock, CheckCircle, Calendar,
  FileText, Loader2, X, ThumbsUp, ThumbsDown,
} from "lucide-react";
import {
  getAppointments,
  cancelAppointment,
  approveAppointment,
  rejectAppointment,
} from "../../api/appointments.js";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
}

function daysFromNow(dateStr) {
  const diff = Math.ceil((new Date(dateStr + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff} days`;
}

const TYPE_COLOR = {
  "Follow-up": "bg-blue-100 text-blue-700",
  "Routine Check-up": "bg-green-100 text-green-700",
  "Holter Monitor Review": "bg-purple-100 text-purple-700",
  "Consultation": "bg-orange-100 text-orange-700",
};

// ── Pending appointment card — patient sees Approve / Decline ──────────────────

function PendingCard({ appt, onUpdate }) {
  const [approving,  setApproving]  = useState(false);
  const [rejecting,  setRejecting]  = useState(false);

  const doctorLabel = appt.doctor_name || appt.doctorName
    || (appt.doctor_id ? `Doctor #${appt.doctor_id}` : "—");

  const handleApprove = () => {
    setApproving(true);
    approveAppointment(appt.id)
      .then((updated) => onUpdate && onUpdate(updated))
      .catch(() => alert("Could not approve appointment. Please try again."))
      .finally(() => setApproving(false));
  };

  const handleReject = () => {
    if (!window.confirm("Decline this appointment request?")) return;
    setRejecting(true);
    rejectAppointment(appt.id)
      .then((updated) => onUpdate && onUpdate(updated))
      .catch(() => alert("Could not decline appointment. Please try again."))
      .finally(() => setRejecting(false));
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 shadow-sm">
      <div className="flex items-start gap-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
          <Stethoscope size={24} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{doctorLabel}</h3>
              <span className="inline-block mt-1 text-xs font-semibold px-3 py-0.5 rounded-full bg-amber-200 text-amber-800">
                Pending your approval
              </span>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${TYPE_COLOR[appt.type] || "bg-slate-100 text-slate-600"}`}>
              {appt.type}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-amber-200 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              {formatDate(appt.date)}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock size={14} className="text-slate-400 shrink-0" />
              {appt.time}
            </div>
            {appt.location && (
              <div className="flex items-start gap-2 text-slate-600 sm:col-span-2">
                <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                {appt.location}
              </div>
            )}
            {appt.notes && (
              <div className="flex items-start gap-2 text-slate-600 sm:col-span-2">
                <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                {appt.notes}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200 flex gap-3">
            <button
              onClick={handleApprove}
              disabled={approving || rejecting}
              className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
            >
              <ThumbsUp size={13} />
              {approving ? "Approving…" : "Approve"}
            </button>
            <button
              onClick={handleReject}
              disabled={approving || rejecting}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition disabled:opacity-50"
            >
              <ThumbsDown size={13} />
              {rejecting ? "Declining…" : "Decline"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Regular appointment card ───────────────────────────────────────────────────

function AppointmentCard({ appt, isPast, onCancel }) {
  const [cancelling, setCancelling] = useState(false);
  const days = !isPast ? daysFromNow(appt.date) : null;
  const doctorLabel = appt.doctor_name || appt.doctorName
    || (appt.doctor_id ? `Doctor #${appt.doctor_id}` : "—");
  const location = appt.location || "—";
  const isCancelled = appt.status === "cancelled" || appt.status === "rejected";

  const handleCancel = () => {
    if (!window.confirm("Cancel this appointment?")) return;
    setCancelling(true);
    cancelAppointment(appt.id)
      .then((updated) => onCancel && onCancel(updated))
      .catch(() => alert("Could not cancel appointment. Please try again."))
      .finally(() => setCancelling(false));
  };

  return (
    <div className={`bg-white border rounded-3xl p-6 shadow-sm hover:shadow-md transition ${
      isPast || isCancelled ? "opacity-70" : ""
    }`}>
      <div className="flex items-start gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
          isPast || isCancelled ? "bg-slate-100" : "bg-blue-100"
        }`}>
          <Stethoscope size={24} className={isPast || isCancelled ? "text-slate-400" : "text-blue-600"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{doctorLabel}</h3>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {!isPast && !isCancelled && days && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  days === "Today" ? "bg-green-600 text-white" :
                  days === "Tomorrow" ? "bg-blue-100 text-blue-700" :
                  "bg-slate-100 text-slate-600"
                }`}>
                  {days}
                </span>
              )}
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${TYPE_COLOR[appt.type] || "bg-slate-100 text-slate-600"}`}>
                {appt.type}
              </span>
              {isCancelled && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700 capitalize">
                  {appt.status}
                </span>
              )}
              {isPast && !isCancelled && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                  <CheckCircle size={11} /> Completed
                </span>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              {formatDate(appt.date)}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock size={14} className="text-slate-400 shrink-0" />
              {appt.time}
            </div>
            <div className="flex items-start gap-2 text-slate-600 sm:col-span-2">
              <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
              {location}
            </div>
            {appt.notes && (
              <div className="flex items-start gap-2 text-slate-600 sm:col-span-2">
                <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                {appt.notes}
              </div>
            )}
          </div>

          {/* Cancel — only for upcoming, non-cancelled appointments */}
          {!isPast && !isCancelled && (
            <div className="mt-4 pt-3 border-t">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition"
              >
                <X size={13} />
                {cancelling ? "Cancelling…" : "Cancel Appointment"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function AppointmentsPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppointments()
      .then((data) => setAll(Array.isArray(data) ? data : []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, []);

  // Replace a single appointment in the list (after cancel / approve / reject)
  const handleApptUpdate = (updated) => {
    setAll((prev) => prev.map((a) => a.id === updated.id ? updated : a));
  };

  const pending  = all.filter((a) => a.status === "pending");
  const upcoming = all
    .filter((a) => a.status === "upcoming")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const past = all
    .filter((a) => a.status === "completed" || a.status === "cancelled" || a.status === "rejected" || new Date(a.date + "T00:00:00") < new Date())
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading appointments…
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <CalendarDays size={32} className="text-blue-600" />
            Appointments
          </h1>
          <p className="text-slate-500 mt-2">Your upcoming and past medical appointments.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className={`rounded-2xl p-5 border ${pending.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200 shadow-sm"}`}>
            <p className={`text-sm font-medium ${pending.length > 0 ? "text-amber-700" : "text-slate-500"}`}>Pending Approval</p>
            <p className={`text-4xl font-bold mt-1 ${pending.length > 0 ? "text-amber-800" : "text-slate-800"}`}>{pending.length}</p>
          </div>
          <div className="bg-blue-600 text-white rounded-2xl p-5">
            <p className="text-blue-200 text-sm font-medium">Upcoming</p>
            <p className="text-4xl font-bold mt-1">{upcoming.length}</p>
          </div>
          <div className="bg-white border rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-sm font-medium">Completed</p>
            <p className="text-4xl font-bold text-slate-800 mt-1">{past.length}</p>
          </div>
        </div>

        {all.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <CalendarDays size={48} className="mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">No appointments yet</h2>
            <p>Appointments scheduled by your doctor will appear here for your approval.</p>
          </div>
        ) : (
          <div className="space-y-10">

            {pending.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ThumbsUp size={20} className="text-amber-600" />
                  Awaiting Your Approval
                </h2>
                <div className="space-y-4">
                  {pending.map((a) => (
                    <PendingCard key={a.id} appt={a} onUpdate={handleApptUpdate} />
                  ))}
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <CalendarDays size={20} className="text-blue-600" />
                  Upcoming Appointments
                </h2>
                <div className="space-y-4">
                  {upcoming.map((a) => <AppointmentCard key={a.id} appt={a} isPast={false} onCancel={handleApptUpdate} />)}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <CheckCircle size={20} className="text-green-600" />
                  Past Appointments
                </h2>
                <div className="space-y-4">
                  {past.map((a) => <AppointmentCard key={a.id} appt={a} isPast={true} />)}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </PatientLayout>
  );
}

export default AppointmentsPage;
