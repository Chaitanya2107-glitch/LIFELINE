import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Stethoscope, Eye, EyeOff, AlertCircle, Heart, CheckCircle, ShieldCheck } from "lucide-react";
import { registerDoctor } from "../../api/auth.js";

const SPECIALIZATIONS = [
  "Cardiology",
  "Dermatology",
  "General Medicine",
  "Neurology",
  "Oncology",
  "Orthopaedics",
  "Paediatrics",
  "Psychiatry",
  "Radiology",
  "Surgery",
  "Other",
];

function DoctorRegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "", email: "", phone: "", specialization: "", medRegNo: "", password: "", confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null); // { id, name }
  const [isLoading, setIsLoading] = useState(false);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const { name, email, phone, specialization, medRegNo, password, confirmPassword } = form;
    if (!name.trim() || !email.trim() || !phone.trim() || !specialization || !medRegNo.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!/^\d{10}$/.test(phone.replace(/\s/g, ""))) {
      setError("Phone number must be 10 digits.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await registerDoctor(
        name.trim(),
        email.trim(),
        phone.trim(),
        specialization,
        medRegNo.trim(),
        password,
      );
      // After registration, show the success screen with the doctor's integer ID from /auth/me
      // The backend returns the user object on register — grab the id from it.
      // Per BE-1 spec the register response includes the user object.
      // We trigger a fresh getMe() after the user logs in; for now just show the email as identifier.
      setSuccess({ id: email.trim(), name: name.trim() });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2 mb-5">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-md">
              <Heart size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-none tracking-tight">LIFELINE</h1>
              <p className="text-xs text-slate-500 leading-none mt-0.5">Caring for Life</p>
            </div>
          </Link>
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold mb-3">
            <Stethoscope size={16} />
            Create Doctor Account
          </div>
          <p className="text-slate-600 text-sm">Doctors must have a valid medical registration number to join.</p>
        </div>

        {/* Success state */}
        {success ? (
          <div className="bg-white shadow-xl rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Account Verified & Created!</h2>
            <p className="text-slate-500 text-sm mb-5">
              Welcome, <strong>{success.name}</strong>. Sign in with your email to access the portal.
            </p>
            <button
              onClick={() => navigate("/doctor/login")}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition"
            >
              Go to Doctor Login →
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-xl rounded-3xl p-8">

            {/* Verification notice */}
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-700">
              <ShieldCheck size={16} className="shrink-0 mt-0.5" />
              <span>
                Your medical registration number will be verified against our licensed practitioner registry before your account is created.
              </span>
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Dr. Anjali Singh"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="doctor@hospital.com"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="9876543210"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Specialization</label>
                <select
                  value={form.specialization}
                  onChange={set("specialization")}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select your specialization…</option>
                  {SPECIALIZATIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Medical Registration Number
                </label>
                <input
                  type="text"
                  value={form.medRegNo}
                  onChange={set("medRegNo")}
                  placeholder="MED-REG-001"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  Issued by the Medical Council. Required for doctor registration.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Minimum 6 characters"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  placeholder="Re-enter your password"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying & creating account...
                  </>
                ) : (
                  "Create Doctor Account"
                )}
              </button>
            </form>
          </div>
        )}

        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">
            Already have an account?&nbsp;
            <Link to="/doctor/login" className="text-blue-600 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
          <Link to="/" className="text-slate-400 text-xs hover:text-slate-600 mt-2 inline-block">← Back to Home</Link>
        </div>

      </div>
    </div>
  );
}

export default DoctorRegisterPage;
