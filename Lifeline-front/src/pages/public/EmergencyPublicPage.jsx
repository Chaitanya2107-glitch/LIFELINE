/**
 * src/pages/public/EmergencyPublicPage.jsx
 *
 * Public page — NOT wrapped in ProtectedRoute.
 * No sidebar, no nav — viewed by strangers on a phone browser after scanning a QR code.
 *
 * Reads :token from the URL, fetches /emergency/{token}, displays critical info.
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, Phone, Heart, Droplets, User, AlertOctagon, Loader2 } from "lucide-react";
import { getPublicEmergencyInfo } from "../../api/emergency.js";

function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const diff = Date.now() - new Date(dateOfBirth).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export default function EmergencyPublicPage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    getPublicEmergencyInfo(token)
      .then((data) => setInfo(data))
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-red-600">
          <Loader2 size={28} className="animate-spin" />
          <span className="font-semibold text-lg">Loading emergency info…</span>
        </div>
      </div>
    );
  }

  if (invalid || !info) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertOctagon size={28} className="text-slate-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-700 mb-2">Code Not Valid</h1>
          <p className="text-slate-500 text-sm">
            This emergency code is not valid or has expired.
          </p>
        </div>
      </div>
    );
  }

  const age = computeAge(info.date_of_birth);

  return (
    <div className="min-h-screen bg-red-600 flex flex-col items-center justify-start py-8 px-4">

      {/* Header strip */}
      <div className="w-full max-w-sm mb-6 text-center">
        <p className="text-red-200 text-xs font-bold uppercase tracking-widest mb-1">
          🚨 Emergency Medical Profile
        </p>
        <h1 className="text-3xl font-black text-white">{info.name}</h1>
        {age !== null && (
          <p className="text-red-200 text-sm mt-0.5">Age: {age}</p>
        )}
      </div>

      {/* Blood Group — most critical, largest */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 mb-4 text-center shadow-lg">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Droplets size={18} className="text-red-500" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Blood Group</p>
        </div>
        <p className="text-6xl font-black text-red-600">{info.blood_group || "Unknown"}</p>
      </div>

      {/* Allergies — safety-critical, prominent warning styling */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 mb-4 shadow-lg border-2 border-red-300">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-600" />
          <h2 className="font-bold text-red-700">Allergies</h2>
        </div>
        {info.allergies && info.allergies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {info.allergies.map((a, i) => (
              <span
                key={i}
                className="bg-red-100 text-red-800 font-bold text-sm px-4 py-2 rounded-full border border-red-300"
              >
                ⚠ {a}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No known allergies recorded.</p>
        )}
      </div>

      {/* Medical Conditions */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 mb-4 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Heart size={18} className="text-purple-600" />
          <h2 className="font-bold text-purple-700">Medical Conditions</h2>
        </div>
        {info.conditions && info.conditions.length > 0 ? (
          <div className="space-y-2">
            {info.conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-purple-50 border border-purple-200 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                <span className="text-sm font-medium text-slate-700">{c}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No conditions recorded.</p>
        )}
      </div>

      {/* Emergency Contacts */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 mb-6 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Phone size={18} className="text-blue-600" />
          <h2 className="font-bold text-blue-700">Emergency Contacts</h2>
        </div>
        {info.emergency_contacts && info.emergency_contacts.length > 0 ? (
          <div className="space-y-3">
            {info.emergency_contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <User size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.relation}</p>
                </div>
                <a
                  href={`tel:${c.phone}`}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition whitespace-nowrap"
                >
                  <Phone size={12} /> {c.phone}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No emergency contacts recorded.</p>
        )}
      </div>

      <p className="text-red-200 text-xs text-center max-w-xs">
        This page shows only critical medical information for emergency use.
        It does not contain full medical records or diagnoses.
      </p>
    </div>
  );
}
