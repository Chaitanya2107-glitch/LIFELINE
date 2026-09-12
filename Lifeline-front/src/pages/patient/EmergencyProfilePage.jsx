import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import {
  AlertOctagon, Phone, Pill, Heart, AlertTriangle, ShieldCheck,
  User, Users, CalendarDays, Droplets, ClipboardList, Stethoscope,
  Loader2, Clock, Pencil, Check, X,
} from "lucide-react";
import { getPatientProfile, updatePatientProfile } from "../../api/patientAuth.js";
import { getRecords } from "../../api/records.js";

// ── Main Page ─────────────────────────────────────────────────────────────────
function EmergencyProfilePage() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [allergies, setAllergies] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Emergency Contacts edit state ──────────────────────────────────────────
  const [editingContacts, setEditingContacts] = useState(false);
  const [contactsDraft, setContactsDraft] = useState([]);
  const [contactsError, setContactsError] = useState("");
  const [savingContacts, setSavingContacts] = useState(false);

  // ── Medical Conditions edit state ──────────────────────────────────────────
  const [editingConditions, setEditingConditions] = useState(false);
  const [conditionsDraft, setConditionsDraft] = useState([]);
  const [conditionsError, setConditionsError] = useState("");
  const [savingConditions, setSavingConditions] = useState(false);

  useEffect(() => {
    Promise.all([
      getPatientProfile(),
      currentUser?.patient_id ? getRecords(currentUser.patient_id) : Promise.resolve([]),
    ])
      .then(([profileData, records]) => {
        setProfile(profileData);
        // Extract unique allergies from all records
        const allergySet = new Set();
        (Array.isArray(records) ? records : []).forEach((r) => {
          (r.allergies || []).forEach((a) => allergySet.add(a));
        });
        setAllergies([...allergySet]);
      })
      .catch(() => {/* stay on empty state */})
      .finally(() => setLoading(false));
  }, [currentUser?.patient_id]);

  // ── Contacts handlers ───────────────────────────────────────────────────────
  const startEditContacts = () => {
    setContactsDraft((profile.emergency_contacts || []).map((c) => ({ ...c })));
    setContactsError("");
    setEditingContacts(true);
  };

  const cancelEditContacts = () => {
    setEditingContacts(false);
    setContactsError("");
  };

  const updateContactField = (index, field, value) => {
    setContactsDraft((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const addContact = () => {
    setContactsDraft((prev) => [...prev, { name: "", relation: "", phone: "" }]);
  };

  const removeContact = (index) => {
    setContactsDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const saveContacts = async () => {
    // Filter rows that are entirely blank
    const toSave = contactsDraft.filter(
      (c) => c.name.trim() || c.relation.trim() || c.phone.trim()
    );
    // Validate: non-blank rows must have name and phone
    for (const c of toSave) {
      if (!c.name.trim() || !c.phone.trim()) {
        setContactsError("Each contact must have a name and phone number.");
        return;
      }
    }
    setSavingContacts(true);
    setContactsError("");
    try {
      const updated = await updatePatientProfile({ emergency_contacts: toSave });
      setProfile(updated);
      setEditingContacts(false);
    } catch (err) {
      setContactsError(err.message || "Save failed. Please try again.");
    } finally {
      setSavingContacts(false);
    }
  };

  // ── Conditions handlers ─────────────────────────────────────────────────────
  const startEditConditions = () => {
    setConditionsDraft((profile.conditions || []).map((c) => c));
    setConditionsError("");
    setEditingConditions(true);
  };

  const cancelEditConditions = () => {
    setEditingConditions(false);
    setConditionsError("");
  };

  const updateCondition = (index, value) => {
    setConditionsDraft((prev) => prev.map((c, i) => i === index ? value : c));
  };

  const addCondition = () => {
    setConditionsDraft((prev) => [...prev, ""]);
  };

  const removeCondition = (index) => {
    setConditionsDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const saveConditions = async () => {
    const toSave = conditionsDraft.filter((c) => c.trim() !== "");
    setSavingConditions(true);
    setConditionsError("");
    try {
      const updated = await updatePatientProfile({ conditions: toSave });
      setProfile(updated);
      setEditingConditions(false);
    } catch (err) {
      setConditionsError(err.message || "Save failed. Please try again.");
    } finally {
      setSavingConditions(false);
    }
  };

  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading emergency profile…
        </div>
      </PatientLayout>
    );
  }

  if (!profile) return null;

  const emergencyContacts = profile.emergency_contacts || [];
  const conditions = profile.conditions || [];

  return (
    <PatientLayout>
      <div className="p-10 max-w-2xl">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <AlertOctagon size={32} className="text-red-600" />
            Emergency &amp; Family
          </h1>
          <p className="text-slate-500 mt-2">
            Critical health information for emergency responders, plus your family health centre.
          </p>
        </div>

        {/* ── Emergency card ──────────────────────────────────────── */}
        <div className="bg-red-600 text-white rounded-3xl p-8 mb-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <AlertOctagon size={24} className="text-white" />
            </div>
            <div>
              <p className="text-red-200 text-sm font-medium">Emergency Medical Profile</p>
              <h2 className="text-2xl font-bold">{profile.name}</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/15 rounded-2xl p-4">
              <p className="text-red-200 text-xs font-semibold mb-1">Blood Group</p>
              <p className="text-3xl font-black">{profile.blood_group || "Unknown"}</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-4">
              <p className="text-red-200 text-xs font-semibold mb-1">Date of Birth</p>
              <p className="text-lg font-bold">
                {profile.date_of_birth
                  ? new Date(profile.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                  : "—"}
              </p>
              <p className="text-red-200 text-xs mt-0.5">
                {profile.date_of_birth ? `Age: ${new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Allergies — extracted from records */}
        <div className="bg-white border-2 border-red-200 rounded-2xl p-6 mb-4 shadow-sm">
          <h3 className="font-bold text-red-700 flex items-center gap-2 mb-4">
            <AlertTriangle size={18} /> Allergies
          </h3>
          {allergies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {allergies.map((a, i) => (
                <span key={i} className="bg-red-100 text-red-700 font-semibold text-sm px-4 py-2 rounded-full border border-red-200">
                  ⚠ {a}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No known allergies recorded.</p>
          )}
        </div>

        {/* ── Medical Conditions ──────────────────────────────────── */}
        <div className="bg-white border rounded-2xl p-6 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-purple-700 flex items-center gap-2">
              <Heart size={18} /> Medical Conditions
            </h3>
            {!editingConditions && (
              <button
                onClick={startEditConditions}
                className="flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-900 transition"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>

          {editingConditions ? (
            <div className="space-y-3">
              {conditionsError && (
                <p className="text-sm text-red-600">{conditionsError}</p>
              )}
              {conditionsDraft.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={c}
                    onChange={(e) => updateCondition(i, e.target.value)}
                    placeholder="e.g. Type 2 Diabetes"
                    className="flex-1 border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => removeCondition(i)}
                    className="p-2 text-slate-400 hover:text-red-500 transition"
                    aria-label="Remove condition"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={addCondition}
                className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition"
              >
                + Add condition
              </button>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={saveConditions}
                  disabled={savingConditions}
                  className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-60"
                >
                  {savingConditions ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save
                </button>
                <button
                  onClick={cancelEditConditions}
                  className="flex items-center gap-2 bg-slate-100 text-slate-700 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            conditions.length > 0 ? (
              <div className="space-y-2">
                {conditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-700">{c}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No conditions recorded.</p>
            )
          )}
        </div>

        {/* ── Emergency Contacts ──────────────────────────────────── */}
        <div className="bg-white border rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-blue-700 flex items-center gap-2">
              <Phone size={18} /> Emergency Contacts
            </h3>
            {!editingContacts && (
              <button
                onClick={startEditContacts}
                className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 transition"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>

          {editingContacts ? (
            <div className="space-y-4">
              {contactsError && (
                <p className="text-sm text-red-600">{contactsError}</p>
              )}
              {contactsDraft.map((c, i) => (
                <div key={i} className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => updateContactField(i, "name", e.target.value)}
                      placeholder="Name *"
                      className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={c.relation}
                      onChange={(e) => updateContactField(i, "relation", e.target.value)}
                      placeholder="Relation"
                      className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="tel"
                      value={c.phone}
                      onChange={(e) => updateContactField(i, "phone", e.target.value)}
                      placeholder="Phone *"
                      className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => removeContact(i)}
                    className="p-2 text-slate-400 hover:text-red-500 transition mt-0.5"
                    aria-label="Remove contact"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={addContact}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition"
              >
                + Add contact
              </button>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={saveContacts}
                  disabled={savingContacts}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {savingContacts ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save
                </button>
                <button
                  onClick={cancelEditContacts}
                  className="flex items-center gap-2 bg-slate-100 text-slate-700 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-200 transition"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            emergencyContacts.length > 0 ? (
              <div className="space-y-3">
                {emergencyContacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <User size={18} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.relation}</p>
                    </div>
                    <a
                      href={`tel:${c.phone}`}
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                    >
                      <Phone size={13} />
                      {c.phone}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No emergency contacts recorded.</p>
            )
          )}
        </div>

        {/* ── Family Centre — Coming soon ───────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users size={18} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Family Health Centre</h2>
              <p className="text-sm text-slate-500">Monitor your family members' health profiles in one place.</p>
            </div>
          </div>

          <div className="bg-white border border-purple-200 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Clock size={22} className="text-purple-500" />
            </div>
            <p className="font-semibold text-slate-700 text-sm">Coming soon</p>
            <p className="text-xs text-slate-400 mt-1">
              Family member profiles will be available in a future update.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <ShieldCheck size={18} className="text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500">
            This profile is compiled from your verified medical reports and account information.
            Keep your doctor informed of any changes to your medications, allergies, or conditions.
          </p>
        </div>

      </div>
    </PatientLayout>
  );
}

export default EmergencyProfilePage;
