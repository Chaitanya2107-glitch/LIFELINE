import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Pill, Eye, EyeOff, AlertCircle, Heart } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { loginDoctor, getMe } from "../../api/auth.js";
import { setToken, clearToken } from "../../api/client.js";

function PharmacyLoginPage() {
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
      // Shared staff login endpoint — the role comes back in /auth/me.
      const { access_token } = await loginDoctor(email.trim(), password);
      setToken(access_token);
      const user = await getMe();
      if (user.role !== "pharmacist") {
        clearToken();
        setError("This account is not a pharmacist account. Please use the Doctor Portal.");
        return;
      }
      login(access_token, user);
      navigate("/pharmacy/dashboard");
    } catch (err) {
      setError(err.message || "Invalid email or password. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex flex-col items-center gap-2 mb-5">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-md">
              <Heart size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-none tracking-tight">LIFELINE</h1>
              <p className="text-xs text-slate-500 leading-none mt-0.5">Caring for Life</p>
            </div>
          </Link>
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold mb-3">
            <Pill size={16} />
            Pharmacy Portal
          </div>
          <p className="text-slate-600">Sign in to view and dispense patient prescriptions.</p>
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
                placeholder="pharmacist@pharmacy.com"
                autoComplete="email"
                className="w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full bg-emerald-600 text-white rounded-xl py-4 font-semibold hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In to Pharmacy Portal"
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <p className="text-slate-500 text-sm">
            New to Lifeline?&nbsp;
            <Link to="/pharmacy/register" className="text-emerald-700 font-semibold hover:underline">
              Create a Pharmacist Account
            </Link>
          </p>
          <p className="text-slate-500 text-sm">Are you a doctor?&nbsp;
            <Link to="/doctor/login" className="text-emerald-600 font-semibold hover:underline">
              Doctor Portal
            </Link>
          </p>
          <Link to="/" className="text-slate-400 text-xs hover:text-slate-600 mt-2 inline-block">← Back to Home</Link>
        </div>

      </div>
    </div>
  );
}

export default PharmacyLoginPage;
