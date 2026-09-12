// Shared SVG sparkline used by LabTrendsPage and the dashboard lab widget
export default function LabSparkline({ values, normal, width = 160, height = 48 }) {
  if (!values || values.length < 2) return null;
  const nums = values.map((v) => parseFloat(v.value));
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const pad = 6;
  const w = width;
  const h = height;
  const points = nums
    .map((n, i) => {
      const x = pad + (i / (nums.length - 1)) * (w - pad * 2);
      const y = pad + ((max - n) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const color = normal ? "#22c55e" : "#ef4444";

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {nums.map((n, i) => {
        const x = pad + (i / (nums.length - 1)) * (w - pad * 2);
        const y = pad + ((max - n) / range) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}
