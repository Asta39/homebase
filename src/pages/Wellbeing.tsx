import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { ymd } from '../lib/workout'
import { MOODS, SLEEP_GOAL, STARTER_HABITS, WATER_GOAL, habitStreak } from '../lib/wellbeing'
import { confirmBox, form } from '../components/Dialog'
import CheckIn from '../components/CheckIn'

const DAYS = 14

export default function Wellbeing() {
  const today = new Date()
  const dates = Array.from({ length: DAYS }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - (DAYS - 1 - i)); return d })
  const rows = useLiveQuery(() => db.wellbeing.where('date').between(ymd(dates[0]), ymd(today), true, true).toArray()) ?? []
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray()) ?? []
  const logs = useLiveQuery(() => db.habitLog.toArray()) ?? []
  const get = (d: Date) => rows.find(r => r.date === ymd(d))

  const slept = rows.filter(r => r.sleep != null)
  const avgSleep = slept.length ? slept.reduce((t, r) => t + r.sleep!, 0) / slept.length : null
  const moods = rows.filter(r => r.mood)
  const avgMood = moods.length ? moods.reduce((t, r) => t + r.mood!, 0) / moods.length : null
  // Simple insight: mood after good vs short sleep
  const both = rows.filter(r => r.sleep != null && r.mood)
  const good = both.filter(r => r.sleep! >= SLEEP_GOAL), short = both.filter(r => r.sleep! < 7)
  const avg = (a: typeof both) => a.reduce((t, r) => t + r.mood!, 0) / a.length
  const insight = good.length >= 2 && short.length >= 2 && avg(good) - avg(short) >= 0.5
    ? `On days after 8h+ sleep your mood averages ${MOODS[Math.round(avg(good)) - 1]}, vs ${MOODS[Math.round(avg(short)) - 1]} after under 7h.` : null

  const addHabit = async () => {
    const v = await form({ title: 'New habit', submit: 'Add', fields: [
      { name: 'name', label: 'Habit', placeholder: 'e.g. Stretch before bed', required: true },
      { name: 'icon', label: 'Emoji', value: '✅' },
    ] })
    if (v) db.habits.add({ name: v.name.trim(), icon: v.icon.trim() || '✅', order: habits.length })
  }
  const removeHabit = async (id: number, name: string) => {
    if (await confirmBox(`Remove “${name}”?`, 'Its history is removed too.')) { await db.habitLog.where('habitId').equals(id).delete(); await db.habits.delete(id) }
  }

  const bar = (v: number, max: number, cls: string, label: string) => (
    <div className="flex-1 flex flex-col items-center justify-end h-24 gap-1" title={label}>
      <div className={`w-full max-w-5 rounded-t ${cls}`} style={{ height: `${Math.min(100, (v / max) * 100)}%`, minHeight: v ? 3 : 0 }} />
    </div>
  )
  const dayLabels = <div className="flex gap-1 mt-1">{dates.map(d => <span key={ymd(d)} className="flex-1 text-center text-[10px] muted">{'SMTWTFS'[d.getDay()]}</span>)}</div>

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Wellbeing</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <CheckIn />
        <section className="panel p-5 space-y-2">
          <h2 className="font-semibold">Last 2 weeks</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-2xl font-semibold">{avgSleep ? `${avgSleep.toFixed(1)}h` : '–'}</div><div className="muted">avg sleep</div></div>
            <div><div className="text-2xl">{avgMood ? MOODS[Math.round(avgMood) - 1] : '–'}</div><div className="muted">avg mood</div></div>
          </div>
          {insight && <p className="text-sm rounded-lg bg-[var(--accent)]/10 p-2">💡 {insight}</p>}
          <p className="muted text-xs">Exams go better with sleep: aim for {SLEEP_GOAL}–10 hours and {WATER_GOAL} glasses of water.</p>
        </section>
      </div>

      <section className="panel p-5 space-y-5">
        <div>
          <div className="text-sm font-medium mb-1">😴 Sleep <span className="muted font-normal">· line = {SLEEP_GOAL}h</span></div>
          <div className="relative">
            <div className="absolute inset-x-0 border-t border-dashed border-[var(--muted)] opacity-50" style={{ bottom: `${(SLEEP_GOAL / 12) * 96}px` }} />
            <div className="flex gap-1">{dates.map(d => { const s = get(d)?.sleep ?? 0; return <div key={ymd(d)} className="flex-1 flex">{bar(s, 12, s && s < 7 ? 'bg-amber-500' : 'bg-indigo-500', `${s}h`)}</div> })}</div>
          </div>
          {dayLabels}
        </div>
        <div>
          <div className="text-sm font-medium mb-1">💧 Water</div>
          <div className="flex gap-1">{dates.map(d => { const w = get(d)?.water ?? 0; return <div key={ymd(d)} className="flex-1 flex">{bar(w, WATER_GOAL, w >= WATER_GOAL ? 'bg-sky-400' : 'bg-sky-400/50', `${w} glasses`)}</div> })}</div>
          {dayLabels}
        </div>
        <div>
          <div className="text-sm font-medium mb-1">🙂 Mood</div>
          <div className="flex gap-1">{dates.map(d => <span key={ymd(d)} className="flex-1 text-center text-lg">{get(d)?.mood ? MOODS[get(d)!.mood! - 1] : <span className="muted text-xs">·</span>}</span>)}</div>
        </div>
      </section>

      <Link to="/habits" className="panel p-5 flex items-center gap-4 hover:brightness-105 transition">
        <div className="text-3xl">🌱</div>
        <div className="flex-1">
          <div className="font-semibold">Habits</div>
          <div className="text-sm muted">{habits.length ? `${habits.length} habit${habits.length === 1 ? '' : 's'} growing · streaks, levels and gems` : 'Build small daily habits that grow from seeds into oaks'}</div>
        </div>
        <span className="muted">›</span>
      </Link>
    </div>
  )
}
