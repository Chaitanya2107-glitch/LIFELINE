import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Contexts
import { AppDataProvider } from "./context/AppDataContext";
import { AuthProvider } from "./context/AuthContext";

// Shared
import ProtectedRoute from "./components/ProtectedRoute";
import SessionExpiredBanner from "./components/SessionExpiredBanner";

// Landing
import LandingPage from "./pages/LandingPage";

// Doctor Portal
import DoctorLoginPage from "./pages/doctor/DoctorLoginPage";
import DoctorRegisterPage from "./pages/doctor/DoctorRegisterPage";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import PatientSearchPage from "./pages/doctor/PatientSearchPage";
import UploadReportPage from "./pages/doctor/UploadReportPage";
import DoctorAccessRequestsPage from "./pages/doctor/DoctorAccessRequestsPage";
import DoctorRecordsPage from "./pages/doctor/DoctorRecordsPage";
import DoctorNotificationsPage from "./pages/doctor/DoctorNotificationsPage";
import DoctorAuditPage from "./pages/doctor/DoctorAuditPage";
import DoctorProfilePage from "./pages/doctor/DoctorProfilePage";
import DoctorAppointmentsPage from "./pages/doctor/DoctorAppointmentsPage";

// Patient Portal
import PatientLoginPage from "./pages/patient/PatientLoginPage";
import PatientRegisterPage from "./pages/patient/PatientRegisterPage";
import PatientDashboard from "./pages/patient/PatientDashboard";
import PatientReportsPage from "./pages/patient/PatientReportsPage";
import PatientAccessRequestsPage from "./pages/patient/PatientAccessRequestsPage";
import PatientNotificationsPage from "./pages/patient/PatientNotificationsPage";
import PatientGuidePage from "./pages/patient/PatientGuidePage";
import PatientProfilePage from "./pages/patient/PatientProfilePage";
import PatientOTPPage from "./pages/patient/PatientOTPPage";

// Patient Portal — Health Intelligence
import HealthJourneyPage from "./pages/patient/HealthJourneyPage";
import VitalisPage from "./pages/patient/VitalisPage";
import MedicationsPage from "./pages/patient/MedicationsPage";
import LabTrendsPage from "./pages/patient/LabTrendsPage";
import CarePlanPage from "./pages/patient/CarePlanPage";
import VisitBriefPage from "./pages/patient/VisitBriefPage";
import AppointmentsPage from "./pages/patient/AppointmentsPage";
import EmergencyProfilePage from "./pages/patient/EmergencyProfilePage";

function patientRoute(path, Element) {
  return (
    <Route
      path={path}
      element={
        <ProtectedRoute requiredRole="PATIENT">
          <Element />
        </ProtectedRoute>
      }
    />
  );
}

function doctorRoute(path, Element) {
  return (
    <Route
      path={path}
      element={
        <ProtectedRoute requiredRole="DOCTOR">
          <Element />
        </ProtectedRoute>
      }
    />
  );
}

function AppRoutes() {
  return (
    <>
      <SessionExpiredBanner />
      <Routes>

        {/* ── Public ───────────────────────────────────────────── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />

        {/* ── Doctor Portal ─────────────────────────────────────── */}
        <Route path="/doctor/login" element={<DoctorLoginPage />} />
        <Route path="/doctor/register" element={<DoctorRegisterPage />} />
        {doctorRoute("/doctor/dashboard", DoctorDashboard)}
        {doctorRoute("/doctor/patients", PatientSearchPage)}
        {doctorRoute("/doctor/upload", UploadReportPage)}
        {doctorRoute("/doctor/access-requests", DoctorAccessRequestsPage)}
        {doctorRoute("/doctor/records", DoctorRecordsPage)}
        {doctorRoute("/doctor/appointments", DoctorAppointmentsPage)}
        {doctorRoute("/doctor/notifications", DoctorNotificationsPage)}
        {doctorRoute("/doctor/audit", DoctorAuditPage)}
        {doctorRoute("/doctor/profile", DoctorProfilePage)}

        {/* ── Patient Portal ────────────────────────────────────── */}
        <Route path="/patient/login" element={<PatientLoginPage />} />
        <Route path="/patient/register" element={<PatientRegisterPage />} />
        {patientRoute("/patient/dashboard", PatientDashboard)}
        {patientRoute("/patient/reports", PatientReportsPage)}
        {patientRoute("/patient/access-requests", PatientAccessRequestsPage)}
        {patientRoute("/patient/notifications", PatientNotificationsPage)}
        {patientRoute("/patient/guide", PatientGuidePage)}
        {patientRoute("/patient/profile", PatientProfilePage)}
        {patientRoute("/patient/otp", PatientOTPPage)}

        {/* Health Intelligence */}
        {patientRoute("/patient/journey", HealthJourneyPage)}
        {patientRoute("/patient/vitalis", VitalisPage)}
        {patientRoute("/patient/medications", MedicationsPage)}
        {patientRoute("/patient/labs", LabTrendsPage)}
        {patientRoute("/patient/care-plan", CarePlanPage)}
        {patientRoute("/patient/visit-brief", VisitBriefPage)}
        {patientRoute("/patient/appointments", AppointmentsPage)}
        {patientRoute("/patient/emergency", EmergencyProfilePage)}

        {/* ── Legacy redirects ──────────────────────────────────── */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/reports" element={<Navigate to="/" replace />} />
        <Route path="/report-viewer" element={<Navigate to="/" replace />} />
        <Route path="/medical-journey" element={<Navigate to="/" replace />} />

        {/* ── Catch-all ─────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppDataProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </AppDataProvider>
    </BrowserRouter>
  );
}

export default App;
