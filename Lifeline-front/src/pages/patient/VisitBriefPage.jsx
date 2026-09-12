import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import {
  Clipboard, AlertTriangle, Pill, Activity, ClipboardList,
  MessageSquare, CheckCircle, Stethoscope, Loader2,
} from "lucide-react";
import { getRecords } from "../../api/records.js";
import { getPatientProfile } from "../../api/patientAuth.js";

function Section({ icon: Icon, title, color, children }) {
  return (
    <div className="bg-white border rounded-2xl p-6 shadow-sm">
      <h2 className={`text-base font-bold mb-4 flex items-center gap-2 ${color}`}>
        <Icon size={18} />
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptySlate({ text }) {
  return <p className="text-sm text-slate-400 italic">{text}</p>;
}

function TagList({ items, colorClass }) {
  if (!items?.length) return <EmptySlate text="None recorded" />;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span key={i} className={`text-sm px-3 py-1.5 rounded-full font-medium ${colorClass}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function VisitBriefPage() {
  const { currentUser } = useAuth();
  const [brief, setBrief] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.patient_id) return;

    Promise.all([
      getRecords(currentUser.patient_id),
      getPatientProfile(),
    ])
      .then(([records, profileData]) => {
        setProfile(profileData);

        // Build brief from records
        const allDiagnoses = new Set();
        const allAllergies = new Set();
        const allMeds = [];
        const allFollowUps = [];
        const latestLabs = {};

        (Array.isArray(records) ? records : []).forEach((r) => {
          (r.diagnosis || []).forEach((d) => allDiagnoses.add(d));
          (r.allergies || []).forEach((a) => allAllergies.add(a));
          (r.medicines || []).forEach((m) => allMeds.push({ ...m, from: r.file_name }));
          (r.follow_ups || []).forEach((f) => allFollowUps.push({ text: f, from: r.file_name, date: r.created_at }));
          (Array.isArray(r.lab_values) ? r.lab_values : []).forEach((lv) => {
            if (!latestLabs[lv.name] || new Date(lv.date) > new Date(latestLabs[lv.name].date)) {
              latestLabs[lv.name] = lv;
            }
          });
        });

        setBrief({
          diagnoses: [...allDiagnoses],
          allergies: [...allAllergies],
          medications: allMeds,
          labHighlights: Object.values(latestLabs),
          pendingFollowUps: allFollowUps,
        });
      })
      .catch(() => {
        setBrief({ diagnoses: [], allergies: [], medications: [], labHighlights: [], pendingFollowUps: [] });
      })
      .finally(() => setLoading(false));
  }, [currentUser?.patient_id]);

  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading visit brief…
        </div>
      </PatientLayout>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Sample questions for doctor — personalized from brief
  const questionsForDoctor = [
    brief.pendingFollowUps.length > 0 && "Can you review my pending follow-ups?",
    brief.labHighlights.some((l) => !l.normal) && "Can we discuss any abnormal lab results?",
    brief.medications.length > 0 && "Are my current medications still appropriate?",
    brief.diagnoses.length > 0 && "Any updates to my conditions?",
  ].filter(Boolean);

  return (
    <PatientLayout>
      <div className="p-10 max-w-3xl">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <Clipboard size={32} className="text-blue-600" />
            Visit Brief
          </h1>
          <p className="text-slate-500 mt-2">{today}</p>
          <p className="text-slate-400 text-sm mt-1">
            A summary of your health information to help you prepare for your next appointment.
          </p>
        </div>

        {/* Patient header card */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-3xl p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-200 text-sm font-medium">Patient</p>
              <h2 className="text-2xl font-bold">{currentUser.name}</h2>
              <p className="text-blue-200 font-mono text-sm mt-0.5">{currentUser.displayId}</p>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-sm">Blood Group</p>
              <p className="text-3xl font-bold">{profile?.blood_group || currentUser.blood_group || "—"}</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">

          {/* Diagnoses / Conditions */}
          <Section icon={Stethoscope} title="Diagnoses / Active Conditions" color="text-purple-700">
            <TagList items={brief.diagnoses} colorClass="bg-purple-100 text-purple-700" />
          </Section>

          {/* Allergies */}
          <Section icon={AlertTriangle} title="Allergies" color="text-red-700">
            <TagList
              items={brief.allergies}
              colorClass="bg-red-100 text-red-700"
            />
            {brief.allergies.length > 0 && (
              <p className="text-xs text-slate-400 mt-3">
                Always inform every new healthcare provider about your allergies.
              </p>
            )}
          </Section>

          {/* Current Medications */}
          <Section icon={Pill} title="Current Medications" color="text-green-700">
            {brief.medications.length === 0 ? (
              <EmptySlate text="No medications recorded" />
            ) : (
              <div className="space-y-2.5">
                {brief.medications.map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <span className="font-semibold text-slate-800 text-sm">{m.name}</span>
                      <span className="text-slate-500 text-sm ml-2">{m.dosage}</span>
                    </div>
                    <span className="text-xs text-slate-400">{m.frequency}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Lab Highlights */}
          <Section icon={Activity} title="Recent Lab Results" color="text-blue-700">
            {brief.labHighlights.length === 0 ? (
              <EmptySlate text="No lab results recorded" />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {brief.labHighlights.map((lv, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-center ${
                    lv.normal ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"
                  }`}>
                    <p className="text-xs text-slate-500 mb-1">{lv.name}</p>
                    <p className={`font-bold text-lg ${lv.normal ? "text-green-700" : "text-orange-700"}`}>
                      {lv.value} <span className="text-xs font-normal">{lv.unit}</span>
                    </p>
                    <p className={`text-xs font-semibold ${lv.normal ? "text-green-600" : "text-orange-600"}`}>
                      {lv.normal ? "Normal" : "Review"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Pending Follow-ups */}
          <Section icon={ClipboardList} title="Pending Follow-ups" color="text-orange-700">
            {brief.pendingFollowUps.length === 0 ? (
              <EmptySlate text="No pending follow-ups" />
            ) : (
              <div className="space-y-2.5">
                {brief.pendingFollowUps.slice(0, 5).map((fu, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                    <ClipboardList size={14} className="text-orange-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">{fu.text}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Questions for doctor */}
          {questionsForDoctor.length > 0 && (
            <Section icon={MessageSquare} title="Suggested Questions for Your Doctor" color="text-slate-700">
              <div className="space-y-2">
                {questionsForDoctor.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <CheckCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">{q}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

        </div>

        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          <strong>Reminder:</strong> This brief is a summary for your reference. Your doctor will review
          your full clinical picture. Do not modify medications or make health decisions based solely on this summary.
        </div>

      </div>
    </PatientLayout>
  );
}

export default VisitBriefPage;
