// Full-width SVG line chart for a single lab marker over time.
// Shows: reference range band, value line + dots, date X-axis, value Y-axis, hover tooltip.
import { useState } from "react";

const CHART_W = 520;
const CHART_H = 160;
const PAD = { top: 12, right: 16, bottom: 36, left: 48 };

function toX(i, total) {
  return PAD.left + (i / Math.max(total - 1, 1)) * (CHART_W - PAD.left - PAD.right);
}
function toY(val, min, max) {
  const h = CHART_H - PAD.top - PAD.bottom;
  return PAD.top + ((max - val) / (max - min || 1)) * h;
}

export default function LabChart({ values, refLow, refHigh, normal }) {
  const [hovered, setHovered] = useState(null);

  const nums = values.map((v) => parseFloat(v.value));

  // Y domain: encompass both data and reference range with 10% padding
  const allVals = [...nums, ...(refLow != null ? [refLow] : []), ...(refHigh != null ? [refHigh] : [])];
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const pad = (rawMax - rawMin) * 0.15 || rawMax * 0.1 || 1;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const lineColor = normal ? "#22c55e" : "#ef4444";
  const bandColor = normal ? "#bbf7d0" : "#fee2e2";

  const points = nums.map((n, i) => ({ x: toX(i, nums.length), y: toY(n, yMin, yMax), val: n, date: values[i].date }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Reference band corners (clamped to chart area)
  const bandTop = refHigh != null ? toY(Math.min(refHigh, yMax), yMin, yMax) : PAD.top;
  const bandBottom = refLow != null ? toY(Math.max(refLow, yMin), yMin, yMax) : CHART_H - PAD.bottom;
  const bandLeft = PAD.left;
  const bandRight = CHART_W - PAD.right;

  // Y-axis ticks (5 evenly spaced)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / 4;
    return { val, y: toY(val, yMin, yMax) };
  });

  // X-axis date labels — show first, last, and up to 3 middle ones
  const xLabels = (() => {
    if (points.length <= 4) return points.map((p, i) => ({ ...p, i }));
    const indices = [0, Math.floor((points.length - 1) / 3), Math.floor((2 * (points.length - 1)) / 3), points.length - 1];
    return [...new Set(indices)].map((i) => ({ ...points[i], i }));
  })();

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const hPt = hovered != null ? points[hovered] : null;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        style={{ minWidth: 260 }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Reference band */}
        {refLow != null && refHigh != null && (
          <rect
            x={bandLeft} y={bandTop}
            width={bandRight - bandLeft} height={Math.max(0, bandBottom - bandTop)}
            fill={bandColor} opacity={0.45}
          />
        )}

        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={i} x1={PAD.left} x2={CHART_W - PAD.right} y1={t.y} y2={t.y}
            stroke="#e2e8f0" strokeWidth="1" />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((t, i) => (
          <text key={i} x={PAD.left - 6} y={t.y + 4} textAnchor="end"
            fontSize="10" fill="#94a3b8">{t.val.toFixed(1)}</text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((p) => (
          <text key={p.i} x={p.x} y={CHART_H - 6} textAnchor="middle"
            fontSize="10" fill="#94a3b8">{formatDate(p.date)}</text>
        ))}

        {/* Value line */}
        <polyline points={polyline} fill="none" stroke={lineColor} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Dots + hover targets */}
        {points.map((p, i) => (
          <g key={i} onMouseEnter={() => setHovered(i)} style={{ cursor: "crosshair" }}>
            <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={hovered === i ? 5 : 3.5} fill={lineColor}
              stroke="white" strokeWidth="1.5" />
          </g>
        ))}

        {/* Hover tooltip */}
        {hPt && (
          <g>
            <rect x={Math.min(hPt.x - 36, CHART_W - 88)} y={hPt.y - 34}
              width={84} height={26} rx="5" fill="#1e293b" opacity={0.9} />
            <text x={Math.min(hPt.x - 36, CHART_W - 88) + 42} y={hPt.y - 17}
              textAnchor="middle" fontSize="11" fill="white" fontWeight="600">
              {hPt.val} · {formatDate(hPt.date)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
