import type { StatusBreakdown } from '../lib/types';

export default function Donut({ data, total }: { data: StatusBreakdown[]; total: number }) {
  const size = 180;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  const sum = data.reduce((s, d) => s + d.count, 0) || 1;
  let offset = 0;
  const segments = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const frac = d.count / sum;
      const len = frac * circ;
      const seg = { color: d.color, dash: len, gap: circ - len, offset: -offset };
      offset += len;
      return seg;
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={stroke}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={s.offset}
          strokeLinecap="butt"
        />
      ))}
      <g style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="34" fontWeight="700" fill="#0f172a">
          {total}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="12" fill="#94a3b8">
          ออเดอร์ทั้งหมด
        </text>
      </g>
    </svg>
  );
}
