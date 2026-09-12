import PatientSidebar from "../components/patient/PatientSidebar";

export default function PatientLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <PatientSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
