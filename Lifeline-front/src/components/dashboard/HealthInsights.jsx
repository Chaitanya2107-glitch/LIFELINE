function HealthInsights() {
  return (
    <section className="bg-blue-50 border border-blue-100 rounded-3xl shadow-sm p-8">

      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            🩺 Health Insights
          </h2>

          <p className="text-slate-500 mt-1">
            Personalized insights based on your medical history.
          </p>
        </div>

        <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold">
          AI Assisted
        </span>
      </div>

      <div className="space-y-6">

        {/* Health Summary */}
        <div className="border-l-4 border-green-500 pl-5">
          <h3 className="font-semibold text-lg text-slate-800">
            Health Summary
          </h3>

          <p className="text-slate-600 mt-2">
            Upload your medical records to receive an easy-to-understand summary
            highlighting important findings and trends.
          </p>
        </div>

        {/* Follow-up */}
        <div className="border-l-4 border-orange-500 pl-5">
          <h3 className="font-semibold text-lg text-slate-800">
            Follow-up Care
          </h3>

          <p className="text-slate-600 mt-2">
            Lifeline will remind you of recommended follow-up investigations
            based on your medical history and previous reports.
          </p>
        </div>

        {/* Preventive Care */}
        <div className="border-l-4 border-blue-500 pl-5">
          <h3 className="font-semibold text-lg text-slate-800">
            Preventive Care
          </h3>

          <p className="text-slate-600 mt-2">
            Receive age-appropriate screening and wellness recommendations
            designed to help you stay proactive about your health.
          </p>
        </div>

        {/* Family History */}
        <div className="border-l-4 border-purple-500 pl-5">
          <h3 className="font-semibold text-lg text-slate-800">
            Family Health Insights
          </h3>

          <p className="text-slate-600 mt-2">
            When enabled, Family Hub will help identify inherited health
            patterns and encourage discussions with your healthcare provider.
          </p>
        </div>

      </div>

      <div className="mt-8 rounded-2xl bg-slate-100 p-5">
        <p className="text-sm text-slate-600">
          <strong>Important:</strong> Lifeline is designed to support patients
          and healthcare professionals by organizing medical information and
          providing educational insights. It does not diagnose illnesses,
          prescribe treatment, or replace professional medical advice.
        </p>
      </div>

    </section>
  );
}

export default HealthInsights;
