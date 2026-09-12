import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import { MapPin, FileText, Stethoscope, Calendar, ChevronDown, ChevronUp, Activity, Loader2 } from "lucide-react";
import { getTimeline } from "../../api/timeline.js";

const TYPE_COLORS = {
  "Blood Test":   "bg-red-100 text-red-700 border-red-200",
  "Radiology":    "bg-blue-100 text-blue-700 border-blue-200",
  "Cardiology":   "bg-pink-100 text-pink-700 border-pink-200",
  "Prescription": "bg-green-100 text-green-700 border-green-200",
  "Diagnosis":    "bg-purple-100 text-purple-700 border-purple-200",
  "General Report": "bg-slate-100 text-slate-700 border-slate-200",
};

const TYPE_DOT = {
  "Blood Test":   "bg-red-400",
  "Radiology":    "bg-blue-400",
  "Cardiology":   "bg-pink-400",
  "Prescription": "bg-green-400",
  "Diagnosis":    "bg-purple-400",
  "General Report": "bg-slate-400",
};

function getColor(type) {
  return TYPE_COLORS[type] || "bg-slate-100 text-slate-700 border-slate-200";
}
function getDot(type) {
  return TYPE_DOT[type] || "bg-slate-400";
}

function groupByYear(events) {
  const map = {};
  events.forEach((e) => {
    const year = e.date.slice(0, 4);
    if (!map[year]) map[year] = [];
    map[year].push(e);
  });
  return Object.entries(map).sort((a, b) => b[0] - a[0]);
}

function EventCard({ event }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden">
      <div
        className="flex items-start gap-4 p-5 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className={`w-2.5 h-2.5 rounded-full mt-2 shrink-0 ${getDot(event.type)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold text-slate-800 text-sm leading-snug">{event.title}</h3>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getColor(event.type)}`}>
              {event.type}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{event.description}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Calendar size={11} />{event.date}</span>
            {event.doctor && <span className="flex items-center gap-1"><Stethoscope size={11} />{event.doctor}</span>}
            {event.hospital && <span className="flex items-center gap-1"><MapPin size={11} />{event.hospital}</span>}
          </div>
        </div>
        <button className="text-slate-400 shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t bg-slate-50 pt-4 space-y-3">
          {event.diagnoses && event.diagnoses.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Diagnoses / Findings</p>
              <div className="flex flex-wrap gap-2">
                {event.diagnoses.map((d, i) => (
                  <span key={i} className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2.5 py-1 rounded-full">{d}</span>
                ))}
              </div>
            </div>
          )}
          {event.procedures && event.procedures.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Procedures</p>
              <div className="flex flex-wrap gap-2">
                {event.procedures.map((p, i) => (
                  <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-full">{p}</span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-400">Report ID: <span className="font-mono">{event.reportId}</span></p>
        </div>
      )}
    </div>
  );
}

function HealthJourneyPage() {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTimeline()
      .then((data) => {
        // Normalise backend shape to what the component expects.
        // GET /timeline/ returns { "timeline": [...] } — unwrap the envelope,
        // but also accept a bare array for forward-compatibility.
        const items = Array.isArray(data) ? data : (data?.timeline ?? []);
        const mapped = items.map((e, i) => ({
          eventId: e.eventId ?? `evt-${i}`,
          date: e.date,
          title: e.title,
          type: e.type || "Medical Report",
          description: e.description || "",
          diagnoses: e.diagnosis ?? e.diagnoses ?? [],
          procedures: e.procedures ?? [],
          doctor: e.doctor || "",
          hospital: e.hospital || "",
          reportId: e.reportId || null,
        }));
        setEvents(mapped);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = groupByYear(events);

  // Filter by type
  const allTypes = [...new Set(events.map((e) => e.type))];
  const [activeType, setActiveType] = useState("All");
  const filtered = activeType === "All" ? events : events.filter((e) => e.type === activeType);
  const filteredGrouped = groupByYear(filtered);

  if (loading) {
    return (
      <PatientLayout>
        <div className="p-10 flex items-center justify-center min-h-[40vh] text-slate-400">
          <Loader2 size={32} className="animate-spin mr-3" /> Loading your health journey…
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-10 max-w-4xl">

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
            <Activity size={32} className="text-blue-600" /> Health Journey
          </h1>
          <p className="text-slate-500 mt-2">
            Your chronological medical history — built automatically from verified reports uploaded by your doctors.
          </p>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{events.filter(e=>e.type!=="Diagnosis").length}</p>
            <p className="text-xs text-blue-600 mt-1">Medical Events</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-700">{events.filter(e=>e.type==="Diagnosis").length}</p>
            <p className="text-xs text-purple-600 mt-1">Diagnoses Recorded</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{grouped.length}</p>
            <p className="text-xs text-green-600 mt-1">Year(s) of History</p>
          </div>
        </div>

        {/* Type filter */}
        {events.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {["All", ...allTypes].map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition border ${
                  activeType === t
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {events.length === 0 ? (
          <div className="bg-white border rounded-3xl p-12 text-center text-slate-400">
            <Activity size={48} className="mx-auto mb-4 opacity-30" />
            <h2 className="text-xl font-semibold text-slate-600 mb-2">No events yet</h2>
            <p>Your health journey will be populated as your doctors upload reports.</p>
          </div>
        ) : (
          filteredGrouped.map(([year, yearEvents]) => (
            <div key={year} className="mb-10">
              <div className="flex items-center gap-4 mb-5">
                <h2 className="text-2xl font-bold text-slate-800">{year}</h2>
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">{yearEvents.length} event{yearEvents.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-4 pl-4 border-l-2 border-slate-200 ml-3">
                {yearEvents.map((event) => (
                  <EventCard key={event.eventId} event={event} />
                ))}
              </div>
            </div>
          ))
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
          <strong>How this is built:</strong> Each entry is derived from reports uploaded by verified medical personnel.
          Diagnoses and procedures are extracted by Lifeline's AI and are for informational purposes only —
          they are not independent medical opinions.
        </div>
      </div>
    </PatientLayout>
  );
}

export default HealthJourneyPage;
