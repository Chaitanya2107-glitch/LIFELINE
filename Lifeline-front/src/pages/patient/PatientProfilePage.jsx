import { useState, useEffect } from "react";
import PatientLayout from "../../layouts/PatientLayout";
import { User, ShieldCheck, Loader2, Pencil, Check, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getPatientProfile, updatePatientProfile } from "../../api/patientAuth.js";

function PatientProfilePage() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ email: "", phone: "", blood_group: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    getPatientProfile()
      .then((data) => {
        setProfile(data);
        setForm({ email: data.email || "", phone: data.phone || "", blood_group: data.blood_group || "" });
      })
      .catch(() => {/* stay empty */})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const updated = await updatePatientProfile({
        email: form.email || undefined,
        phone: form.phone || undefined,
        blood_group: form.blood_group || undefined,
      });
      setProfile(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err.message || "Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading profile…
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Profile</h1>
          <p className="text-slate-500 mt-2">Your account details in Lifeline.</p>
        </div>

        <div className="bg-white border rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <User size={36} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{profile?.name || currentUser?.name}</h2>
              <p className="text-green-600 font-mono text-sm mt-0.5">{profile?.patient_code || currentUser?.displayId}</p>
              <span className="inline-block mt-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
                PATIENT
              </span>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4 border-t pt-6">
              {saveError && (
                <p className="text-sm text-red-600">{saveError}</p>
              )}
              {[
                { label: "Email", field: "email", type: "email" },
                { label: "Phone", field: "phone", type: "tel" },
                { label: "Blood Group", field: "blood_group", type: "text", placeholder: "e.g. A+" },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[field]}
                    onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); setSaveError(""); }}
                  className="flex items-center gap-2 bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 border-t pt-6">
              {[
                { label: "Patient Code", value: profile?.patient_code, mono: true },
                { label: "Full Name", value: profile?.name },
                { label: "Email", value: profile?.email },
                { label: "Phone", value: profile?.phone },
                { label: "Blood Group", value: profile?.blood_group },
                { label: "Date of Birth", value: profile?.date_of_birth },
                { label: "Role", value: "Patient" },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b last:border-0">
                  <span className="text-sm text-slate-500">{row.label}</span>
                  <span className={`text-sm font-semibold text-slate-800 ${row.mono ? "font-mono" : ""}`}>
                    {row.value || "—"}
                  </span>
                </div>
              ))}
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 text-sm font-semibold text-green-700 hover:text-green-900 mt-2 transition"
              >
                <Pencil size={14} /> Edit Profile
              </button>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <ShieldCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              As a patient, you can view your verified medical reports, manage doctor access requests,
              and control who can see your medical history. You cannot upload official medical reports.
            </p>
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}

export default PatientProfilePage;
