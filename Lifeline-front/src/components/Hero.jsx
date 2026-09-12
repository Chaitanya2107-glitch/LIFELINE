function Hero() {
  return (
    <section className="bg-slate-100 pt-24 pb-16 px-8">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">

        {/* Left Side */}
        <div>
          <h2 className="text-6xl font-bold text-slate-900 leading-tight mb-6">
            Your Medical
            <span className="text-blue-600"> History</span>,
            <br />
            Unified.
          </h2>

          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            Store, organize and understand all your healthcare records using AI.
            Access reports, prescriptions, appointments and medical summaries
            from one secure platform.
          </p>

          <div className="flex gap-4">
            <button className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition">
              Get Started
            </button>

            <button className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-xl font-semibold hover:bg-blue-50 transition">
              Watch Demo
            </button>
          </div>
        </div>

        {/* Right Side */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">

          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-bold">
              Dashboard
            </h3>

            <span className="bg-green-100 text-green-700 px-4 py-1 rounded-full text-sm">
              Healthy
            </span>
          </div>

          <div className="space-y-5">

            <div className="bg-slate-100 rounded-xl p-5">
              <h4 className="font-semibold">
                AI Medical Summary
              </h4>

              <p className="text-slate-600 mt-2">
                No critical issues detected.
                Annual blood work appears normal.
              </p>
            </div>

            <div className="bg-slate-100 rounded-xl p-5 flex justify-between">
              <div>
                <h4 className="font-semibold">
                  Upcoming Appointment
                </h4>

                <p className="text-slate-600">
                  Aug 12 • Cardiology
                </p>
              </div>

              <span className="text-blue-600 font-bold">
                →
              </span>
            </div>

            <div className="bg-slate-100 rounded-xl p-5">
              <h4 className="font-semibold">
                Records Available
              </h4>

              <p className="text-4xl font-bold text-blue-600 mt-3">
                28
              </p>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

export default Hero;