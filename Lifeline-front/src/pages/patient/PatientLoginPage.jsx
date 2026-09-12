import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Eye, EyeOff, AlertCircle, Heart } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { loginPatient, getPatientProfile } from "../../api/patientAuth.js";
import { setToken } from "../../api/client.js";

function PatientLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [lflCode, setLflCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!lflCode.trim() || !password.trim()) {
      setError("Please enter both your Lifeline Code and password.");
      return;
    }

    setIsLoading(true);
    try {
      const { access_token } = await loginPatient(lflCode.trim(), password);
      // Store the token so getPatientProfile() can attach it
      setToken(access_token);
      const profile = await getPatientProfile();
      login(access_token, {
        id: profile.patient_code,
        patient_id: profile.id,
        role: "patient",
        name: profile.name,
        displayId: profile.patient_code,
        blood_group: profile.blood_group,
        email: profile.email,
        phone: profile.phone,
        date_of_birth: profile.date_of_birth,
        emergency_contacts: profile.emergency_contacts,
        conditions: profile.conditions,
      });
      navigate("/patient/dashboard");
    } catch (err) {
      setError(err.message || "Invalid Lifeline Code or password. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-slate-100 flex items-center justify-center px-6">
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
            <User size={16} />
            Patient Portal
          </div>
          <p className="text-slate-600">Sign in with your Lifeline Code to access your medical records.</p>
        </div>

        {/* Card */}
        <div className="bg-white shadow-xl rounded-3xl p-8">

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Lifeline Code (LFL-XXXXXX)
              </label>
              <input
                type="text"
                value={lflCode}
                onChange={(e) => setLflCode(e.target.value)}
                placeholder="LFL-J6MTOC"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In to Patient Portal"
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <p className="text-slate-500 text-sm">
            New to Lifeline?&nbsp;
            <Link to="/patient/register" className="text-green-700 font-semibold hover:underline">
              Create a Patient Account
            </Link>
          </p>
          <p className="text-slate-500 text-sm">Are you a doctor?&nbsp;
            <Link to="/doctor/login" className="text-blue-600 font-semibold hover:underline">
              Doctor Portal
            </Link>
          </p>
          <Link to="/" className="text-slate-400 text-xs hover:text-slate-600 mt-2 inline-block">← Back to Home</Link>
        </div>

      </div>
    </div>
  );
}

export default PatientLoginPage;
