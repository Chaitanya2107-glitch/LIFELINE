// Shared display helpers for the pharmacy portal pages.

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Medicines may be structured objects ({ name, dosage, frequency, duration })
// or plain strings on older records.
export function medicineLabel(med) {
  if (!med) return "";
  if (typeof med === "string") return med;
  return med.name || "Unnamed medicine";
}

export function medicineDetails(med) {
  if (!med || typeof med === "string") return "";
  return [med.dosage, med.frequency, med.duration].filter(Boolean).join(" · ");
}
