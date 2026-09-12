import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";
import PatientLayout from "../../layouts/PatientLayout";
import { ShieldCheck, Clock, KeyRound, Info, CheckCircle, RefreshCw } from "lucide-react";

function PatientOTPPage() {
  const { currentUser } = useAuth();
  const { otpStore } = useAppData();

  const entry = otpStore[currentUser.id] || null;

  const [now, setNow] = useState(Date.now());

  // Tick every second to keep countdown live
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const isExpired = entry ? now > new Date(entry.expiresAt).getTime() : true;
  const isUsed = entry?.used === true;
  const isActive = entry && !isExpired && !isUsed;

  const secondsLeft = entry && !isExpired
    ? Math.max(0, Math.floor((new Date(entry.expiresAt).getTime() - now) / 1000))
    : 0;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <PatientLayout>
      <div className="p-10 max-w-2xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">My OTP</h1>
          <p className="text-slate-500 mt-2">
            When your doctor generates an OTP to verify your identity, the code appears here.
            Read it back to them to authorise the action.
          </p>
        </div>

        {/* How it works info */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-700">
          <Info size={15} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">How it works</p>
            <p className="mt-0.5 text-blue-600">
              Your doctor will generate an OTP when uploading a report or verifying your identity.
              Open this page, read the 6-digit code aloud, and your doctor will enter it on their
              end to complete verification.
            </p>
          </div>
        </div>

        {/* OTP Card */}
        <div className="bg-white border rounded-3xl p-8 shadow-sm">

          {/* No OTP yet */}
          {!entry && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <KeyRound size={28} className="text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700 text-lg">No active OTP</p>
              <p className="text-slate-400 text-sm mt-2 max-w-xs">
                Ask your doctor to generate an OTP for you. The code will appear here automatically.
              </p>
            </div>
          )}

          {/* OTP expired */}
          {entry && isExpired && !isUsed && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <Clock size={28} className="text-red-400" />
              </div>
              <p className="font-semibold text-red-600 text-lg">OTP Expired</p>
              <p className="text-slate-400 text-sm mt-2 max-w-xs">
                The previous OTP has expired. Ask your doctor to generate a new one.
              </p>
            </div>
          )}

          {/* OTP already used */}
          {entry && isUsed && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={28} className="text-green-500" />
              </div>
              <p className="font-semibold text-green-700 text-lg">OTP Used</p>
              <p className="text-slate-400 text-sm mt-2 max-w-xs">
                The last OTP was successfully verified. Ask your doctor to generate a new one
                if another verification is needed.
              </p>
            </div>
          )}

          {/* Active OTP */}
          {isActive && (
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-5">
                <ShieldCheck size={26} className="text-green-600" />
              </div>

              <p className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-widest">
                Your OTP Code
              </p>

              {/* Code display */}
              <div className="flex gap-3 mb-6">
                {entry.code.split("").map((digit, i) => (
                  <div
                    key={i}
                    className="w-12 h-14 bg-slate-50 border-2 border-slate-200 rounded-xl flex items-center justify-center text-3xl font-mono font-bold text-slate-900 select-all"
                  >
                    {digit}
                  </div>
                ))}
              </div>

              {/* Countdown */}
              <div className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full mb-4 ${
                secondsLeft < 60
                  ? "bg-red-50 text-red-600"
                  : "bg-slate-100 text-slate-600"
              }`}>
                <Clock size={14} />
                Expires in {formatTime(secondsLeft)}
              </div>

              <p className="text-xs text-slate-400 text-center max-w-xs">
                Read this code to your doctor. It is valid for one use only and will expire
                once entered or when the timer runs out.
              </p>
            </div>
          )}

        </div>

        {/* Refresh hint */}
        <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
          <RefreshCw size={11} />
          This page updates automatically every second.
        </p>

      </div>
    </PatientLayout>
  );
}

export default PatientOTPPage;
