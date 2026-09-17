import { useState, useEffect } from "react";
import PatientLayout from "../../layouts/PatientLayout";
import {
  CalendarDays, Stethoscope, MapPin, Clock, CheckCircle, Calendar,
  FileText, Loader2, X, Plus, Hourglass, AlertTriangle, MessageSquare,
} from "lucide-react";
import {
  getAppointments,
  getBookableDoctors,
  requestAppointment,
  cancelAppointment,
} from "../../api/appointments.js";
import {
  APPOINTMENT_TYPES, PREFERRED_TIMES, TYPE_COLOR, STATUS_LABEL, STATUS_COLOR,
  todayIso, formatDate, formatTime, daysFromNow, isDatePast, groupAppointments,
} from "../../components/appointments/appointmentHelpers.js";

const inputClass =
  "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

function doctorLabel(appt) {
  return appt.doctor_name ? `Dr. ${appt.doctor_name.replace(/^Dr\.?\s*/i, "")}` : `Doctor #${appt.doctor_id}`;
}

// ── Request form ───────────────────────────────────────────────────────────────

function RequestForm({ onCreated, onClose }) {
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    doctorId: "", type: APPOINTMENT_TYPES[0], date: "", time: PREFERRED_TIMES[0], reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getBookableDoctors()
      .then((data) => setDoctors(Array.isArray(data) ? data : []))
      .catch(() => setError("Could not load the list of doctors."))
      .finally(() => setLoadingDoctors(false));
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const q = search.trim().toLowerCase();
  const filtered = doctors.filter((d) =>
    !q || d.name.toLowerCase().includes(q) || (d.specialization || "").toLowerCase().includes(q)
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!form.doctorId) { setError("Please choose a doctor."); return; }
    if (!form.date)     { setError("Please choose a preferred date."); return; }

    setSaving(true);
    const doctor = doctors.find((d) => String(d.id) === form.doctorId);
    requestAppointment({
      doctor_id: Number(form.doctorId),
      date:      form.date,
      time:      form.time,
      type:      form.type,
      reason:    form.reason.trim() || null,
    })
      .then((created) => {
        onCreated({ ...created, doctor_name: doctor?.name, doctor_specialization: doctor?.specialization });
        onClose();
      })
      .catch((err) => setError(err.message || "Could not send your request."))
      .finally(() => setSaving(false));
  };

  return (
    <div className="bg-white border rounded-3xl shadow-sm p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Plus size={20} className="text-blue-600" /> Request an Appointment
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X size={20} /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Doctor *</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or specialization…"
            className={`${inputClass} mb-2`}
          />
          <select value={form.doctorId} onChange={set("doctorId")} className={inputClass} disabled={loadingDoctors}>
            <option value="">{loadingDoctors ? "Loading doctors…" : `Select a doctor (${filtered.length})`}</option>
            {filtered.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.specialization ? ` — ${d.specialization}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Visit type</label>
            <select value={form.type} onChange={set("type")} className={inputClass}>
              {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Preferred date *</label>
            <input type="date" value={form.date} onChange={set("date")} min={todayIso()} className={inputClass} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1">Preferred time</label>
            <select value={form.time} onChange={set("time")} className={inputClass}>
              {PREFERRED_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-1">Reason for visit</label>
          <textarea
            rows={3}
            value={form.reason}
            onChange={set("reason")}
            maxLength={500}
            placeholder="Briefly describe your symptoms or why you'd like to see the doctor…"
            className={`${inputClass} resize-none`}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
          Your doctor will confirm the exact date, time and place — you'll see it here once confirmed.
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 text-sm"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {saving ? "Sending…" : "Send Request"}
          </button>
          <button type="button" onClick={onClose} className="text-sm text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Appointment card ───────────────────────────────────────────────────────────

function Detail({ icon: Icon, children, wide }) {
  return (
    <div className={`flex items-start gap-2 text-slate-600 ${wide ? "sm:col-span-2" : ""}`}>
      <Icon size={14} className="text-slate-400 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function AppointmentCard({ appt, onUpdate }) {
  const [cancelling, setCancelling] = useState(false);
  const isPending = appt.status === "pending";
  const isConfirmed = appt.status === "upcoming" && !isDatePast(appt.date);
  const canCancel = isPending || isConfirmed;
  const faded = !isPending && !isConfirmed;
  const days = isConfirmed ? daysFromNow(appt.date) : null;

  const handleCancel = () => {
    if (!window.confirm(isPending ? "Withdraw this appointment request?" : "Cancel this appointment?")) return;
    setCancelling(true);
    cancelAppointment(appt.id)
      .then((updated) => onUpdate(updated))
      .catch((err) => alert(err.message || "Could not cancel. Please try again."))
      .finally(() => setCancelling(false));
  };

  return (
    <div className={`border rounded-3xl p-6 shadow-sm transition ${
      isPending ? "bg-amber-50 border-amber-200" : "bg-white hover:shadow-md"
    } ${faded ? "opacity-75" : ""}`}>
      <div className="flex items-start gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
          isPending ? "bg-amber-100" : faded ? "bg-slate-100" : "bg-blue-100"
        }`}>
          <Stethoscope size={24} className={isPending ? "text-amber-600" : faded ? "text-slate-400" : "text-blue-600"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">{doctorLabel(appt)}</h3>
              {appt.doctor_specialization && <p className="text-sm text-slate-500">{appt.doctor_specialization}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              {days && (
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  days === "Today" ? "bg-green-600 text-white" :
                  days === "Tomorrow" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                }`}>{days}</span>
              )}
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLOR[appt.status] || "bg-slate-100 text-slate-600"}`}>
                {appt.status === "upcoming" && !isConfirmed ? "Date passed" : STATUS_LABEL[appt.status] || appt.status}
              </span>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${TYPE_COLOR[appt.type] || "bg-slate-100 text-slate-600"}`}>
                {appt.type}
              </span>
            </div>
          </div>

          <div className={`grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t text-sm ${isPending ? "border-amber-200" : ""}`}>
            {isPending ? (
              <>
                <Detail icon={Calendar}>Preferred: {formatDate(appt.date)}</Detail>
                <Detail icon={Clock}>{appt.time}</Detail>
              </>
            ) : (
              <>
                <Detail icon={Calendar}>{formatDate(appt.date)}</Detail>
                <Detail icon={Clock}>{formatTime(appt.time)}</Detail>
                {appt.location && <Detail icon={MapPin} wide>{appt.location}</Detail>}
              </>
            )}
            {appt.reason && <Detail icon={FileText} wide>Your reason: {appt.reason}</Detail>}
            {appt.notes && (
              <Detail icon={MessageSquare} wide>
                {appt.status === "rejected" ? "Doctor's reason: " : "Doctor's note: "}{appt.notes}
              </Detail>
            )}
          </div>

          {isPending && (
            <p className="mt-3 text-xs text-amber-700 flex items-center gap-1.5">
              <Hourglass size={12} /> Waiting for the doctor to confirm a date, time and place.
            </p>
          )}

          {canCancel && (
            <div className={`mt-4 pt-3 border-t ${isPending ? "border-amber-200" : ""}`}>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50 transition"
              >
                <X size={13} />
                {cancelling ? "Cancelling…" : isPending ? "Withdraw Request" : "Cancel Appointment"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function Section({ icon: Icon, color, title, items, onUpdate }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Icon size={20} className={color} /> {title}
      </h2>
      <div className="space-y-4">
        {items.map((a) => <AppointmentCard key={a.id} appt={a} onUpdate={onUpdate} />)}
      </div>
    </div>
  );
}

function AppointmentsPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    getAppointments()
      .then((data) => setAll(Array.isArray(data) ? data : []))
      .catch(() => setAll([]))
      .finally(() => setLoading(false));
  }, []);

  // Keep joined display fields (doctor name) when the API returns a bare row.
  const handleUpdate = (updated) =>
    setAll((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));

  const handleCreated = (created) => setAll((prev) => [created, ...prev]);

  const { pending, upcoming, past } = groupAppointments(all);

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

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
              <CalendarDays size={32} className="text-blue-600" />
              Appointments
            </h1>
            <p className="text-slate-500 mt-2">Request an appointment and track it until your doctor confirms.</p>
          </div>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition text-sm shrink-0"
          >
            <Plus size={16} />
            {showForm ? "Hide Form" : "Request Appointment"}
          </button>
        </div>

        {showForm && <RequestForm onCreated={handleCreated} onClose={() => setShowForm(false)} />}

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className={`rounded-2xl p-5 border ${pending.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200 shadow-sm"}`}>
            <p className={`text-sm font-medium ${pending.length > 0 ? "text-amber-700" : "text-slate-500"}`}>Awaiting Doctor</p>
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

        {all.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <CalendarDays size={48} className="mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">No appointments yet</h2>
            <p>Use <strong>Request Appointment</strong> to ask a doctor for a visit.</p>
          </div>
        ) : (
          <div className="space-y-10">
            <Section icon={Hourglass} color="text-amber-600" title="Awaiting Doctor Confirmation" items={pending} onUpdate={handleUpdate} />
            <Section icon={CalendarDays} color="text-blue-600" title="Upcoming Appointments" items={upcoming} onUpdate={handleUpdate} />
            <Section icon={CheckCircle} color="text-green-600" title="Past & Closed" items={past} onUpdate={handleUpdate} />
          </div>
        )}

      </div>
    </PatientLayout>
  );
}

export default AppointmentsPage;
