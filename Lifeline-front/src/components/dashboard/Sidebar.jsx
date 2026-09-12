
import { NavLink } from "react-router-dom";
import {
  House,
  Clock3,
  FileText,
  Pill,
  Bell,
  Users,
  Settings,
} from "lucide-react";

function Sidebar() {
  const navigationItems = [
    {
      name: "Overview",
      path: "/dashboard",
      icon: House,
    },
    {
      name: "Medical Journey",
      path: "/medical-journey",
      icon: Clock3,
    },
    {
      name: "Reports",
      path: "/reports",
      icon: FileText,
    },
    {
      name: "Medications",
      path: "/medications",
      icon: Pill,
    },
    {
      name: "Reminders",
      path: "/reminders",
      icon: Bell,
    },
    {
      name: "Family Hub",
      path: "/family",
      icon: Users,
    },
    {
      name: "Settings",
      path: "/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-72 min-h-screen bg-white border-r border-slate-200 p-6 flex flex-col">

      {/* Logo */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-blue-600">
          Lifeline
        </h1>

        <p className="text-slate-500 text-sm">
          Your Health Companion
        </p>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              <Icon size={20} />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Card */}
      <div className="mt-auto bg-blue-50 rounded-2xl p-5">
        <h3 className="font-semibold text-blue-700">
          Your data is secure
        </h3>

        <p className="text-sm text-slate-600 mt-2">
          End-to-end encryption keeps your health records protected.
        </p>
      </div>

    </aside>
  );
}

export default Sidebar;

