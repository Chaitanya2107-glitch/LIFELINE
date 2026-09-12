import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Upload,
  FileText,
  ClipboardList,
  Bell,
  Activity,
  UserCircle,
  LogOut,
  Heart,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function DoctorSidebar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: "Dashboard",        path: "/doctor/dashboard",        icon: LayoutDashboard },
    { name: "Patient Search",   path: "/doctor/patients",         icon: Users },
    { name: "Upload Report",    path: "/doctor/upload",           icon: Upload },
    { name: "Access Requests",  path: "/doctor/access-requests",  icon: ClipboardList },
    { name: "Medical Records",  path: "/doctor/records",          icon: FileText },
    { name: "Appointments",     path: "/doctor/appointments",     icon: CalendarDays },
    { name: "Notifications",    path: "/doctor/notifications",    icon: Bell },
    { name: "Audit Log",        path: "/doctor/audit",            icon: Activity },
    { name: "Profile",          path: "/doctor/profile",          icon: UserCircle },
  ];

  const handleLogout = () => {
    logout("manual");
    navigate("/doctor/login");
  };

  return (
    <aside className="w-72 min-h-screen bg-white border-r border-slate-200 p-6 flex flex-col shrink-0">

      {/* Logo */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Heart size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none tracking-tight">LIFELINE</h1>
            <p className="text-xs text-slate-400 mt-0.5">Caring for Life</p>
          </div>
        </div>
      </div>

      {/* Doctor info chip */}
      {currentUser && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-8">
          <p className="font-semibold text-slate-800 text-sm">{currentUser.name}</p>
          <p className="text-xs text-blue-600 font-mono mt-0.5">{currentUser.displayId}</p>
          {currentUser.specialization && (
            <p className="text-xs text-slate-500 mt-0.5">{currentUser.specialization}</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium transition text-sm ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon size={18} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-6 flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition"
      >
        <LogOut size={18} />
        Logout
      </button>

    </aside>
  );
}

export default DoctorSidebar;
