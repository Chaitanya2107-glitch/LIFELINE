import PharmacySidebar from "../components/pharmacy/PharmacySidebar";

export default function PharmacyLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <PharmacySidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
