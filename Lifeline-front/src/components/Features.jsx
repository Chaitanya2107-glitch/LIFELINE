import { FileText, Brain, CalendarClock } from "lucide-react";

function Features() {
  const features = [
    {
      title: "Medical Records",
      description: "Access all your health records securely in one place.",
      icon: FileText,
    },
    {
      title: "AI Summaries",
      description: "Get easy-to-understand summaries of complex reports.",
      icon: Brain,
    },
    {
      title: "Appointments",
      description: "Track upcoming consultations and medical history.",
      icon: CalendarClock,
    },
  ];

  return (
    <section className="py-14 px-8 bg-white">
      <h2 className="text-4xl font-bold text-center text-slate-800 mb-4">
        Why Choose Lifeline?
      </h2>

      <p className="text-center text-slate-600 max-w-2xl mx-auto mb-14">
        Everything you need to manage your healthcare journey in one secure,
        AI-powered platform.
      </p>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {features.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <div
              key={index}
              className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-xl bg-blue-100 flex items-center justify-center mb-6">
                <Icon size={34} className="text-blue-600" />
              </div>

              <h3 className="text-2xl font-semibold text-slate-800 mb-3">
                {feature.title}
              </h3>

              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default Features;