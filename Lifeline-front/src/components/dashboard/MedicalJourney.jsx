import { useState } from "react";

function MedicalJourney() {
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = [
    "All",
    "Reports",
    "Diagnoses",
    "Medications",
    "Procedures",
  ];

  const timeline = [
    {
      year: "2026",
      title: "Annual Blood Test",
      type: "Reports",
      description: "Routine blood work uploaded.",
      color: "bg-blue-500",
    },
    {
      year: "2025",
      title: "Vitamin D Deficiency",
      type: "Diagnoses",
      description: "Diagnosed after annual screening.",
      color: "bg-orange-500",
    },
    {
      year: "2024",
      title: "Started Vitamin D Supplement",
      type: "Medications",
      description: "Prescribed Vitamin D3 tablets.",
      color: "bg-purple-500",
    },
    {
      year: "2023",
      title: "Annual Health Check",
      type: "Procedures",
      description: "Routine preventive examination.",
      color: "bg-green-500",
    },
  ];

  const filteredTimeline =
    activeFilter === "All"
      ? timeline
      : timeline.filter((item) => item.type === activeFilter);

  return (
    <section className="bg-purple-50 border border-purple-100 rounded-3xl shadow-sm p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            Medical Journey
          </h2>

          <p className="text-slate-500">
            Explore your healthcare history.
          </p>
        </div>

        <button className="text-blue-600 font-semibold hover:underline">
          View Full Timeline
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-3 mb-8">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              activeFilter === filter
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative border-l-2 border-slate-200 ml-4">

        {filteredTimeline.map((item, index) => (
          <div key={index} className="relative pl-8 pb-8">

            <span
              className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full ${item.color}`}
            ></span>

            <p className="text-sm text-slate-400">
              {item.year}
            </p>

            <div className="bg-slate-50 rounded-2xl p-5 mt-2 hover:shadow-md transition">

              <div className="flex justify-between items-center">

                <div>
                  <h3 className="font-semibold text-slate-800">
                    {item.title}
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    {item.description}
                  </p>
                </div>

                <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold">
                  {item.type}
                </span>

              </div>

            </div>

          </div>
        ))}

      </div>

    </section>
  );
}

export default MedicalJourney;
