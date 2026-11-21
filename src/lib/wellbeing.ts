import { db, type DayCheck } from './db'

export const WATER_GOAL = 8 // glasses
export const SLEEP_GOAL = 8 // hours — teenagers need 8–10
export const MOODS = ['😫', '😕', '😐', '🙂', '😄'] as const
export const MOOD_LABELS = ['Awful', 'Low', 'Okay', 'Good', 'Great'] as const

export async function updateDay(date: string, patch: Partial<Omit<DayCheck, 'date'>>) {
  const cur = await db.wellbeing.get(date)
  await db.wellbeing.put({ water: 0, ...cur, ...patch, date })
}

export async function toggleHabit(date: string, habitId: number) {
  const row = await db.habitLog.where('[date+habitId]').equals([date, habitId]).first()
  if (row) await db.habitLog.delete(row.id!)
  else await db.habitLog.add({ date, habitId })
}

/** Days in a row (ending today, or yesterday if today isn't ticked yet) a habit was done. */
export function habitStreak(dates: Set<string>, today: Date, key: (d: Date) => string) {
  let n = 0
  for (let i = 0; i < 400; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    if (dates.has(key(d))) n++
    else if (i === 0) continue
    else break
  }
  return n
}

export const STARTER_HABITS = [
  { name: 'Read 20 minutes', icon: '📖' },
  { name: 'No phone after 10pm', icon: '📵' },
  { name: 'Fresh air / walk', icon: '🚶' },
]
