import { Search, Bell } from "lucide-react";

function Topbar() {
  return (
    <header className="flex items-center justify-between mb-10">

      {/* Greeting */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900">
          Good Morning, User 👋
        </h1>

        <p className="text-slate-500 mt-2">
          Here's your health overview for today.
        </p>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-4">

        {/* Search */}
        <div className="relative">

          <Search
            className="absolute left-4 top-3.5 text-slate-400"
            size={18}
          />

          <input
            type="text"
            placeholder="Search..."
            className="pl-11 pr-4 py-3 rounded-xl border bg-white w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

        </div>

        {/* Notification */}
        <button className="bg-white border rounded-xl p-3 hover:bg-slate-50 transition">
          <Bell size={20} />
        </button>

        {/* Avatar */}
        <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
          U
        </div>

      </div>

    </header>
  );
}

export default Topbar;