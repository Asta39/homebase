import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, type Workout } from '../lib/db'
import Flame from './Flame'
import { setCount, streak, tickSet, ymd } from '../lib/workout'
import Art from './Art'

/** Today's exercises with one bubble per set. Used on the Workout page and the dashboard. */
export default function TodayWorkout({ compact = false }: { compact?: boolean }) {
  const now = new Date()
  const date = ymd(now)
  const plan = useLiveQuery(() => db.workouts.toArray()) ?? []
  const logs = useLiveQuery(() => db.workoutLog.toArray()) ?? []
  const todays = plan.filter(w => w.day === now.getDay())
  const doneOf = (id: number) => logs.find(l => l.date === date && l.workoutId === id)?.done ?? 0
  const total = todays.reduce((t, w) => t + setCount(w.sets), 0)
  const done = todays.reduce((t, w) => t + Math.min(setCount(w.sets), doneOf(w.id!)), 0)
  const s = streak(plan, logs, now)
  const finished = total > 0 && done >= total

  return (
    <div className={compact ? '' : 'panel p-5'}>
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="font-semibold">{compact ? 'Workout' : 'Today'}</h2>
        {total > 0 && <span className="muted text-sm">{done}/{total} sets</span>}
        {s > 0 && <span className="ml-auto text-sm font-semibold text-orange-500 inline-flex items-center gap-1"><Flame size={16} />{s} day{s === 1 ? '' : 's'}</span>}
      </div>
      {!todays.length ? <RestDay plan={plan} now={now} streakDays={s} /> : <>
        {total > 0 && <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden mb-3">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>}
        <div className="space-y-2">
          {todays.map(w => {
            const n = setCount(w.sets), d = doneOf(w.id!)
            return (
              <div key={w.id} className="flex items-center gap-3">
                <span className={`flex-1 min-w-0 truncate ${d >= n ? 'line-through muted' : ''}`}>{w.name} <span className="muted text-sm">{w.sets}</span></span>
                <div className="flex gap-1.5">
                  {Array.from({ length: n }, (_, i) => (
                    <button key={i} aria-label={`Set ${i + 1}`} onClick={() => tickSet(date, w, i + 1)}
                      className={`w-7 h-7 rounded-full text-xs font-semibold transition ${i < d ? 'bg-green-500 text-white' : 'border-2 border-[var(--line)] muted hover:border-green-500'}`}>
                      {i < d ? <Art name="check" size={22} /> : i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {finished && <p className="mt-3 text-sm text-green-500 font-medium flex items-center gap-1.5"><Art name="muscle" size={20} /> Workout done!</p>}
      </>}
    </div>
  )
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Rest days still give something to look at: what's next, and that the streak is safe. */
function RestDay({ plan, now, streakDays }: { plan: Workout[]; now: Date; streakDays: number }) {
  const next = [1, 2, 3, 4, 5, 6, 7].map(i => (now.getDay() + i) % 7).find(d => plan.some(w => w.day === d))
  const items = next == null ? [] : plan.filter(w => w.day === next)
  return (
    <div className="flex flex-col items-center text-center gap-1.5 py-2">
      <Art name="calm" size={56} className="mx-auto" />
      <div className="font-medium">Rest day</div>
      <div className="text-sm muted">{streakDays ? `Your ${streakDays}-day streak is safe — recover well.` : 'Recovery is part of training.'}</div>
      {next != null ? (
        <div className="mt-2 w-full rounded-2xl bg-[var(--line)] px-3 py-2 text-left text-sm">
          <div className="eyebrow mb-0.5">Next · {next === (now.getDay() + 1) % 7 ? 'Tomorrow' : DAY_NAMES[next]}</div>
          <div className="truncate">{items.map(w => w.name).join(' · ')}</div>
        </div>
      ) : <Link to="/workout" className="mt-1 text-sm font-medium px-3 py-1.5 rounded-full bg-[var(--line)] hover:bg-[var(--accent)] hover:text-white transition">Plan your week</Link>}
    </div>
  )
}
