import PatientLayout from "../../layouts/PatientLayout";
import { BookOpen, ShieldCheck, HelpCircle, Lock, ClipboardList, CalendarDays } from "lucide-react";

const sections = [
  {
    icon: BookOpen,
    color: "text-blue-600 bg-blue-100",
    title: "How to Log In",
    content: [
      "Go to the Patient Portal at /patient/login.",
      "Enter your unique Lifeline Code (format: LFL-XXXXXX). This was provided by your doctor or the hospital.",
      "Enter your password.",
      "Click 'Sign In to Patient Portal'.",
      "If your credentials are correct, you will be taken to your Patient Dashboard.",
    ],
  },
  {
    icon: ShieldCheck,
    color: "text-purple-600 bg-purple-100",
    title: "How to View Your Reports",
    content: [
      "From your dashboard or the 'My Reports' page, you can see all reports uploaded by your doctors.",
      "Reports are marked as 'Verified' because they were uploaded by authenticated medical personnel.",
      "Click 'View Report' to open and read the full details of any report.",
    ],
  },
  {
    icon: CalendarDays,
    color: "text-green-600 bg-green-100",
    title: "How Appointment Approval Works",
    content: [
      "When a doctor schedules an appointment for you, it appears in your Appointments page with a 'Pending' status.",
      "You can Approve the appointment (it becomes 'Upcoming') or Decline it.",
      "The appointment is only confirmed once you approve it — the doctor cannot confirm it on your behalf.",
      "You can also cancel any upcoming appointment from the same page.",
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
      "Forgot password: Contact your hospital or clinic to reset your Lifeline account.",
      "Unauthorized access: If you suspect someone else is accessing your account, contact your healthcare provider immediately.",
      "Session expired: If the system logs you out automatically after inactivity, simply log in again. This is a security feature, not an error.",
      "Report missing: If you expect a report that is not showing, ask your doctor to confirm they uploaded it to your correct Lifeline code.",
    ],
  },
  {
    icon: ShieldCheck,
    color: "text-teal-600 bg-teal-100",
    title: "Privacy and Security Tips",
    content: [
      "Never share your Lifeline code or password with anyone, including people claiming to be hospital staff.",
      "Always log out of the portal when using a shared or public computer.",
      "The system will automatically log you out after 15 minutes of inactivity.",
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
