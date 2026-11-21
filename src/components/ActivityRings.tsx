import type { Ring } from '../lib/gamify'

/**
 * Apple-Fitness-style concentric rings. Past 100% the ring keeps going round (with a darker overlap tip),
 * so over-achieving still shows. Pure SVG + CSS transition: cheap on the always-on kiosk.
 */
export default function ActivityRings({ rings, size = 200, stroke = 22 }: { rings: Ring[]; size?: number; stroke?: number }) {
  const gap = 4
  const c = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img"
      aria-label={rings.map(r => `${r.label} ${Math.round(r.pct * 100)}%`).join(', ')}>
      <defs>
        {rings.map(r => (
          <linearGradient key={r.key} id={`ring-${r.key}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={r.colors[0]} /><stop offset="100%" stopColor={r.colors[1]} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((r, i) => {
        const radius = c - stroke / 2 - i * (stroke + gap)
        const C = 2 * Math.PI * radius
        const p = Math.max(0, r.pct)
        const lap = Math.min(p, 1)
        return (
          <g key={r.key} transform={`rotate(-90 ${c} ${c})`}>
            {/* track */}
            <circle cx={c} cy={c} r={radius} fill="none" stroke={r.colors[0]} strokeOpacity={0.18} strokeWidth={stroke} />
            {/* progress */}
            <circle cx={c} cy={c} r={radius} fill="none" stroke={`url(#ring-${r.key})`} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - (p > 0 ? Math.max(lap, 0.012) : 0))}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }} />
            {/* overflow lap past 100% */}
            {p > 1 && <circle cx={c} cy={c} r={radius} fill="none" stroke={r.colors[0]} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(p - 1, 0.98))}
              style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,.6))', transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }} />}
          </g>
        )
      })}
    </svg>
  )
}
