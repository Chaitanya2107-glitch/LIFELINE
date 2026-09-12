import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Eye, EyeOff, AlertCircle, Heart, CheckCircle, Copy } from "lucide-react";
import { registerPatient } from "../../api/patientAuth.js";

function PatientRegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    dateOfBirth: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  // success holds the generated LFL code from the backend response
  const [success, setSuccess] = useState(null); // { lflCode }
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const { name, phone, email, dateOfBirth, password, confirmPassword } = form;

    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError("Please fill in all required fields (name, phone, password).");
      return;
    }
    if (email.trim() && !/\S+@\S+\.\S+/.test(email)) {
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
      const patient = await registerPatient(
        name.trim(),
        phone.replace(/\s/g, ""),
        password,
        email.trim() || null,
        dateOfBirth || null,
      );
      // Backend returns patient_code — the generated LFL code
      setSuccess({ lflCode: patient.patient_code });
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (success?.lflCode) {
      navigator.clipboard.writeText(success.lflCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 flex items-center justify-center px-6 py-10">
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
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold mb-3">
            <User size={16} />
            Create Patient Account
          </div>
          <p className="text-slate-600 text-sm">
            Sign up to access your medical records, care plan, and health history.
          </p>
        </div>

        {/* Success state — show generated LFL code */}
        {success ? (
          <div className="bg-white shadow-xl rounded-3xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Account Created!</h2>
            <p className="text-slate-500 text-sm mb-5">
              Your Lifeline account is ready. This is your unique Lifeline Code — you will use it every time you sign in.
            </p>

            {/* LFL code display */}
            <div className="bg-slate-100 rounded-2xl px-6 py-5 mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Your Lifeline Code
              </p>
              <p className="text-3xl font-black font-mono text-blue-700 tracking-widest">
                {success.lflCode}
              </p>
            </div>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 mx-auto mb-6 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition"
            >
              <Copy size={14} />
              {copied ? "Copied!" : "Copy code"}
            </button>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-left">
              <p className="text-xs text-amber-700 font-semibold mb-1">⚠ Save your Lifeline Code</p>
              <p className="text-xs text-amber-600">
                You will need this code every time you log in. Store it somewhere safe — your notes app, a written note, or a password manager.
              </p>
            </div>

            <button
              onClick={() => navigate("/patient/login")}
              className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition"
            >
              Go to Patient Login →
            </button>
          </div>
        ) : (
          <div className="bg-white shadow-xl rounded-3xl p-8">

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Full Name — required */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Aryan Sharma"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Phone — required */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="9876543210"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Email — optional */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Address
                  <span className="text-slate-400 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="you@example.com"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Date of birth — optional */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Date of Birth
                  <span className="text-slate-400 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={set("dateOfBirth")}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Password — required */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Minimum 6 characters"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-green-500"
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

              {/* Confirm password — required */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  placeholder="Re-enter your password"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-600 text-white rounded-xl py-4 font-semibold hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create My Account"
                )}
              </button>
            </form>
          </div>
        )}

        <div className="text-center mt-6">
          <p className="text-slate-500 text-sm">
            Already have an account?&nbsp;
            <Link to="/patient/login" className="text-blue-600 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
          <Link to="/" className="text-slate-400 text-xs hover:text-slate-600 mt-2 inline-block">← Back to Home</Link>
        </div>

      </div>
    </div>
  );
}

export default PatientRegisterPage;
