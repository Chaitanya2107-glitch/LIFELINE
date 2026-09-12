import Sidebar from "../components/dashboard/Sidebar";
import Topbar from "../components/dashboard/Topbar";
import OverviewCards from "../components/dashboard/OverviewCards";
import HealthInsights from "../components/dashboard/HealthInsights";
import CarePlan from "../components/dashboard/CarePlan";
import MedicalJourney from "../components/dashboard/MedicalJourney";
import RecentReports from "../components/dashboard/RecentReports";

function Dashboard() {
  return (
    <div className="flex min-h-screen bg-slate-100">

      <Sidebar />

      <main className="flex-1 p-10 overflow-y-auto">

        <Topbar />

        <OverviewCards />

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <HealthInsights />
          <CarePlan />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <MedicalJourney />
          <RecentReports />
        </div>

      </main>

    </div>
  );
}

export default Dashboard;

