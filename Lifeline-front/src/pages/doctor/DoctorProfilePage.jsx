import DoctorLayout from "../../layouts/DoctorLayout";
import { useAuth } from "../../context/AuthContext";
import { Stethoscope, ShieldCheck } from "lucide-react";

function DoctorProfilePage() {
  const { currentUser } = useAuth();

  return (
    <DoctorLayout>
      <div className="p-10 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">Profile</h1>
          <p className="text-slate-500 mt-2">Your account details in the Lifeline system.</p>
        </div>

        <div className="bg-white border rounded-3xl p-8 shadow-sm">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Stethoscope size={36} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{currentUser?.name}</h2>
              <p className="text-blue-600 font-mono text-sm mt-0.5">{currentUser?.displayId}</p>
              <span className="inline-block mt-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                DOCTOR
              </span>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            {[
              { label: "Doctor ID", value: currentUser?.displayId, mono: true },
              { label: "Full Name", value: currentUser?.name },
              { label: "Role", value: "Doctor — Authorized Medical Personnel" },
              { label: "Specialization", value: currentUser?.specialization },
              { label: "Portal", value: "Doctor Portal (/doctor)" },
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b last:border-0">
                <span className="text-sm text-slate-500">{row.label}</span>
                <span className={`text-sm font-semibold text-slate-800 ${row.mono ? "font-mono" : ""}`}>
                  {row.value || "—"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-4">
            <ShieldCheck size={18} className="text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">
              As an authorized doctor, you have permission to upload official patient medical reports.
              All your uploads are permanently recorded with your Doctor ID and timestamp.
            </p>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}

export default DoctorProfilePage;
