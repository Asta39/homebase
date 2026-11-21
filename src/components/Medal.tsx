import { TIER_COLORS, TIER_NAMES, type Achievement } from '../lib/gamify'
import Art from './Art'

/**
 * Duolingo-style achievement medal: the icon in a tier-coloured disc with a progress ring toward the next tier.
 * Locked (tier 0) medals are greyed with their progress shown.
 */
export default function Medal({ a, size = 64 }: { a: Achievement; size?: number }) {
  const color = a.tier ? TIER_COLORS[a.tier - 1] : 'var(--line)'
  const span = a.next ? a.next - a.prev : 1
  const pct = a.next ? Math.min(1, (a.value - a.prev) / span) : 1
  const r = size / 2 - 3, C = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${a.title}${a.tier ? ` · ${TIER_NAMES[a.tier - 1]}` : ''}`}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.next ? TIER_COLORS[Math.min(a.tier, 5)] : color} strokeWidth={4}
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className={`absolute rounded-full grid place-items-center ${a.tier ? '' : 'grayscale opacity-55'}`}
        style={{ inset: 7, background: a.tier ? `radial-gradient(circle at 30% 25%, #fff8 0%, transparent 45%), ${color}` : 'var(--line)', boxShadow: a.tier ? `0 4px 14px ${color}66` : 'none', fontSize: size * 0.36 }}>
        <img src={`${import.meta.env.BASE_URL}achievements/${a.id}.png`} alt={a.title} draggable={false} loading="lazy"
          className="w-[78%] h-[78%] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,.25)] select-none"
          onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
      </div>
      {a.tier > 0 && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black px-1.5 rounded-full text-white leading-4"
        style={{ background: color }}>{a.tier === 6 ? <Art name="star" size={10} className="-mt-px" /> : ['I', 'II', 'III', 'IV', 'V'][a.tier - 1]}</span>}
    </div>
  )
}
