import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { dayStatus, streak, ymd, type DayStatus } from '../lib/workout'
import { confirmBox, form } from '../components/Dialog'
import Flame from '../components/Flame'
import TodayWorkout from '../components/TodayWorkout'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CELL: Record<DayStatus, string> = {
  done: 'bg-green-500', partial: 'bg-green-500/40', missed: 'bg-red-500/30', rest: 'bg-[var(--line)]', future: 'border border-[var(--line)]',
}

export default function Workout() {
  const all = useLiveQuery(() => db.workouts.toArray()) ?? []
  const logs = useLiveQuery(() => db.workoutLog.toArray()) ?? []
  const add = async (day: number) => {
    const v = await form({ title: `Add to ${DAYS[day]}`, submit: 'Add', fields: [
      { name: 'name', label: 'Exercise', placeholder: 'e.g. Squats', required: true },
      { name: 'sets', label: 'Sets × reps', placeholder: 'e.g. 3×12 (or "20 min")' },
    ] })
    if (v) db.workouts.add({ day, name: v.name.trim(), sets: v.sets.trim() })
  }
  const remove = async (id: number, name: string) => {
    if (await confirmBox(`Remove ${name}?`, 'Its ticked sets are removed too.')) {
      await db.workoutLog.where('workoutId').equals(id).delete(); await db.workouts.delete(id)
    }
  }

  // Last 5 weeks, Monday-first grid
  const today = new Date()
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 28)
  const weeks = Array.from({ length: 5 }, (_, w) => Array.from({ length: 7 }, (_, d) => { const x = new Date(monday); x.setDate(monday.getDate() + w * 7 + d); return x }))
  const best = (() => { // longest streak in the shown window
    let b = 0, cur = 0
    weeks.flat().forEach(d => { const s = dayStatus(d, all, logs, today); if (s === 'done') b = Math.max(b, ++cur); else if (s !== 'rest' && s !== 'future' && ymd(d) !== ymd(today)) cur = 0 })
    return b
  })()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Workout</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <TodayWorkout />
        <section className="panel p-5">
          <div className="flex items-baseline gap-3 mb-3">
            <h2 className="font-semibold">Last 5 weeks</h2>
            <span className="muted text-sm inline-flex items-center gap-1"><Flame size={16} />{streak(all, logs, today)} now · best {best}</span>
          </div>
          <div className="max-w-sm"><div className="grid grid-cols-7 gap-1.5 text-center text-xs muted mb-1">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-1.5">
            {weeks.flat().map(d => {
              const s = dayStatus(d, all, logs, today)
              return <div key={ymd(d)} title={`${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}: ${s}`}
                className={`aspect-square rounded-md ${CELL[s]} ${ymd(d) === ymd(today) ? 'ring-2 ring-[var(--accent)]' : ''}`} />
            })}
          </div></div>
          <div className="flex gap-3 mt-3 text-xs muted flex-wrap">
            {(['done', 'partial', 'missed', 'rest'] as const).map(s => <span key={s} className="flex items-center gap-1"><span className={`w-3 h-3 rounded ${CELL[s]}`} />{s}</span>)}
          </div>
        </section>
      </div>

      <h2 className="font-semibold pt-2">Weekly plan</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[1, 2, 3, 4, 5, 6, 0].map(d => (
          <div key={d} className={`panel p-3 min-h-36 ${d === today.getDay() ? 'ring-2 ring-[var(--accent)]' : ''}`}>
            <div className="font-semibold mb-2">{DAYS[d]}</div>
            {all.filter(w => w.day === d).map(w => (
              <div key={w.id} className="text-sm mb-1 cursor-pointer group flex gap-1" title="Click to remove" onClick={() => remove(w.id!, w.name)}>
                <span className="flex-1">{w.name} <span className="muted">{w.sets}</span></span>
                <span className="opacity-0 group-hover:opacity-100 muted">✕</span>
              </div>
            ))}
            {!all.some(w => w.day === d) && <div className="muted text-sm">Rest</div>}
            <button className="text-sm text-[var(--accent)] mt-2" onClick={() => add(d)}>+ add</button>
          </div>
        ))}
      </div>
    </div>
  )
}
