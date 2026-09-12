/**
 * DoctorAppointmentsPage
 *
 * Doctors view their own appointment schedule and can:
 *   - See upcoming / pending / past / cancelled appointments
 *   - Create a new appointment for a patient (requires approved consent)
 *   - Update location / notes on an existing appointment
 *   - Cancel an appointment
 *
 * New appointments are created with status='pending'.
 * The patient must approve them from their Appointments page.
 *
 * API functions used:
 *   getAppointments()            GET  /appointments
 *   createAppointment(data)      POST /appointments
 *   updateAppointment(id, data)  PATCH /appointments/{id}
 *   cancelAppointment(id)        DELETE /appointments/{id}
 */

import { useState, useEffect, useCallback } from "react";
import DoctorLayout from "../../layouts/DoctorLayout";
import {
  CalendarDays, Clock, MapPin, FileText, CheckCircle, X, Plus,
  Loader, AlertTriangle, ChevronDown, ChevronUp, User,
} from "lucide-react";
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  cancelAppointment,
} from "../../api/appointments.js";
import { searchPatients } from "../../api/patients.js";

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  if (diff < 0)  return `${Math.abs(diff)}d ago`;
  return `In ${diff} days`;
}

const TYPE_COLOR = {
  "Follow-up":          "bg-blue-100 text-blue-700",
  "Routine Check-up":   "bg-green-100 text-green-700",
  "Consultation":       "bg-orange-100 text-orange-700",
  "Holter Monitor Review": "bg-purple-100 text-purple-700",
};
const APPOINTMENT_TYPES = [
  "Follow-up",
  "Routine Check-up",
  "Consultation",
  "Holter Monitor Review",
  "Other",
];

const STATUS_COLOR = {
  pending:   "bg-amber-100 text-amber-700",
  upcoming:  "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  rejected:  "bg-slate-100 text-slate-600",
};

// ── Appointment card (doctor view) ─────────────────────────────────────────────

function AppointmentCard({ appt, onUpdate, onCancel }) {
  const [expanded, setExpanded]   = useState(false);
  const [editing,  setEditing]    = useState(false);
  const [saving,   setSaving]     = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notes,    setNotes]      = useState(appt.notes || "");
  const [location, setLocation]   = useState(appt.location || "");

  const isCancelled = appt.status === "cancelled" || appt.status === "rejected";
  const isPast      = appt.status === "completed" || new Date(appt.date + "T00:00:00") < new Date();
  const isPending   = appt.status === "pending";
  const days        = !isPast && !isCancelled && !isPending ? daysFromNow(appt.date) : null;

  const handleSave = () => {
    setSaving(true);
    updateAppointment(appt.id, { notes: notes || null, location: location || null })
      .then((updated) => { onUpdate(updated); setEditing(false); })
      .catch((err) => alert(err.message || "Failed to save changes."))
      .finally(() => setSaving(false));
  };

  const handleCancel = () => {
    if (!window.confirm("Cancel this appointment? This cannot be undone.")) return;
    setCancelling(true);
    cancelAppointment(appt.id)
      .then((updated) => onCancel(updated))
      .catch((err) => alert(err.message || "Failed to cancel appointment."))
      .finally(() => setCancelling(false));
  };

  return (
    <div className={`bg-white border rounded-2xl shadow-sm transition ${isCancelled ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div
        className="flex items-start gap-4 p-5 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[appt.status] || "bg-slate-100 text-slate-600"}`}>
              {appt.status === "pending" ? "Pending patient approval" : appt.status}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${TYPE_COLOR[appt.type] || "bg-slate-100 text-slate-600"}`}>
              {appt.type}
            </span>
            {days && (
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                days === "Today"    ? "bg-green-600 text-white"    :
                days === "Tomorrow" ? "bg-blue-100 text-blue-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {days}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-1">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} className="text-slate-400" />
              {formatDate(appt.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-slate-400" />
              {appt.time}
            </span>
            {appt.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400" />
                {appt.location}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-1 font-mono">
            Patient: {appt.patient_id}
          </p>
        </div>
        <button className="text-slate-400 shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded detail / edit */}
      {expanded && (
        <div className="px-5 pb-5 border-t pt-4 bg-slate-50 space-y-3">
          {appt.notes && !editing && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
              {appt.notes}
            </div>
          )}

          {isPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
              Waiting for the patient to approve this appointment.
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Room 204, City Hospital"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes for the patient…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-xs font-semibold bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setNotes(appt.notes || ""); setLocation(appt.location || ""); }}
                  className="text-xs font-semibold text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-200 transition"
                >
                  Discard
                </button>
              </div>
            </div>
          ) : (
            !isCancelled && (
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                >
                  Edit location / notes
                </button>
                {!isPast && (
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition"
                  >
                    <X size={12} />
                    {cancelling ? "Cancelling…" : "Cancel appointment"}
                  </button>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Create appointment form ────────────────────────────────────────────────────

function CreateAppointmentForm({ onCreated, onClose }) {
  // Patient lookup — UUID is resolved internally, never shown to the doctor
  const [lflQuery,       setLflQuery]       = useState("");
  const [patientFound,   setPatientFound]   = useState(null);
  const [lookupLoading,  setLookupLoading]  = useState(false);
  const [lookupError,    setLookupError]    = useState("");

  const [form, setForm] = useState({
    date:     "",
    time:     "",
    type:     APPOINTMENT_TYPES[0],
    location: "",
    notes:    "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleLookup = async () => {
    const code = lflQuery.trim().toUpperCase();
    if (!code) return;
    setLookupError("");
    setPatientFound(null);
    setLookupLoading(true);
    try {
      const p = await searchPatients(code);
      setPatientFound(p);
    } catch (err) {
      setLookupError(err.message || "No patient found with this LFL code.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!patientFound?.id)  { setError("Identify the patient first using their LFL code."); return; }
    if (!form.date)         { setError("Date is required."); return; }
    if (!form.time)         { setError("Time is required."); return; }

    setSaving(true);
    createAppointment({
      patient_id: patientFound.id,
      date:       form.date,
      time:       form.time,
      type:       form.type,
      location:   form.location || null,
      notes:      form.notes    || null,
    })
      .then((created) => { onCreated(created); onClose(); })
      .catch((err) => setError(err.message || "Failed to create appointment."))
      .finally(() => setSaving(false));
  };

  return (
    <div className="bg-white border rounded-3xl shadow-sm p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Plus size={20} className="text-blue-600" /> New Appointment
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Patient LFL lookup — UUID resolved internally */}
        <div className="sm:col-span-2 space-y-2">
          <label className="text-xs font-semibold text-slate-500 block">Patient LFL Code *</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={lflQuery}
              onChange={(e) => { setLflQuery(e.target.value); setPatientFound(null); setLookupError(""); }}
              placeholder="LFL-XXXXXX"
              className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupLoading || !lflQuery.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {lookupLoading ? <Loader size={13} className="animate-spin" /> : null}
              Find
            </button>
          </div>
          {lookupError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle size={11} /> {lookupError}
            </p>
          )}
          {patientFound && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <User size={16} className="text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{patientFound.name}</p>
                <p className="text-xs font-mono text-green-600">{patientFound.patient_code}</p>
              </div>
              <CheckCircle size={15} className="text-green-600 shrink-0" />
            </div>
          )}
          <p className="text-xs text-slate-400">
            The patient must have granted you approved consent before an appointment can be created.
            The appointment will be sent to the patient for approval.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={set("date")}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Time *</label>
            <input
              type="time"
              value={form.time}
              onChange={set("time")}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Type</label>
            <select
              value={form.type}
              onChange={set("type")}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={set("location")}
              placeholder="e.g. Room 204, City Hospital"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 block mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={set("notes")}
              placeholder="Any instructions or preparation notes for the patient…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
          The appointment will be created with status <strong>Pending</strong> and sent to the patient for approval.
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !patientFound?.id}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 text-sm"
          >
            {saving ? <Loader size={15} className="animate-spin" /> : <Plus size={15} />}
            {saving ? "Creating…" : "Send for Approval"}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function DoctorAppointmentsPage() {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getAppointments()
      .then((data) => setAll(Array.isArray(data) ? data : []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = (updated) =>
    setAll((prev) => prev.map((a) => a.id === updated.id ? updated : a));

  const handleCreated = (created) => {
    setAll((prev) => [created, ...prev]);
  };

  const pending   = all.filter((a) => a.status === "pending");
  const upcoming  = all.filter((a) => a.status === "upcoming").sort((a, b) => new Date(a.date) - new Date(b.date));
  const past      = all.filter((a) => a.status === "completed" || a.status === "cancelled" || a.status === "rejected" || new Date(a.date + "T00:00:00") < new Date());

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

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
              <CalendarDays size={32} className="text-blue-600" />
              Appointments
            </h1>
            <p className="text-slate-500 mt-2">Manage your patient appointments. New appointments are sent to patients for approval.</p>
          </div>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition text-sm shrink-0"
          >
            <Plus size={16} />
            {showForm ? "Hide Form" : "New Appointment"}
          </button>
        </div>

        {showForm && (
          <CreateAppointmentForm
            onCreated={handleCreated}
            onClose={() => setShowForm(false)}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-amber-700 text-sm font-medium">Pending Approval</p>
            <p className="text-4xl font-bold text-amber-800 mt-1">{pending.length}</p>
          </div>
          <div className="bg-blue-600 text-white rounded-2xl p-5">
            <p className="text-blue-200 text-sm font-medium">Upcoming</p>
            <p className="text-4xl font-bold mt-1">{upcoming.length}</p>
          </div>
          <div className="bg-white border rounded-2xl p-5 shadow-sm">
            <p className="text-slate-500 text-sm font-medium">Past / Other</p>
            <p className="text-4xl font-bold text-slate-800 mt-1">{past.length}</p>
          </div>
        </div>

        {all.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <CalendarDays size={48} className="mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">No appointments yet</h2>
            <p>Create an appointment for a patient using the button above.</p>
          </div>
        ) : (
          <div className="space-y-10">

            {pending.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <AlertTriangle size={20} className="text-amber-500" />
                  Pending Patient Approval
                </h2>
                <div className="space-y-4">
                  {pending.map((a) => (
                    <AppointmentCard key={a.id} appt={a} onUpdate={handleUpdate} onCancel={handleUpdate} />
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
                  {upcoming.map((a) => (
                    <AppointmentCard key={a.id} appt={a} onUpdate={handleUpdate} onCancel={handleUpdate} />
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <CheckCircle size={20} className="text-green-600" />
                  Past &amp; Resolved
                </h2>
                <div className="space-y-4">
                  {past.map((a) => (
                    <AppointmentCard key={a.id} appt={a} onUpdate={handleUpdate} onCancel={handleUpdate} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </DoctorLayout>
  );
}

export default DoctorAppointmentsPage;
