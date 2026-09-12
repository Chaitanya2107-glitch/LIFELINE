import PatientLayout from "../../layouts/PatientLayout";
import { BookOpen, ShieldCheck, Smartphone, HelpCircle, Lock, ClipboardList } from "lucide-react";

const sections = [
  {
    icon: BookOpen,
    color: "text-blue-600 bg-blue-100",
    title: "How to Log In",
    content: [
      "Go to the Patient Portal at /patient/login.",
      "Enter your unique Patient ID (format: PT-XXXXXX). This was provided by your doctor or the hospital.",
      "Enter your password.",
      "Click 'Sign In to Patient Portal'.",
      "If your credentials are correct, you will be taken to your Patient Dashboard.",
    ],
  },
  {
    icon: Smartphone,
    color: "text-green-600 bg-green-100",
    title: "How OTP Verification Works",
    content: [
      "When you try to view a medical report, the system asks you to verify your identity using a One-Time Password (OTP).",
      "Click 'Send OTP'. An OTP is generated and sent to your registered phone number or email.",
      "Enter the 6-digit OTP within 12 minutes.",
      "If correct, you can view the report. The OTP becomes invalid immediately after use.",
      "You have a maximum of 3 attempts per OTP. If you exceed this, you'll need to request a new one.",
      "In this demo/prototype, the OTP is shown on screen since it's not connected to a real SMS/email service.",
    ],
  },
  {
    icon: ShieldCheck,
    color: "text-purple-600 bg-purple-100",
    title: "How to View Your Reports",
    content: [
      "From your dashboard or the 'My Reports' page, you can see all reports uploaded by your doctors.",
      "Reports are marked as 'Verified' because they were uploaded by authenticated medical personnel.",
      "To view the contents of a report, click 'Verify & View (OTP)'. You'll be asked to complete OTP verification first.",
      "Once verified, the report summary becomes visible.",
      "This OTP step protects you — even if someone else is on your device, they cannot view your reports without your OTP.",
    ],
  },
  {
    icon: Lock,
    color: "text-orange-600 bg-orange-100",
    title: "Why Can't Patients Upload Official Reports?",
    content: [
      "This is an important security feature, not a limitation.",
      "If patients could upload documents, anyone could submit a fake or modified medical report — for example, to claim a false diagnosis.",
      "In Lifeline, official medical reports can only be uploaded by verified doctors or authorized hospital staff.",
      "The system records the Doctor's unique ID and timestamp on every upload, creating a tamper-evident record.",
      "You can still see all your reports — they simply enter the system through the correct medical channel.",
    ],
  },
  {
    icon: ClipboardList,
    color: "text-red-600 bg-red-100",
    title: "How Doctor Access Requests Work",
    content: [
      "Doctors cannot automatically see your full medical history.",
      "If a doctor wants to view your previous reports (uploaded by other doctors), they must send you an Access Request.",
      "You will see the request in 'Access Requests' and can Approve or Deny it.",
      "If you approve, the doctor gets temporary access (7 days) to view your records.",
      "If you deny, the doctor cannot see your previous records.",
      "Every approval and denial is recorded in the system's audit log.",
    ],
  },
  {
    icon: HelpCircle,
    color: "text-slate-600 bg-slate-100",
    title: "What to Do If Something Goes Wrong",
    content: [
      "OTP expired: Click 'Resend OTP' on the verification screen to generate a new one.",
      "Forgot password: Contact your hospital or clinic to reset your Lifeline account.",
      "Unauthorized access: If you suspect someone else is accessing your account, contact your healthcare provider immediately.",
      "Session expired: If the system logs you out automatically after inactivity, simply log in again. This is a security feature, not an error.",
      "Report missing: If you expect a report that is not showing, ask your doctor to confirm they uploaded it to your correct Patient ID.",
    ],
  },
  {
    icon: ShieldCheck,
    color: "text-teal-600 bg-teal-100",
    title: "Privacy and Security Tips",
    content: [
      "Never share your Patient ID or password with anyone, including people claiming to be hospital staff.",
      "Always log out of the portal when using a shared or public computer.",
      "The system will automatically log you out after 15 minutes of inactivity.",
      "Your OTP should never be shared. Legitimate hospital staff will never ask for your OTP.",
      "If you notice unfamiliar reports in your account, report it to your healthcare provider.",
    ],
  },
];

function PatientGuidePage() {
  return (
    <PatientLayout>
      <div className="p-10 max-w-4xl">

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900">Patient Guide</h1>
          <p className="text-slate-500 mt-2 text-lg">
            Everything you need to know about using Lifeline safely and confidently.
          </p>
          <p className="text-slate-400 text-sm mt-1">
            This guide is also suitable for parents and caregivers managing a family member's health records.
          </p>
        </div>

        <div className="space-y-6">
          {sections.map((section, i) => {
            const Icon = section.icon;
            return (
              <div key={i} className="bg-white border rounded-3xl p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${section.color}`}>
                    <Icon size={22} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">{section.title}</h2>
                </div>
                <ul className="space-y-3">
                  {section.content.map((item, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <span className="text-blue-600 font-bold mt-0.5 shrink-0">→</span>
                      <span className="text-slate-700 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-700">
          <strong>Important:</strong> Lifeline is a prototype system for educational demonstration purposes.
          It does not provide real medical advice. Always consult a qualified healthcare professional
          for medical decisions.
        </div>

      </div>
    </PatientLayout>
  );
}

export default PatientGuidePage;
