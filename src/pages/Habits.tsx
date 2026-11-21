import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { db, type Habit } from '../lib/db'
import { ymd } from '../lib/workout'
import { toggleHabit, STARTER_HABITS } from '../lib/wellbeing'
import { HABIT_COLORS, HABIT_ICONS, HABIT_LEVELS, iconFor, SCHEDULES, habitStats, nextMilestone, perfectDays, scheduleLabel, scheduleOf, type HabitStat } from '../lib/habits'
import { XP_RULES } from '../lib/gamify'
import { confirmBox, form } from '../components/Dialog'
import HabitIcon from '../components/HabitIcon'

const Img = ({ src, size }: { src: string; size: number }) =>
  <img src={`${import.meta.env.BASE_URL}${src}.png`} alt="" style={{ width: size, height: size }} className="object-contain shrink-0" />

const COLOR_NAMES = ['Orange', 'Pink', 'Green', 'Teal', 'Yellow', 'Rose', 'Sky', 'Mocha']
const WEEKS = 26

export default function Habits() {
  const now = new Date(), today = ymd(now)
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray()) ?? []
  const logs = useLiveQuery(() => db.habitLog.toArray()) ?? []
  const [pops, setPops] = useState<Record<number, number>>({})
  const stats = habitStats(habits, logs, now)
  const due = stats.filter(s => s.dueToday), resting = stats.filter(s => !s.dueToday)
  const doneCount = due.filter(s => s.doneToday).length

  // Perfect-day streak (every habit due that day done)
  const from = new Date(now); from.setDate(now.getDate() - 120)
  const perfect = perfectDays(habits, logs, from, now)
  let perfectStreak = 0
  for (let i = 0; i < 120; i++) { const d = new Date(now); d.setDate(now.getDate() - i); if (perfect.has(ymd(d))) perfectStreak++; else if (i) break }
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(now.getDate() - 6 + i); return d })

  const tick = async (s: HabitStat) => {
    if (!s.doneToday) setPops(p => ({ ...p, [s.habit.id!]: Date.now() }))
    await toggleHabit(today, s.habit.id!)
  }

  const edit = async (h?: Habit) => {
    const v = await form({
      title: h ? 'Edit habit' : 'New habit', submit: h ? 'Save' : 'Add',
      extra: h ? { label: 'Delete', action: 'delete' } : undefined,
      fields: [
        { name: 'name', label: 'Habit', value: h?.name, placeholder: 'e.g. Stretch before bed', required: true },
        { name: 'icon', label: 'Icon', type: 'select', value: h ? iconFor(h.icon, h.name) : 'read', options: HABIT_ICONS.map(i => ({ value: i.key, label: i.label })) },
        { name: 'days', label: 'When', type: 'select', value: h ? scheduleOf(h) : 'daily', options: SCHEDULES.map(s => ({ value: s.value, label: s.label })) },
        { name: 'color', label: 'Colour', type: 'select', value: h?.color ?? HABIT_COLORS[habits.length % HABIT_COLORS.length], options: HABIT_COLORS.map((c, i) => ({ value: c, label: COLOR_NAMES[i] })) },
      ],
    })
    if (!v) return
    if (v._action === 'delete' && h) return remove(h)
    const patch = { name: v.name.trim(), icon: v.icon, color: v.color, days: SCHEDULES.find(s => s.value === v.days)!.days }
    if (h) await db.habits.update(h.id!, patch)
    else await db.habits.add({ ...patch, order: habits.length, created: today })
  }
  const remove = async (h: Habit) => {
    if (await confirmBox(`Remove “${h.name}”?`, 'Its history is removed too.')) { await db.habitLog.where('habitId').equals(h.id!).delete(); await db.habits.delete(h.id!) }
  }
  const addStarters = () => db.habits.bulkAdd(STARTER_HABITS.map((h, i) => ({ ...h, order: i, color: HABIT_COLORS[i], created: today })))

  const pct = due.length ? doneCount / due.length : 0
  const R = 34, C = 2 * Math.PI * R

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Hero */}
      <section className="panel p-5 sm:p-6 flex flex-wrap items-center gap-6">
        <div className="relative w-[88px] h-[88px] shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r={R} fill="none" stroke="var(--line)" strokeWidth="8" />
            <circle cx="40" cy="40" r={R} fill="none" stroke="#34c759" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1)' }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center leading-none">
            <div><div className="text-xl font-bold tabular-nums">{doneCount}/{due.length}</div><div className="text-[10px] muted mt-0.5">today</div></div>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-2xl font-bold">Habits</h1>
          <p className="muted text-sm mt-0.5">
            {!habits.length ? 'Small things, every day. Start with one.'
              : !due.length ? 'Nothing due today. Enjoy the rest.'
              : doneCount === due.length ? 'Perfect day! Every habit done.'
              : `${due.length - doneCount} to go · +${XP_RULES.habit} XP each`}
          </p>
          <div className="flex gap-1.5 mt-3">
            {week.map(d => {
              const k = ymd(d), on = perfect.has(k), isToday = k === today
              return <div key={k} className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full grid place-items-center text-[11px] font-bold ${on ? 'bg-[#34c759] text-white' : isToday ? 'border-2 border-dashed border-[var(--line)]' : 'bg-[var(--line)]'}`}>{on ? <Check size={14} strokeWidth={3} /> : ''}</div>
                <span className={`text-[10px] ${isToday ? 'font-bold' : 'muted'}`}>{'SMTWTFS'[d.getDay()]}</span>
              </div>
            })}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Stat big={`${perfectStreak}`} label="perfect-day streak" icon="achievements/wildfire" />
          <Stat big={`${logs.length}`} label="check-ins" icon="achievements/habits" />
          <Stat big={`${logs.length * XP_RULES.habit}`} label="XP from habits" icon="achievements/sage" />
        </div>
      </section>

      {/* Today */}
      <section className="space-y-2">
        <div className="flex items-center px-1">
          <h2 className="font-semibold">Today</h2>
          <button className="btn text-sm ml-auto flex items-center gap-1" onClick={() => edit()}><Plus size={16} /> Habit</button>
        </div>
        {!habits.length && <div className="panel p-6 text-center space-y-3">
          <HabitIcon name="stage-1" size={64} className="mx-auto" />
          <p className="muted text-sm">Each habit grows from a seed into an oak as you keep it up, and streaks earn gems.</p>
          <button className="btn text-sm" onClick={addStarters}>Add 3 suggestions</button>
        </div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {due.map(s => <Tile key={s.habit.id} s={s} pop={pops[s.habit.id!]} onTick={() => tick(s)} />)}
        </div>
        {resting.length > 0 && <div className="flex flex-wrap gap-2 pt-1 px-1 items-center">
          <span className="text-xs muted">Resting today:</span>
          {resting.map(s => <span key={s.habit.id} className="text-xs pl-1 pr-2.5 py-0.5 rounded-full bg-[var(--line)] inline-flex items-center gap-1"><HabitIcon name={s.habit.icon} habitName={s.habit.name} size={18} />{s.habit.name}</span>)}
        </div>}
      </section>

      {/* Garden */}
      {habits.length > 0 && <section className="space-y-2">
        <div className="flex items-baseline px-1 gap-2">
          <h2 className="font-semibold">Your garden</h2>
          <span className="flex items-center gap-0.5">{HABIT_LEVELS.map(l => <HabitIcon key={l.icon} name={l.icon} size={20} />)}</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {stats.map(s => <GardenCard key={s.habit.id} s={s} onEdit={() => edit(s.habit)} onRemove={() => remove(s.habit)} />)}
        </div>
      </section>}
    </div>
  )
}

function Stat({ big, label, icon }: { big: string; label: string; icon: string }) {
  return <div className="rounded-2xl bg-[var(--line)]/60 px-4 py-2.5 min-w-[92px]">
    <div className="text-lg font-bold tabular-nums flex items-center gap-1.5"><Img src={icon} size={22} />{big}</div>
    <div className="text-[11px] muted">{label}</div>
  </div>
}

function Tile({ s, pop, onTick }: { s: HabitStat; pop?: number; onTick: () => void }) {
  const c = s.habit.color ?? HABIT_COLORS[0]
  const ms = nextMilestone(s.streak)
  return (
    <button onClick={onTick} aria-pressed={s.doneToday}
      className="panel relative text-left p-4 flex items-center gap-3 transition active:scale-[.98] overflow-visible"
      style={s.doneToday ? { background: `color-mix(in srgb, ${c} 16%, var(--panel))`, borderColor: `color-mix(in srgb, ${c} 45%, transparent)` } : undefined}>
      <div key={pop} className={`w-12 h-12 rounded-2xl grid place-items-center text-2xl shrink-0 ${pop ? 'habit-pop' : ''}`}
        style={{ background: `color-mix(in srgb, ${c} 20%, transparent)` }}><HabitIcon name={s.habit.icon} habitName={s.habit.name} size={38} /></div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold truncate ${s.doneToday ? 'opacity-80' : ''}`}>{s.habit.name}</div>
        <div className="text-xs muted flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="inline-flex items-center gap-1"><HabitIcon name={s.level.icon} size={16} />{s.level.name}</span>
          {s.streak > 0 && <span className="font-semibold inline-flex items-center gap-0.5" style={{ color: '#ff9500' }}><Img src="achievements/wildfire" size={15} />{s.streak}</span>}
          {!s.doneToday && ms && s.streak > 0 && ms.days - s.streak <= 2 && <span className="inline-flex items-center gap-0.5">· {ms.days - s.streak} to +{ms.gems}<HabitIcon name="gem" size={14} /></span>}
        </div>
      </div>
      <div className="w-8 h-8 rounded-full grid place-items-center shrink-0 transition"
        style={s.doneToday ? { background: c, color: '#fff' } : { border: '2px solid var(--line)' }}>
        {s.doneToday && <Check size={18} strokeWidth={3} />}
      </div>
      {pop && <span key={`x${pop}`} className="habit-xp absolute right-4 -top-1 text-sm font-bold pointer-events-none" style={{ color: c }}>+{XP_RULES.habit} XP</span>}
    </button>
  )
}

function GardenCard({ s, onEdit, onRemove }: { s: HabitStat; onEdit: () => void; onRemove: () => void }) {
  const c = s.habit.color ?? HABIT_COLORS[0]
  const now = new Date()
  // Heatmap: WEEKS columns × 7 rows, ending this week
  const end = new Date(now); end.setDate(now.getDate() + (6 - now.getDay()))
  const cols = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const x = new Date(end); x.setDate(end.getDate() - (WEEKS - 1 - w) * 7 - (6 - d)); return x
  }))
  const ms = nextMilestone(s.streak)
  return (
    <div className="panel p-4 space-y-3 group">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl grid place-items-center" style={{ background: `color-mix(in srgb, ${c} 20%, transparent)` }}><HabitIcon name={s.habit.icon} habitName={s.habit.name} size={34} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{s.habit.name}</div>
          <div className="text-xs muted">{scheduleLabel(s.habit)}</div>
        </div>
        <button className="w-8 h-8 rounded-full grid place-items-center muted hover:bg-[var(--line)] opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={onEdit} aria-label="Edit"><Pencil size={15} /></button>
        <button className="w-8 h-8 rounded-full grid place-items-center muted hover:bg-[var(--line)] opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={onRemove} aria-label="Remove"><Trash2 size={15} /></button>
      </div>

      {/* Level */}
      <div>
        <div className="flex items-center text-xs mb-1">
          <span className="font-semibold inline-flex items-center gap-1"><HabitIcon name={s.level.icon} size={20} />{s.level.name}</span>
          <span className="ml-auto muted inline-flex items-center gap-1">{s.level.next ? <>{s.level.toNext} more to <HabitIcon name={s.level.next.icon} size={18} />{s.level.next.name}</> : 'Fully grown'}</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${s.level.pct * 100}%`, background: c, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div><div className="font-bold tabular-nums inline-flex items-center gap-1"><Img src="achievements/wildfire" size={18} />{s.streak}</div><div className="text-[11px] muted">streak</div></div>
        <div><div className="font-bold tabular-nums">{s.best}</div><div className="text-[11px] muted">best</div></div>
        <div><div className="font-bold tabular-nums">{Math.round(s.rate30 * 100)}%</div><div className="text-[11px] muted">last 30 days</div></div>
      </div>

      <div className="flex gap-[3px] overflow-hidden justify-end" dir="ltr">
        {cols.map((col, i) => <div key={i} className="flex flex-col gap-[3px] shrink-0">
          {col.map(d => {
            const k = ymd(d), future = d > now
            return <div key={k} title={d.toLocaleDateString()} className="w-[11px] h-[11px] rounded-[3px]"
              style={{ background: future ? 'transparent' : s.done.has(k) ? c : 'var(--line)' }} />
          })}
        </div>)}
      </div>

      {ms && <div className="text-xs muted">Next badge: <b className="text-[var(--text)]">{ms.days}-day streak</b> · {ms.days - s.streak} to go · <span className="inline-flex items-center gap-0.5 align-middle">+{ms.gems}<HabitIcon name="gem" size={14} /></span></div>}
    </div>
  )
}
