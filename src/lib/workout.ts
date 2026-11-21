import { db, type Workout, type WorkoutLog } from './db'

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** "3×12", "3x12", "4 x 10", "3 sets" → 3. Plain "20 min" / "" → 1 (one tick = done). */
export function setCount(sets: string) {
  const m = sets.match(/^\s*(\d+)\s*(?:[x×*]|sets?\b)/i)
  return m ? Math.min(12, Math.max(1, Number(m[1]))) : 1
}

export type DayStatus = 'done' | 'partial' | 'missed' | 'rest' | 'future'

/** Status of one date given the weekly plan and logs. */
export function dayStatus(date: Date, plan: Workout[], logs: WorkoutLog[], today = new Date()): DayStatus {
  const key = ymd(date), todayKey = ymd(today)
  if (key > todayKey) return 'future'
  // Before her first ever ticked set there's nothing to have "missed"
  const first = logs.reduce<string | null>((m, l) => (l.done > 0 && (!m || l.date < m) ? l.date : m), null)
  if (key !== todayKey && (!first || key < first)) return 'future'
  const todays = plan.filter(w => w.day === date.getDay())
  if (!todays.length) return 'rest'
  const total = todays.reduce((t, w) => t + setCount(w.sets), 0)
  const done = todays.reduce((t, w) => t + Math.min(setCount(w.sets), logs.find(l => l.date === key && l.workoutId === w.id)?.done ?? 0), 0)
  if (done >= total) return 'done'
  if (done > 0) return 'partial'
  return key === todayKey ? 'future' : 'missed' // today isn't missed until it's over
}

/**
 * Streak = workout days completed in a row. Rest days don't break it.
 * Today only counts once finished, and an unfinished today doesn't break it yet.
 */
export function streak(plan: Workout[], logs: WorkoutLog[], today = new Date()) {
  let n = 0
  for (let i = 0; i < 400; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    const s = dayStatus(d, plan, logs, today)
    if (s === 'done') n++
    else if (s === 'rest') continue
    else if (i === 0) continue // today still in progress
    else break
  }
  return n
}

/** Tick a set: clicking set k marks sets 1..k done; clicking the last done set un-ticks it. */
export async function tickSet(date: string, w: Workout, k: number) {
  const log = await db.workoutLog.where('[date+workoutId]').equals([date, w.id!]).first()
  const current = log?.done ?? 0
  const next = current === k ? k - 1 : k
  if (log) await db.workoutLog.update(log.id!, { done: next })
  else await db.workoutLog.add({ date, workoutId: w.id!, done: next })
}
