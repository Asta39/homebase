import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { ymd } from '../lib/workout'
import { MOODS, MOOD_LABELS, SLEEP_GOAL, WATER_GOAL, toggleHabit, updateDay } from '../lib/wellbeing'

/** Today's check-in: mood, sleep, water, habits. Big tap targets so it works on a kitchen touchscreen. */
export default function CheckIn({ compact = false }: { compact?: boolean }) {
  const date = ymd(new Date())
  const day = useLiveQuery(() => db.wellbeing.get(date), [date])
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray()) ?? []
  const done = useLiveQuery(() => db.habitLog.where('date').equals(date).toArray(), [date]) ?? []
  const water = day?.water ?? 0
  const isDone = (id: number) => done.some(d => d.habitId === id)

  return (
    <div className={compact ? 'grid gap-x-8 gap-y-3 lg:grid-cols-3 items-center' : 'panel p-5 space-y-4'}>
      <div className="flex items-baseline col-span-full">
        <h2 className="font-semibold">{compact ? 'Wellbeing' : 'Today’s check-in'}</h2>
        {compact && <Link to="/wellbeing" className="ml-auto text-xs text-[var(--accent)]">Trends →</Link>}
      </div>

      <div>
        {!compact && <div className="muted text-sm mb-1">How are you feeling?</div>}
        <div className="flex justify-between gap-1">
          {MOODS.map((m, i) => (
            <button key={i} title={MOOD_LABELS[i]} onClick={() => updateDay(date, { mood: day?.mood === i + 1 ? undefined : i + 1 })}
              className={`text-2xl rounded-xl px-2 py-1 transition ${day?.mood === i + 1 ? 'bg-[var(--accent)]/20 scale-110' : day?.mood ? 'opacity-35 hover:opacity-80' : 'hover:bg-[var(--line)]'}`}>{m}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-lg">💧</span>
        <div className="flex gap-1 flex-1 min-w-0">
          {Array.from({ length: WATER_GOAL }, (_, i) => (
            <button key={i} aria-label={`${i + 1} glasses`} onClick={() => updateDay(date, { water: water === i + 1 ? i : i + 1 })}
              className={`flex-1 max-w-5 min-w-2.5 h-7 rounded-b-md rounded-t-sm border-2 transition ${i < water ? 'bg-sky-400 border-sky-400' : 'border-[var(--line)] hover:border-sky-400'}`} />
          ))}
        </div>
        <span className="text-sm tabular-nums muted">{water}/{WATER_GOAL}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-lg">😴</span>
        <button className="w-7 h-7 rounded-full hover:bg-[var(--line)]" aria-label="Less sleep" onClick={() => updateDay(date, { sleep: Math.max(0, (day?.sleep ?? SLEEP_GOAL) - 0.5) })}>−</button>
        <span className={`tabular-nums font-semibold w-12 text-center ${day?.sleep == null ? 'muted' : day.sleep < 7 ? 'text-amber-500' : ''}`}>{day?.sleep == null ? '–' : `${day.sleep}h`}</span>
        <button className="w-7 h-7 rounded-full hover:bg-[var(--line)]" aria-label="More sleep" onClick={() => updateDay(date, { sleep: Math.min(14, (day?.sleep ?? SLEEP_GOAL - 0.5) + 0.5) })}>+</button>
        <span className="muted text-xs">{day?.sleep == null ? 'sleep last night' : day.sleep < 7 ? 'try for 8+' : 'nice'}</span>
      </div>

      {habits.length > 0 && <div className="flex flex-wrap gap-2 col-span-full">
        {habits.map(h => (
          <button key={h.id} onClick={() => toggleHabit(date, h.id!)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${isDone(h.id!) ? 'bg-green-500 border-green-500 text-white' : 'border-[var(--line)] hover:border-green-500'}`}>
            {h.icon} {h.name}{isDone(h.id!) ? ' ✓' : ''}
          </button>
        ))}
      </div>}
    </div>
  )
}
