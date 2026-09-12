function CarePlan() {
  const tasks = [
    {
      title: "Schedule Annual Blood Test",
      category: "Follow-up Care",
      status: "Due This Month",
      color: "bg-orange-100 text-orange-700",
    },
    {
      title: "Blood Pressure Screening",
      category: "Preventive Care",
      status: "Recommended",
      color: "bg-blue-100 text-blue-700",
    },
    {
      title: "Take Vitamin D Supplement",
      category: "Medication",
      status: "Today",
      color: "bg-purple-100 text-purple-700",
    },
    {
      title: "Cardiology Appointment",
      category: "Appointment",
      status: "12 Aug 2026",
      color: "bg-green-100 text-green-700",
    },
  ];

  return (
    <section className="bg-green-50 border border-green-100 rounded-3xl shadow-sm p-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        🩺 Care Plan
      </h2>

      <p className="text-slate-500 mb-8">
        Stay on top of your future healthcare journey.
      </p>

      <div className="space-y-5">
        {tasks.map((task, index) => (
          <div
            key={index}
            className="flex justify-between items-center bg-white border rounded-2xl p-5 hover:shadow-md transition"
          >
            <div>
              <h3 className="font-semibold text-slate-800">
                {task.title}
              </h3>

              <p className="text-slate-500 text-sm mt-1">
                {task.category}
              </p>
            </div>

            <span
              className={`px-4 py-2 rounded-full text-sm font-semibold ${task.color}`}
            >
              {task.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default CarePlan;