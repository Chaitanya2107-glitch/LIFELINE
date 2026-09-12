import DoctorSidebar from "../components/doctor/DoctorSidebar";

export default function DoctorLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <DoctorSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
