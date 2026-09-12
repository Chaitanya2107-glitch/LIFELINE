import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle } from "lucide-react";

/**
 * Shows a full-screen overlay when the session expires.
 * Navigates to the appropriate login after the user dismisses it.
 */
export default function SessionExpiredBanner() {
  const { sessionExpired, acknowledgeExpiry } = useAuth();
  const navigate = useNavigate();

  if (!sessionExpired) return null;

  const handleDismiss = () => {
    acknowledgeExpiry();
    navigate("/login");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center px-6">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-orange-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Session Expired</h2>
        <p className="text-slate-600 mb-8">
          Your session has expired due to inactivity. Please log in again to continue.
        </p>
        <button
          onClick={handleDismiss}
          className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
