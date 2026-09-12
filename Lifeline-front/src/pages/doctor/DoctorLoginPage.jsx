import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Stethoscope, Eye, EyeOff, AlertCircle, Heart } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { loginDoctor, getMe } from "../../api/auth.js";
import { setToken } from "../../api/client.js";

function DoctorLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const { access_token } = await loginDoctor(email.trim(), password);
      setToken(access_token);
      const user = await getMe();
      login(access_token, user);
      navigate("/doctor/dashboard");
    } catch (err) {
      setError(err.message || "Invalid email or password. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center px-6">
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
            Doctor Portal
          </div>
          <p className="text-slate-600">Sign in with your email to access the medical portal.</p>
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
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@hospital.com"
                autoComplete="email"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  autoComplete="current-password"
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
                "Sign In to Doctor Portal"
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <p className="text-slate-500 text-sm">
            New to Lifeline?&nbsp;
            <Link to="/doctor/register" className="text-blue-700 font-semibold hover:underline">
              Create a Doctor Account
            </Link>
          </p>
          <p className="text-slate-500 text-sm">Are you a patient?&nbsp;
            <Link to="/patient/login" className="text-blue-600 font-semibold hover:underline">
              Patient Portal
            </Link>
          </p>
          <Link to="/" className="text-slate-400 text-xs hover:text-slate-600 mt-2 inline-block">← Back to Home</Link>
        </div>

      </div>
    </div>
  );
}

export default DoctorLoginPage;
