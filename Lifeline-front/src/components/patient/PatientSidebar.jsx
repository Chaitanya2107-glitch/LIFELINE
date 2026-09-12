import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, ClipboardList, Bell,
  LogOut, Heart, Activity, Pill, FlaskConical, CalendarDays,
  ClipboardCheck, Clipboard, Sparkles, UserCircle, KeyRound,
  AlertOctagon, Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function PatientSidebar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navGroups = [
    {
      label: "Overview",
      items: [
        { name: "Dashboard", path: "/patient/dashboard", icon: LayoutDashboard },
        { name: "Visit Brief", path: "/patient/visit-brief", icon: Clipboard },
        { name: "Vitalis AI", path: "/patient/vitalis", icon: Sparkles },
      ],
    },
    {
      label: "Health Records",
      items: [
        { name: "My Reports", path: "/patient/reports", icon: FileText },
        { name: "Health Journey", path: "/patient/journey", icon: Activity },
        { name: "Lab Trends", path: "/patient/labs", icon: FlaskConical },
        { name: "Medications", path: "/patient/medications", icon: Pill },
      ],
    },
    {
      label: "Planning & Care",
      items: [
        { name: "Care Plan", path: "/patient/care-plan", icon: ClipboardCheck },
        { name: "Appointments", path: "/patient/appointments", icon: CalendarDays },
      ],
    },
    {
      label: "Safety & Family",
      items: [
        { name: "Emergency Profile", path: "/patient/emergency", icon: AlertOctagon },
      ],
    },
    {
      label: "Account",
      items: [
        { name: "Access Requests", path: "/patient/access-requests", icon: ClipboardList },
        { name: "Notifications", path: "/patient/notifications", icon: Bell },
        { name: "My OTP", path: "/patient/otp", icon: KeyRound },
        { name: "Profile", path: "/patient/profile", icon: UserCircle },
      ],
    },
  ];

  const handleLogout = () => {
    logout("manual");
    navigate("/patient/login");
  };

  return (
    <aside className="w-72 min-h-screen bg-white border-r border-slate-200 flex flex-col shrink-0">

      {/* Logo */}
      <div className="p-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Heart size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none tracking-tight">LIFELINE</h1>
            <p className="text-xs text-slate-400 mt-0.5">Caring for Life</p>
          </div>
        </div>
      </div>

      {/* Patient chip */}
      {currentUser && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-2">
          <p className="font-semibold text-slate-800 text-sm leading-snug">{currentUser.name}</p>
          <p className="text-xs text-blue-600 font-mono mt-0.5">{currentUser.displayId}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-medium transition text-sm ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100"
                      }`
                    }
                  >
                    <Icon size={16} />
                    {item.name}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Security note */}
      <div className="mx-4 mb-3 bg-slate-50 border border-slate-100 rounded-xl p-3">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-blue-600">Secure.</span>{" "}
          Reports are uploaded only by verified doctors.
        </p>
      </div>

      {/* Logout */}
      <div className="px-3 pb-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

    </aside>
  );
}

export default PatientSidebar;
