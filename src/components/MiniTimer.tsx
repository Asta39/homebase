import { Link } from 'react-router-dom'
import { fmt, timeLeft, useFocus } from '../lib/focus'

/** Shows the running focus timer in the sidebar on every page. */
export default function MiniTimer() {
  const s = useFocus()
  if (s.phase === 'idle') return null
  return (
    <Link to="/focus" title="Focus timer" className={`lg:mx-1 mb-2 px-1 lg:px-3 py-2 rounded-xl flex flex-col lg:flex-row items-center gap-0.5 lg:gap-2 text-sm ${s.phase === 'break' ? 'bg-green-600/20' : 'bg-[var(--accent)]/15'}`}>
      <span>{s.phase === 'break' ? '☕' : '🍅'}</span>
      <span className="flex-1 hidden lg:inline">{s.paused ? 'Paused' : s.phase === 'break' ? 'Break' : 'Focus'}</span>
      <span className="tabular-nums font-semibold text-[11px] lg:text-sm">{fmt(timeLeft(s))}</span>
    </Link>
  )
}
