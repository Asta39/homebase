/**
 * Game layer: daily rings, XP & levels, daily quests and badges — all computed from data the app already stores,
 * so nothing extra to log and nothing can drift out of sync.
 */
import { db } from './db'
import { setCount, streak, ymd } from './workout'
import { WATER_GOAL } from './wellbeing'

export const GOALS = { studyMin: 90, water: WATER_GOAL }

const cardReviews = (fsrs?: string) => { try { return fsrs ? JSON.parse(fsrs).reps ?? 0 : 0 } catch { return 0 } }
const lastReview = (fsrs?: string) => { try { return fsrs ? JSON.parse(fsrs).last_review as string | undefined : undefined } catch { return undefined } }

export type Ring = { key: 'study' | 'move' | 'mind'; label: string; value: number; goal: number; unit: string; pct: number; colors: [string, string] }
export type Quest = { id: string; icon: string; title: string; progress: number; goal: number; xp: number; done: boolean; to: string }
export type Badge = { id: string; icon: string; title: string; desc: string; progress: number; goal: number; earned: boolean }

export async function gameState(now = new Date()) {
  const today = ymd(now)
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayISO = dayStart.toISOString()

  const [focus, plan, wlogs, well, habits, hlogs, cards, quizzes, papers, topicLog] = await Promise.all([
    db.focus.toArray(), db.workouts.toArray(), db.workoutLog.toArray(), db.wellbeing.toArray(), db.habits.toArray(),
    db.habitLog.toArray(), db.flashcards.toArray(), db.quizzes.toArray(), db.attempts.toArray(), db.topicLog.toArray(),
  ])

  // ---------- today ----------
  const focusToday = focus.filter(f => f.start >= dayISO).reduce((t, f) => t + f.minutes, 0)
  const todaysPlan = plan.filter(w => w.day === now.getDay())
  const setsGoal = todaysPlan.reduce((t, w) => t + setCount(w.sets), 0)
  const setsDone = todaysPlan.reduce((t, w) => t + Math.min(setCount(w.sets), wlogs.find(l => l.date === today && l.workoutId === w.id)?.done ?? 0), 0)
  const wToday = well.find(w => w.date === today)
  const water = wToday?.water ?? 0
  const habitsDone = hlogs.filter(l => l.date === today).length
  const cardsToday = cards.filter(c => { const lr = lastReview(c.fsrs); return lr && new Date(lr) >= dayStart }).length
  const quizzesToday = quizzes.filter(q => q.date >= dayISO)

  // Mind = half water, half habits (or all water if she has no habits yet), plus a check-in nudge
  const mindGoal = 100
  const mindVal = Math.round(
    (habits.length ? 40 * Math.min(1, water / GOALS.water) + 40 * (habitsDone / habits.length) : 80 * Math.min(1, water / GOALS.water))
    + (wToday?.mood ? 10 : 0) + (wToday?.sleep != null ? 10 : 0))

  const rings: Ring[] = [
    { key: 'study', label: 'Study', value: focusToday, goal: GOALS.studyMin, unit: 'min', pct: focusToday / GOALS.studyMin, colors: ['#ff2d55', '#ff6482'] },
    { key: 'move', label: 'Move', value: setsDone, goal: setsGoal || 1, unit: setsGoal ? 'sets' : 'rest day', pct: setsGoal ? setsDone / setsGoal : 1, colors: ['#a4ff00', '#d5ff5c'] },
    { key: 'mind', label: 'Mind', value: mindVal, goal: mindGoal, unit: '%', pct: mindVal / mindGoal, colors: ['#00d8ff', '#6ef0ff'] },
  ]

  // ---------- XP (all-time) ----------
  const totalFocus = focus.reduce((t, f) => t + f.minutes, 0)
  const totalSets = wlogs.reduce((t, l) => t + l.done, 0)
  const totalReviews = cards.reduce((t, c) => t + cardReviews(c.fsrs), 0)
  const quizXp = quizzes.reduce((t, q) => t + q.score * 10, 0)
  const improved = topicLog.filter(c => ['red', 'amber', 'green'].indexOf(c.to) > ['red', 'amber', 'green'].indexOf(c.from) && c.from !== 'none').length
  const glasses = well.reduce((t, w) => t + w.water, 0)
  const xp = totalFocus * 2 + totalSets * 5 + hlogs.length * 10 + totalReviews * 3 + quizXp + papers.length * 25 + improved * 30 + glasses * 2
  const lvl = levelFor(xp)

  // ---------- daily quests (rotate by weekday so it's not the same three forever) ----------
  const pool: Quest[] = [
    { id: 'focus', icon: '🍅', title: `Focus for ${GOALS.studyMin >= 60 ? '50' : '25'} minutes`, progress: focusToday, goal: 50, xp: 50, done: focusToday >= 50, to: '/focus' },
    { id: 'cards', icon: '🃏', title: 'Review 10 flashcards', progress: cardsToday, goal: 10, xp: 40, done: cardsToday >= 10, to: '/study' },
    { id: 'quiz', icon: '❓', title: 'Score 80%+ on a quiz', progress: quizzesToday.some(q => q.score / q.total >= 0.8) ? 1 : 0, goal: 1, xp: 60, done: quizzesToday.some(q => q.score / q.total >= 0.8), to: '/study' },
    { id: 'water', icon: '💧', title: `Drink ${GOALS.water} glasses`, progress: water, goal: GOALS.water, xp: 30, done: water >= GOALS.water, to: '/wellbeing' },
    { id: 'move', icon: '💪', title: setsGoal ? 'Finish today’s workout' : 'Log a check-in', progress: setsGoal ? setsDone : (wToday?.mood ? 1 : 0), goal: setsGoal || 1, xp: 40, done: setsGoal ? setsDone >= setsGoal : !!wToday?.mood, to: setsGoal ? '/workout' : '/wellbeing' },
    { id: 'habits', icon: '✅', title: 'Tick off every habit', progress: habitsDone, goal: Math.max(1, habits.length), xp: 40, done: habits.length > 0 && habitsDone >= habits.length, to: '/wellbeing' },
  ]
  const rot = now.getDay()
  const quests = [pool[0], pool[1 + (rot % 2)], pool[3 + (rot % 3)]]

  // ---------- badges ----------
  const wStreak = streak(plan, wlogs, now)
  const hydratedDays = well.filter(w => w.water >= GOALS.water).length
  const sleepDays = well.filter(w => (w.sleep ?? 0) >= 8).length
  const bestQuiz = quizzes.reduce((m, q) => Math.max(m, q.score / q.total), 0)
  const b = (id: string, icon: string, title: string, desc: string, progress: number, goal: number): Badge =>
    ({ id, icon, title, desc, progress: Math.min(progress, goal), goal, earned: progress >= goal })
  const badges: Badge[] = [
    b('first', '🍅', 'First Focus', 'Finish a focus session', focus.length, 1),
    b('deep', '⏱️', 'Deep Worker', 'Focus for 10 hours in total', Math.floor(totalFocus / 60), 10),
    b('fire', '🔥', 'On Fire', 'A 7-day workout streak', wStreak, 7),
    b('hydro', '💧', 'Hydrated', 'Hit your water goal on 7 days', hydratedDays, 7),
    b('sleep', '🌙', 'Well Rested', '8h+ sleep on 5 nights', sleepDays, 5),
    b('whiz', '🧠', 'Quiz Whiz', 'Score 100% on a quiz', bestQuiz >= 1 ? 1 : 0, 1),
    b('cards', '🃏', 'Card Shark', 'Do 100 flashcard reviews', totalReviews, 100),
    b('climb', '📈', 'Climber', 'Move 5 topics up a colour', improved, 5),
    b('exam', '📝', 'Examiner', 'Mark 5 past-paper answers', papers.length, 5),
  ]

  return { rings, xp, ...lvl, quests, badges, focusToday, cardsToday }
}

/** Gentle curve: level n needs 100·n·(n+1)/2 XP → L2 at 100, L5 at 1000, L10 at 4500. */
export function levelFor(xp: number) {
  let level = 1
  while (100 * level * (level + 1) / 2 <= xp) level++
  const floor = 100 * (level - 1) * level / 2, ceil = 100 * level * (level + 1) / 2
  const titles = ['Starter', 'Learner', 'Explorer', 'Achiever', 'Scholar', 'Expert', 'Master', 'Legend']
  return { level, title: titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))], into: xp - floor, need: ceil - floor }
}
