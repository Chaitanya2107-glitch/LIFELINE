/**
 * DoctorAppointmentsPage
 *
 * Patients request appointments; doctors confirm them here.
 *   - New requests: confirm with the final date / time / location, or decline
 *   - Upcoming: mark completed, reschedule / edit, or cancel
 *   - Past & closed: read-only history
 *
 * API functions used:
 *   getAppointments()                 GET    /appointments
 *   approveAppointment(id, schedule)  PATCH  /appointments/{id}  status='upcoming'
 *   rejectAppointment(id, reason)     PATCH  /appointments/{id}  status='rejected'
 *   completeAppointment(id)           PATCH  /appointments/{id}  status='completed'
 *   updateAppointment(id, data)       PATCH  /appointments/{id}
 *   cancelAppointment(id)             DELETE /appointments/{id}
 */

import { useState, useEffect } from "react";
import DoctorLayout from "../../layouts/DoctorLayout";
import {
  CalendarDays, Clock, MapPin, FileText, CheckCircle, X, Loader,
  AlertTriangle, User, Inbox, MessageSquare, Check,
} from "lucide-react";
import {
  getAppointments,
  approveAppointment,
  rejectAppointment,
  completeAppointment,
  updateAppointment,
  cancelAppointment,
} from "../../api/appointments.js";
import {
  TYPE_COLOR, STATUS_LABEL, STATUS_COLOR,
  todayIso, formatDate, formatTime, daysFromNow, isDatePast, groupAppointments,
} from "../../components/appointments/appointmentHelpers.js";

const inputClass =
  "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

// Remember the last location typed, purely as a convenience for the next confirmation.
const LOCATION_KEY = "lifeline_last_appt_location";
function loadLastLocation() {
  try { return localStorage.getItem(LOCATION_KEY) || ""; } catch { return ""; }
}
function saveLastLocation(value) {
  try { localStorage.setItem(LOCATION_KEY, value); } catch { /* ignore */ }
}

// ── Schedule form (confirm / reschedule) ───────────────────────────────────────

function ScheduleForm({ appt, submitLabel, onSubmit, onClose }) {
  const [form, setForm] = useState({
    date:     isDatePast(appt.date) ? todayIso() : appt.date,
    time:     /^\d{2}:\d{2}/.test(appt.time) ? appt.time.slice(0, 5) : "",
    location: appt.location || loadLastLocation(),
    notes:    appt.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.date || !form.time || !form.location.trim()) {
      setError("Date, time and location are required.");
      return;
    }
    setSaving(true);
    setError("");
    saveLastLocation(form.location.trim());
    onSubmit({
      date: form.date,
      time: form.time,
      location: form.location.trim(),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    })
      .then(onClose)
      .catch((err) => setError(err.message || "Could not save."))
      .finally(() => setSaving(false));
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Date *</label>
          <input type="date" value={form.date} min={todayIso()} onChange={set("date")} className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Time *</label>
          <input type="time" value={form.time} onChange={set("time")} className={inputClass} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Location *</label>
          <input type="text" value={form.location} onChange={set("location")} placeholder="Room 204, City Hospital" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 block mb-1">Note for the patient</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={set("notes")}
          placeholder="e.g. Please bring your previous reports, come fasting…"
          className={`${inputClass} resize-none`}
        />
      </div>
      {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition disabled:opacity-50"
        >
          {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />}
          {submitLabel}
        </button>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-100 transition">
          Close
        </button>
      </div>
    </form>
  );
}

// ── Decline form ───────────────────────────────────────────────────────────────

function DeclineForm({ onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    onSubmit(reason.trim())
      .then(onClose)
      .catch((err) => setError(err.message || "Could not decline."))
      .finally(() => setSaving(false));
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t space-y-3">
      <label className="text-xs font-semibold text-slate-500 block">Reason (shown to the patient)</label>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Please consult a cardiologist for this concern."
        className={`${inputClass} resize-none`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="text-xs font-semibold bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
        >
          {saving ? "Declining…" : "Decline Request"}
        </button>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-100 transition">
          Close
        </button>
      </div>
    </form>
  );
}

// ── Appointment card ───────────────────────────────────────────────────────────

function AppointmentCard({ appt, onUpdate }) {
  const [mode, setMode] = useState(null); // "confirm" | "decline" | "edit" | null
  const [busy, setBusy] = useState(false);

  const isPending  = appt.status === "pending";
  const isUpcoming = appt.status === "upcoming";
  const datePassed = isDatePast(appt.date);
  const days = isUpcoming && !datePassed ? daysFromNow(appt.date) : null;

  const run = (promise) => {
    setBusy(true);
    return promise
      .then(onUpdate)
      .catch((err) => alert(err.message || "Something went wrong."))
      .finally(() => setBusy(false));
  };

  const handleComplete = () => run(completeAppointment(appt.id));
  const handleCancel = () => {
    if (!window.confirm("Cancel this appointment? The patient will see it as cancelled.")) return;
    run(cancelAppointment(appt.id));
  };

  return (
    <div className={`bg-white border rounded-2xl shadow-sm p-5 ${isPending ? "border-amber-200" : ""} ${
      !isPending && !isUpcoming ? "opacity-70" : ""
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPending ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"}`}>
            <User size={18} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{appt.patient_name || "Patient"}</p>
            <p className="text-xs font-mono text-slate-500">{appt.patient_code || appt.patient_id}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 shrink-0">
          {days && (
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              days === "Today" ? "bg-green-600 text-white" : days === "Tomorrow" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
            }`}>{days}</span>
          )}
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[appt.status] || "bg-slate-100 text-slate-600"}`}>
            {isPending ? "New request" : isUpcoming && datePassed ? "Date passed" : STATUS_LABEL[appt.status] || appt.status}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${TYPE_COLOR[appt.type] || "bg-slate-100 text-slate-600"}`}>
            {appt.type}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600 mt-3">
        <span className="flex items-center gap-1.5">
          <CalendarDays size={13} className="text-slate-400" />
          {isPending ? "Preferred: " : ""}{formatDate(appt.date)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={13} className="text-slate-400" />
          {formatTime(appt.time)}
        </span>
        {appt.location && !isPending && (
          <span className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" />{appt.location}</span>
        )}
      </div>

      {appt.reason && (
        <p className="flex items-start gap-1.5 text-sm text-slate-600 mt-2">
          <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" /> Reason: {appt.reason}
        </p>
      )}
      {appt.notes && !mode && (
        <p className="flex items-start gap-1.5 text-sm text-slate-500 mt-1">
          <MessageSquare size={13} className="text-slate-400 shrink-0 mt-0.5" />
          {appt.status === "rejected" ? "Declined: " : "Note: "}{appt.notes}
        </p>
      )}

      {/* Actions */}
      {!mode && (isPending || isUpcoming) && (
        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
          {isPending && (
            <>
              <button onClick={() => setMode("confirm")} className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition">
                <Check size={13} /> Confirm &amp; Schedule
              </button>
              <button onClick={() => setMode("decline")} className="flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition">
                <X size={13} /> Decline
              </button>
            </>
          )}
          {isUpcoming && (
            <>
              <button onClick={handleComplete} disabled={busy} className="flex items-center gap-1.5 text-xs font-semibold bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition disabled:opacity-50">
                <CheckCircle size={13} /> Mark Completed
              </button>
              <button onClick={() => setMode("edit")} className="text-xs font-semibold text-blue-600 px-3 py-2 rounded-xl hover:bg-blue-50 transition">
                Reschedule / Edit
              </button>
              <button onClick={handleCancel} disabled={busy} className="flex items-center gap-1 text-xs font-semibold text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition disabled:opacity-50">
                <X size={12} /> Cancel
              </button>
            </>
          )}
        </div>
      )}

      {mode === "confirm" && (
        <ScheduleForm
          appt={appt}
          submitLabel="Confirm Appointment"
          onSubmit={(schedule) => approveAppointment(appt.id, schedule).then(onUpdate)}
          onClose={() => setMode(null)}
        />
      )}
      {mode === "edit" && (
        <ScheduleForm
          appt={appt}
          submitLabel="Save Changes"
          onSubmit={(schedule) => updateAppointment(appt.id, schedule).then(onUpdate)}
          onClose={() => setMode(null)}
        />
      )}
      {mode === "decline" && (
        <DeclineForm
          onSubmit={(reason) => rejectAppointment(appt.id, reason).then(onUpdate)}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function Section({ icon: Icon, color, title, items, onUpdate, empty }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Icon size={20} className={color} /> {title}
        {items.length > 0 && <span className="text-sm font-semibold text-slate-400">({items.length})</span>}
      </h2>
      {items.length === 0 ? (
        empty && <p className="text-sm text-slate-400 bg-white border rounded-2xl p-5">{empty}</p>
      ) : (
        <div className="space-y-4">
          {items.map((a) => <AppointmentCard key={a.id} appt={a} onUpdate={onUpdate} />)}
        </div>
      )}
    </div>
  );
}

function DoctorAppointmentsPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppointments()
      .then((data) => setAll(Array.isArray(data) ? data : []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, []);

  // Keep joined display fields (patient name) when the API returns a bare row.
  const handleUpdate = (updated) =>
    setAll((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));

  const { pending, upcoming, past } = groupAppointments(all);

  if (loading) {
    return (
      <DoctorLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader size={32} className="animate-spin mr-3" /> Loading appointments…
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="p-10">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <CalendarDays size={32} className="text-blue-600" />
            Appointments
          </h1>
          <p className="text-slate-500 mt-2">
            Patients request appointments — confirm them with a date, time and place, or decline.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className={`rounded-2xl p-5 border ${pending.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white shadow-sm"}`}>
            <p className={`text-sm font-medium ${pending.length > 0 ? "text-amber-700" : "text-slate-500"}`}>New Requests</p>
            <p className={`text-4xl font-bold mt-1 ${pending.length > 0 ? "text-amber-800" : "text-slate-800"}`}>{pending.length}</p>
          </div>
          <div className="bg-blue-600 text-white rounded-2xl p-5">
            <p className="text-blue-200 text-sm font-medium">Upcoming</p>
            <p className="text-4xl font-bold mt-1">{upcoming.length}</p>
          </div>
          <div className="bg-white border rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-sm font-medium">Past &amp; Closed</p>
            <p className="text-4xl font-bold text-slate-800 mt-1">{past.length}</p>
          </div>
        </div>

        <div className="space-y-10">
          <Section icon={Inbox} color="text-amber-500" title="Appointment Requests" items={pending} onUpdate={handleUpdate}
            empty="No new requests. Patients can request appointments from their portal." />
          <Section icon={CalendarDays} color="text-blue-600" title="Upcoming Appointments" items={upcoming} onUpdate={handleUpdate}
            empty="No confirmed appointments coming up." />
          {past.length > 0 && (
            <Section icon={CheckCircle} color="text-green-600" title="Past & Closed" items={past} onUpdate={handleUpdate} />
          )}
        </div>

      </div>
    </DoctorLayout>
  );
}

export default DoctorAppointmentsPage;
