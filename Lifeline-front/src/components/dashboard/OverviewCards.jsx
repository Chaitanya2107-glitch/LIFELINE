function OverviewCards() {
  const cards = [
    {
      title: "Medical Records",
      value: "28",
      subtitle: "Stored Records",
      color: "bg-blue-100 text-blue-700",
    },
    {
      title: "Appointments",
      value: "2",
      subtitle: "Upcoming",
      color: "bg-green-100 text-green-700",
    },
    {
      title: "Medications",
      value: "5",
      subtitle: "Active",
      color: "bg-purple-100 text-purple-700",
    },
    {
      title: "Pending Tests",
      value: "1",
      subtitle: "Scheduled",
      color: "bg-orange-100 text-orange-700",
    },
  ];

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">
        Today's Overview
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition"
          >
            <div
              className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${card.color}`}
            >
              {card.title}
            </div>

            <h3 className="text-4xl font-bold mt-5">
              {card.value}
            </h3>

            <p className="text-slate-500 mt-2">
              {card.subtitle}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default OverviewCards;