import type { Habit, HabitLog } from './db'
import { ymd } from './workout'

/** Warm, Apple-ish palette (no AI blue/purple first) */
export const HABIT_COLORS = ['#ff9500', '#ff2d55', '#34c759', '#00c7be', '#ffcc00', '#ff6482', '#5ac8fa', '#a2845e']

export const SCHEDULES: { value: string; label: string; days: number[] }[] = [
  { value: 'daily', label: 'Every day', days: [] },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)', days: [1, 2, 3, 4, 5] },
  { value: 'weekends', label: 'Weekends', days: [0, 6] },
  { value: 'mwf', label: 'Mon, Wed, Fri', days: [1, 3, 5] },
  { value: 'tts', label: 'Tue, Thu, Sat', days: [2, 4, 6] },
]
export const scheduleOf = (h: Habit) => SCHEDULES.find(s => s.days.join() === (h.days ?? []).join())?.value ?? 'daily'
export const scheduleLabel = (h: Habit) => SCHEDULES.find(s => s.value === scheduleOf(h))!.label
export const dueOn = (h: Habit, d: Date) => !h.days?.length || h.days.includes(d.getDay())

/** Generated 3D icons in public/habits/<key>.png */
export const HABIT_ICONS: { key: string; label: string; words: string[] }[] = [
  { key: 'read', label: 'Reading', words: ['read', 'book', 'novel'] },
  { key: 'phone', label: 'Phone down', words: ['phone', 'screen', 'scroll', 'social'] },
  { key: 'walk', label: 'Walk / run', words: ['walk', 'run', 'step', 'air', 'outside', 'jog'] },
  { key: 'stretch', label: 'Stretch / yoga', words: ['stretch', 'yoga', 'exercise', 'workout', 'gym'] },
  { key: 'journal', label: 'Journal', words: ['journal', 'write', 'diary', 'gratitude'] },
  { key: 'meditate', label: 'Meditate', words: ['meditat', 'breath', 'calm', 'mindful', 'pray'] },
  { key: 'eat', label: 'Eat well', words: ['eat', 'fruit', 'veg', 'food', 'breakfast', 'healthy'] },
  { key: 'teeth', label: 'Skincare / teeth', words: ['teeth', 'floss', 'brush', 'skin'] },
  { key: 'music', label: 'Music / practice', words: ['music', 'piano', 'guitar', 'practice', 'sing'] },
  { key: 'water', label: 'Water', words: ['water', 'drink', 'hydrat'] },
  { key: 'bed', label: 'Sleep / make bed', words: ['bed', 'sleep', 'nap'] },
  { key: 'sunrise', label: 'Early start', words: ['early', 'wake', 'morning', 'alarm'] },
]
/** Resolve a stored icon (key, or an old emoji) to an icon key, guessing from the habit's name if needed */
export function iconFor(icon: string, name = '') {
  if (HABIT_ICONS.some(i => i.key === icon)) return icon
  const n = name.toLowerCase()
  return HABIT_ICONS.find(i => i.words.some(w => n.includes(w)))?.key ?? 'stage-1'
}

/** A habit grows like a plant the more often it's done */
export const HABIT_LEVELS = [
  { at: 0, name: 'Seed', icon: 'stage-0' },
  { at: 5, name: 'Sprout', icon: 'stage-1' },
  { at: 15, name: 'Sapling', icon: 'stage-2' },
  { at: 30, name: 'Bloom', icon: 'stage-3' },
  { at: 60, name: 'Tree', icon: 'stage-4' },
  { at: 100, name: 'Ancient Oak', icon: 'stage-5' },
]
export function habitLevel(total: number) {
  let i = 0; HABIT_LEVELS.forEach((l, n) => { if (total >= l.at) i = n })
  const cur = HABIT_LEVELS[i], next = HABIT_LEVELS[i + 1]
  return { index: i, ...cur, next, pct: next ? (total - cur.at) / (next.at - cur.at) : 1, toNext: next ? next.at - total : 0 }
}

/** Streak milestones and the gems they pay (once per habit per milestone) */
export const STREAK_MILESTONES = [{ days: 3, gems: 5 }, { days: 7, gems: 15 }, { days: 14, gems: 25 }, { days: 30, gems: 50 }, { days: 60, gems: 75 }, { days: 100, gems: 150 }]
export const nextMilestone = (streak: number) => STREAK_MILESTONES.find(m => m.days > streak)

/** Streak counting only the days the habit is due. Today doesn't break it until it's over. */
export function streakOf(h: Habit, done: Set<string>, today = new Date()) {
  let cur = 0, best = 0, run = 0, counting = true
  for (let i = 0; i < 400; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i)
    if (!dueOn(h, d)) continue
    if (done.has(ymd(d))) { run++; if (counting) cur++ }
    else { if (i !== 0) counting = false; best = Math.max(best, run); run = 0 }
  }
  return { current: cur, best: Math.max(best, run, cur) }
}

export interface HabitStat { habit: Habit; done: Set<string>; total: number; doneToday: boolean; dueToday: boolean; streak: number; best: number; level: ReturnType<typeof habitLevel>; rate30: number }

export function habitStats(habits: Habit[], logs: HabitLog[], now = new Date()): HabitStat[] {
  const today = ymd(now)
  return habits.map(h => {
    const done = new Set(logs.filter(l => l.habitId === h.id).map(l => l.date))
    const { current, best } = streakOf(h, done, now)
    let due = 0, hit = 0
    for (let i = 0; i < 30; i++) { const d = new Date(now); d.setDate(now.getDate() - i); if (dueOn(h, d)) { due++; if (done.has(ymd(d))) hit++ } }
    return { habit: h, done, total: done.size, doneToday: done.has(today), dueToday: dueOn(h, now), streak: current, best, level: habitLevel(done.size), rate30: due ? hit / due : 0 }
  })
}

/** Days where every habit due that day was done (needs at least one due) */
export function perfectDays(habits: Habit[], logs: HabitLog[], from: Date, to: Date) {
  const by = new Map<string, Set<number>>()
  logs.forEach(l => { if (!by.has(l.date)) by.set(l.date, new Set()); by.get(l.date)!.add(l.habitId) })
  const out = new Set<string>()
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const due = habits.filter(h => dueOn(h, d) && (!h.created || h.created <= ymd(d)))
    if (due.length && due.every(h => by.get(ymd(d))?.has(h.id!))) out.add(ymd(d))
  }
  return out
}
