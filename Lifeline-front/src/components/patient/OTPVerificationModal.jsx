import { useState, useEffect } from "react";
import { useAppData } from "../../context/AppDataContext";
import { ShieldCheck, X, AlertCircle, Info, Clock } from "lucide-react";

const OTP_EXPIRY_MINUTES = 12;

export default function OTPVerificationModal({ patientId, onSuccess, onClose }) {
  const { generateOTP, verifyOTP } = useAppData();

  const [step, setStep] = useState("generate"); // generate | verify
  const [demoOTP, setDemoOTP] = useState("");
  const [entered, setEntered] = useState("");
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(OTP_EXPIRY_MINUTES * 60);
  const [verifying, setVerifying] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (step !== "verify") return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setError("OTP expired. Please generate a new one.");
          setStep("generate");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleGenerate = () => {
    const code = generateOTP(patientId);
    setDemoOTP(code); // In demo mode we display it
    setStep("verify");
    setSecondsLeft(OTP_EXPIRY_MINUTES * 60);
    setError("");
    setEntered("");
  };

  const handleVerify = () => {
    if (!entered.trim()) return;
    setVerifying(true);
    setError("");

    setTimeout(() => {
      const result = verifyOTP(patientId, entered.trim());
      if (result.success) {
        onSuccess();
      } else {
        setError(result.reason);
        setVerifying(false);
      }
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">

        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <ShieldCheck size={24} className="text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Identity Verification</h2>
            <p className="text-sm text-slate-500">OTP required to view this report</p>
          </div>
        </div>

        {step === "generate" && (
          <>
            <p className="text-slate-600 text-sm mb-6">
              To protect your privacy, we require you to verify your identity before viewing
              this medical report. An OTP will be sent to your registered contact.
            </p>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              className="w-full bg-green-600 text-white rounded-xl py-3.5 font-semibold hover:bg-green-700 transition"
            >
              Send OTP
            </button>
          </>
        )}

        {step === "verify" && (
          <>
            {/* Demo notice — only show in demo/prototype */}
            {demoOTP && (
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-5">
                <Info size={14} className="text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-yellow-700">Demo Mode</p>
                  <p className="text-xs text-yellow-600 mt-0.5">
                    In production, the OTP would be sent to your registered phone/email.
                    For this prototype, your OTP is: <span className="font-mono font-bold text-lg">{demoOTP}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Countdown */}
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="text-slate-600">Enter the OTP sent to your phone/email</span>
              <span className={`flex items-center gap-1 font-mono font-semibold ${secondsLeft < 60 ? "text-red-600" : "text-slate-500"}`}>
                <Clock size={13} />
                {formatTime(secondsLeft)}
              </span>
            </div>

            <input
              type="text"
              value={entered}
              onChange={(e) => setEntered(e.target.value)}
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={verifying || !entered.trim()}
              className="w-full bg-green-600 text-white rounded-xl py-3.5 font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify OTP"
              )}
            </button>

            <button
              onClick={() => { setStep("generate"); setError(""); }}
              className="w-full mt-3 text-sm text-slate-500 hover:text-slate-700 transition"
            >
              Resend OTP
            </button>
          </>
        )}

        {/* Note */}
        <p className="text-xs text-slate-400 text-center mt-5">
          OTP is valid for {OTP_EXPIRY_MINUTES} minutes and expires after use.
          Max 3 attempts.
        </p>
      </div>
    </div>
  );
}
