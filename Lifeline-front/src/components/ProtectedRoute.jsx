import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../api/client.js";

/**
 * Wraps a route and redirects to `redirectTo` if the user is not logged in
 * or does not have the required role.
 *
 * Roles from the real backend are lowercase: "doctor", "patient", "clerk".
 */
export default function ProtectedRoute({ children, requiredRole, redirectTo = "/login" }) {
  const { currentUser, bootstrapping } = useAuth();

  // While the bootstrap effect is validating the stored token, render nothing
  // to avoid a flash of the login redirect.
  if (bootstrapping) return null;

  // No token in storage at all → send to login immediately
  if (!currentUser && !getToken()) return <Navigate to={redirectTo} replace />;

  // Token present but getMe() hasn't resolved yet (edge case — handled by bootstrapping)
  if (!currentUser) return null;

  if (requiredRole && currentUser.role.toLowerCase() !== requiredRole.toLowerCase()) {
    // Wrong portal — send to their own portal
    if (currentUser.role === "doctor") return <Navigate to="/doctor/dashboard" replace />;
    if (currentUser.role === "patient") return <Navigate to="/patient/dashboard" replace />;
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
