// Shared helpers for the patient and doctor appointment pages.

export const APPOINTMENT_TYPES = [
  "Consultation",
  "Follow-up",
  "Routine Check-up",
  "Test / Report Review",
  "Other",
];

// Preferred-time options a patient can choose; the doctor sets the exact time.
export const PREFERRED_TIMES = [
  "Morning (9 AM – 12 PM)",
  "Afternoon (12 PM – 4 PM)",
  "Evening (4 PM – 8 PM)",
  "Any time",
];

export const TYPE_COLOR = {
  "Consultation":         "bg-orange-100 text-orange-700",
  "Follow-up":            "bg-blue-100 text-blue-700",
  "Routine Check-up":     "bg-green-100 text-green-700",
  "Test / Report Review": "bg-purple-100 text-purple-700",
};

export const STATUS_LABEL = {
  pending:   "Awaiting doctor",
  upcoming:  "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected:  "Declined",
};

export const STATUS_COLOR = {
  pending:   "bg-amber-100 text-amber-700",
  upcoming:  "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-600",
  rejected:  "bg-red-100 text-red-700",
};

export function todayIso() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
}

export function formatTime(timeStr) {
  // Exact times arrive as "HH:MM"; preferred slots are free text.
  if (!/^\d{2}:\d{2}/.test(timeStr || "")) return timeStr || "—";
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function isDatePast(dateStr) {
  return Boolean(dateStr) && dateStr < todayIso();
}

export function daysFromNow(dateStr) {
  const diff = Math.round((new Date(dateStr + "T00:00:00") - new Date(todayIso() + "T00:00:00")) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  return `In ${diff} days`;
}

// Split a list into the three sections both pages show.
export function groupAppointments(all) {
  const pending = all
    .filter((a) => a.status === "pending")
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const upcoming = all
    .filter((a) => a.status === "upcoming" && !isDatePast(a.date))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const past = all
    .filter((a) => a.status !== "pending" && !(a.status === "upcoming" && !isDatePast(a.date)))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { pending, upcoming, past };
}
