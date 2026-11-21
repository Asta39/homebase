/**
 * Game layer (Duolingo-style), computed from data the app already stores so it can never drift:
 *  - XP per day from real actions, a daily XP goal, and a 🔥 streak of goal days (saved by ❄️ freezes)
 *  - levels, 💎 gems (from quests, level-ups and achievement tiers), a small shop
 *  - 3 rotating daily quests, a solo weekly league, and tiered achievements (Bronze → Legend)
 *  - Apple-style activity rings for the dashboard
 */
import { db, getSetting } from './db'
import { setCount, ymd } from './workout'
import { WATER_GOAL } from './wellbeing'

export const GOALS = { studyMin: 90, water: WATER_GOAL }
export const DAILY_GOALS = [
  { xp: 30, label: 'Casual' }, { xp: 50, label: 'Regular' }, { xp: 100, label: 'Serious' }, { xp: 150, label: 'Intense' },
]
export const XP_RULES = { focusMin: 2, set: 5, habit: 10, glass: 2, quizPoint: 10, paper: 25, topicUp: 30, review: 3 }
export const FREEZE_PRICE = 50
export const MAX_FREEZES = 2

const RANK = { none: 0, red: 1, amber: 2, green: 3 } as const
const localDay = (iso: string) => ymd(new Date(iso))
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const cardReps = (fsrs?: string) => { try { return fsrs ? JSON.parse(fsrs).reps ?? 0 : 0 } catch { return 0 } }
const lastReview = (fsrs?: string) => { try { return fsrs ? JSON.parse(fsrs).last_review as string | undefined : undefined } catch { return undefined } }

export type Ring = { key: 'study' | 'move' | 'mind'; label: string; value: number; goal: number; unit: string; pct: number; colors: [string, string] }
export type Quest = { id: string; icon: string; title: string; progress: number; goal: number; xp: number; done: boolean; to: string }
export type Achievement = {
  id: string; icon: string; title: string; desc: string; value: number
  tier: number            // tiers reached (0 = none yet, 6 = Legend)
  next: number | null     // threshold for the next tier (null = maxed)
  prev: number            // threshold of the current tier (0 if none)
  tiers: number[]
}
export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'] as const
export const TIER_COLORS = ['#c8834f', '#a8b0bd', '#f2b632', '#59c3c3', '#7aa7ff', '#c86bfa'] as const
export const TIER_GEMS = [10, 20, 30, 50, 75, 100]

/** Solo league: last week's XP decides this week's division (Duolingo names). */
export const LEAGUES = [
  { name: 'Bronze', min: 0, color: '#c8834f' }, { name: 'Silver', min: 150, color: '#a8b0bd' }, { name: 'Gold', min: 350, color: '#f2b632' },
  { name: 'Sapphire', min: 600, color: '#3b82f6' }, { name: 'Ruby', min: 900, color: '#e11d48' }, { name: 'Emerald', min: 1300, color: '#10b981' },
  { name: 'Amethyst', min: 1800, color: '#a855f7' }, { name: 'Pearl', min: 2500, color: '#e7d7c9' }, { name: 'Obsidian', min: 3300, color: '#3f3f46' },
  { name: 'Diamond', min: 4200, color: '#7dd3fc' },
] as const
export const leagueFor = (xp: number) => [...LEAGUES].reverse().find(l => xp >= l.min)!

/** Gentle curve: level n needs 100·n·(n+1)/2 XP → L2 at 100, L5 at 1000, L10 at 4500. */
export function levelFor(xp: number) {
  let level = 1
  while (100 * level * (level + 1) / 2 <= xp) level++
  const floor = 100 * (level - 1) * level / 2, ceil = 100 * level * (level + 1) / 2
  const titles = ['Starter', 'Learner', 'Explorer', 'Achiever', 'Scholar', 'Expert', 'Master', 'Legend']
  return { level, title: titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))], into: xp - floor, need: ceil - floor }
}

/** Everything the game needs, in one pass over the database. */
export async function gameState(now = new Date()) {
  const today = ymd(now)
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)

  const [focus, plan, wlogs, well, habits, hlogs, cards, quizzes, papers, topicLog, notes, reviews, rewards, frozen, goalStr, freezeStr] = await Promise.all([
    db.focus.toArray(), db.workouts.toArray(), db.workoutLog.toArray(), db.wellbeing.toArray(), db.habits.toArray(), db.habitLog.toArray(),
    db.flashcards.toArray(), db.quizzes.toArray(), db.attempts.toArray(), db.topicLog.toArray(), db.notes.toArray(),
    db.reviewLog.toArray(), db.rewards.toArray(), db.freezeLog.toArray(), getSetting('dailyGoal'), getSetting('freezes'),
  ])
  const dailyGoal = Number(goalStr) || 50
  const freezes = Math.min(MAX_FREEZES, Number(freezeStr) || 0)

  // ---------- XP per day ----------
  const byDay = new Map<string, number>()
  const add = (day: string, xp: number) => { if (xp) byDay.set(day, (byDay.get(day) ?? 0) + xp) }
  focus.forEach(f => add(localDay(f.start), f.minutes * XP_RULES.focusMin))
  wlogs.forEach(l => add(l.date, l.done * XP_RULES.set))
  hlogs.forEach(l => add(l.date, XP_RULES.habit))
  well.forEach(w => add(w.date, w.water * XP_RULES.glass))
  quizzes.forEach(q => add(localDay(q.date), q.score * XP_RULES.quizPoint))
  papers.forEach(a => add(localDay(a.createdAt), XP_RULES.paper))
  const improvedChanges = topicLog.filter(c => c.from !== 'none' && RANK[c.to] > RANK[c.from])
  improvedChanges.forEach(c => add(localDay(c.date), XP_RULES.topicUp))
  reviews.forEach(r => add(r.date, XP_RULES.review))
  rewards.forEach(r => add(r.date, r.xp))
  // Reviews from before review-logging existed still count toward the all-time total (not to any day)
  const loggedReviews = reviews.length
  const legacyReviewXp = Math.max(0, cards.reduce((t, c) => t + cardReps(c.fsrs), 0) - loggedReviews) * XP_RULES.review
  const xp = [...byDay.values()].reduce((a, b) => a + b, 0) + legacyReviewXp
  const xpToday = byDay.get(today) ?? 0
  const lvl = levelFor(xp)

  // ---------- streak ----------
  const met = (d: string) => (byDay.get(d) ?? 0) >= dailyGoal
  const frozenSet = new Set(frozen.map(f => f.date))
  const kept = (d: string) => met(d) || frozenSet.has(d)
  let streak = 0
  for (let i = met(today) ? 0 : 1; i < 1000; i++) { if (kept(ymd(addDays(now, -i)))) streak++; else break }
  const allDays = [...new Set([...byDay.keys(), ...frozenSet])].sort()
  let longest = 0, run = 0, prev = ''
  allDays.forEach(d => {
    if (!kept(d)) { run = 0; prev = d; return }
    run = prev && ymd(addDays(new Date(prev + 'T00:00'), 1)) === d ? run + 1 : 1
    longest = Math.max(longest, run); prev = d
  })
  // Perfect weeks: Mon–Sun weeks with all 7 days kept
  const mondays = new Set(allDays.map(d => { const x = new Date(d + 'T00:00'); return ymd(addDays(x, -((x.getDay() + 6) % 7))) }))
  const perfectWeeks = [...mondays].filter(m => Array.from({ length: 7 }, (_, i) => kept(ymd(addDays(new Date(m + 'T00:00'), i)))).every(Boolean)
    && ymd(addDays(new Date(m + 'T00:00'), 6)) < today).length

  // ---------- league (solo): last week's XP sets this week's division ----------
  const monday = (() => { const d = new Date(dayStart); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d })()
  const weekXp = (start: Date) => Array.from({ length: 7 }, (_, i) => byDay.get(ymd(addDays(start, i))) ?? 0).reduce((a, b) => a + b, 0)
  const thisWeekXp = weekXp(monday), lastWeekXp = weekXp(addDays(monday, -7))
  const league = leagueFor(lastWeekXp)
  const nextLeague = LEAGUES[LEAGUES.findIndex(l => l.name === leagueFor(thisWeekXp).name) + 1] ?? null
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = addDays(dayStart, i - 6); return { day: ymd(d), label: 'SMTWTFS'[d.getDay()], xp: byDay.get(ymd(d)) ?? 0 } })

  // ---------- gems ----------
  const gems = rewards.reduce((t, r) => t + r.gems, 0)

  // ---------- rings (today) ----------
  const focusToday = focus.filter(f => new Date(f.start) >= dayStart).reduce((t, f) => t + f.minutes, 0)
  const todaysPlan = plan.filter(w => w.day === now.getDay())
  const setsGoal = todaysPlan.reduce((t, w) => t + setCount(w.sets), 0)
  const setsDone = todaysPlan.reduce((t, w) => t + Math.min(setCount(w.sets), wlogs.find(l => l.date === today && l.workoutId === w.id)?.done ?? 0), 0)
  const wToday = well.find(w => w.date === today)
  const water = wToday?.water ?? 0
  const habitsDone = hlogs.filter(l => l.date === today).length
  const cardsToday = Math.max(reviews.filter(r => r.date === today).length,
    cards.filter(c => { const lr = lastReview(c.fsrs); return lr && new Date(lr) >= dayStart }).length)
  const quizzesToday = quizzes.filter(q => new Date(q.date) >= dayStart)
  const mindVal = Math.round(
    (habits.length ? 40 * Math.min(1, water / GOALS.water) + 40 * (habitsDone / habits.length) : 80 * Math.min(1, water / GOALS.water))
    + (wToday?.mood ? 10 : 0) + (wToday?.sleep != null ? 10 : 0))
  const rings: Ring[] = [
    { key: 'study', label: 'Study', value: focusToday, goal: GOALS.studyMin, unit: 'min', pct: focusToday / GOALS.studyMin, colors: ['#ff2d55', '#ff6482'] },
    { key: 'move', label: 'Move', value: setsDone, goal: setsGoal || 1, unit: setsGoal ? 'sets' : 'rest day', pct: setsGoal ? setsDone / setsGoal : 1, colors: ['#a4ff00', '#d5ff5c'] },
    { key: 'mind', label: 'Mind', value: mindVal, goal: 100, unit: '%', pct: mindVal / 100, colors: ['#00d8ff', '#6ef0ff'] },
  ]

  // ---------- daily quests (rotate by weekday) ----------
  const pool: Quest[] = [
    { id: 'focus', icon: '🍅', title: 'Focus for 50 minutes', progress: focusToday, goal: 50, xp: 50, done: focusToday >= 50, to: '/focus' },
    { id: 'cards', icon: '🃏', title: 'Review 10 flashcards', progress: cardsToday, goal: 10, xp: 40, done: cardsToday >= 10, to: '/study' },
    { id: 'quiz', icon: '❓', title: 'Score 80%+ on a quiz', progress: quizzesToday.some(q => q.score / q.total >= 0.8) ? 1 : 0, goal: 1, xp: 60, done: quizzesToday.some(q => q.score / q.total >= 0.8), to: '/study' },
    { id: 'water', icon: '💧', title: `Drink ${GOALS.water} glasses`, progress: water, goal: GOALS.water, xp: 30, done: water >= GOALS.water, to: '/wellbeing' },
    { id: 'move', icon: '💪', title: setsGoal ? 'Finish today’s workout' : 'Log a check-in', progress: setsGoal ? setsDone : (wToday?.mood ? 1 : 0), goal: setsGoal || 1, xp: 40, done: setsGoal ? setsDone >= setsGoal : !!wToday?.mood, to: setsGoal ? '/workout' : '/wellbeing' },
    { id: 'habits', icon: '✅', title: 'Tick off every habit', progress: habitsDone, goal: Math.max(1, habits.length), xp: 40, done: habits.length > 0 && habitsDone >= habits.length, to: '/wellbeing' },
  ]
  const rot = now.getDay()
  const quests = [pool[0], pool[1 + (rot % 2)], pool[3 + (rot % 3)]]

  // ---------- achievements (6 tiers each) ----------
  const focusHours = Math.floor(focus.reduce((t, f) => t + f.minutes, 0) / 60)
  const hourOf = (iso: string) => new Date(iso).getHours()
  const totalReviews = cards.reduce((t, c) => t + cardReps(c.fsrs), 0)
  const workoutDays = new Set(wlogs.filter(l => l.done > 0).map(l => l.date)).size
  const ach = (id: string, icon: string, title: string, desc: string, value: number, tiers: number[]): Achievement => {
    const tier = tiers.filter(t => value >= t).length
    return { id, icon, title, desc, value, tier, tiers, next: tiers[tier] ?? null, prev: tier ? tiers[tier - 1] : 0 }
  }
  const achievements: Achievement[] = [
    ach('wildfire', '🔥', 'Wildfire', 'Reach a {n}-day streak', longest, [3, 7, 14, 30, 60, 100]),
    ach('sage', '✨', 'Sage', 'Earn {n} XP', xp, [100, 500, 1000, 2500, 5000, 10000]),
    ach('scholar', '⏱️', 'Scholar', 'Focus for {n} hours', focusHours, [1, 5, 10, 25, 50, 100]),
    ach('cards', '🃏', 'Card Shark', 'Do {n} flashcard reviews', totalReviews, [25, 100, 250, 500, 1000, 2500]),
    ach('whiz', '🧠', 'Quiz Whiz', 'Score 80%+ on {n} quizzes', quizzes.filter(q => q.score / q.total >= 0.8).length, [1, 3, 5, 10, 25, 50]),
    ach('perfect', '💯', 'Perfectionist', 'Get 100% on {n} quizzes', quizzes.filter(q => q.score === q.total).length, [1, 3, 5, 10, 20, 40]),
    ach('climber', '📈', 'Climber', 'Move {n} topics up a colour', improvedChanges.length, [1, 5, 10, 20, 40, 80]),
    ach('examiner', '📝', 'Examiner', 'Mark {n} past-paper answers', papers.length, [1, 5, 10, 25, 50, 100]),
    ach('quests', '🏆', 'Quest Master', 'Complete {n} daily quests', rewards.filter(r => r.key.startsWith('quest:')).length, [3, 15, 30, 75, 150, 300]),
    ach('perfectweek', '📅', 'Perfect Week', 'Hit your goal every day for {n} weeks', perfectWeeks, [1, 2, 4, 8, 12, 26]),
    ach('librarian', '📚', 'Librarian', 'Add {n} notes', notes.length, [1, 10, 25, 50, 100, 200]),
    ach('ironwill', '💪', 'Iron Will', 'Work out on {n} days', workoutDays, [1, 5, 15, 30, 60, 100]),
    ach('hydrated', '💧', 'Hydrated', 'Hit your water goal on {n} days', well.filter(w => w.water >= GOALS.water).length, [1, 7, 14, 30, 60, 100]),
    ach('rested', '🌙', 'Well Rested', 'Sleep 8h+ on {n} nights', well.filter(w => (w.sleep ?? 0) >= 8).length, [1, 5, 14, 30, 60, 100]),
    ach('habits', '✅', 'Habit Hero', 'Tick off {n} habits', hlogs.length, [5, 25, 50, 100, 250, 500]),
    ach('earlybird', '🌅', 'Early Bird', 'Start {n} focus sessions before 8am', focus.filter(f => hourOf(f.start) < 8).length, [1, 5, 10, 25, 50, 100]),
    ach('nightowl', '🦉', 'Night Owl', 'Start {n} focus sessions after 9pm', focus.filter(f => hourOf(f.start) >= 21).length, [1, 5, 10, 25, 50, 100]),
  ]

  return {
    rings, quests, achievements, focusToday, cardsToday,
    xp, ...lvl, xpToday, dailyGoal, goalMet: xpToday >= dailyGoal,
    streak, longest, freezes, frozenDays: frozenSet, metDays: new Set([...byDay.keys()].filter(met)),
    gems, league, thisWeekXp, lastWeekXp, nextLeague, last7, today,
  }
}
export type GameState = Awaited<ReturnType<typeof gameState>>

/** "Do {n} flashcard reviews" → "Do 1 flashcard review" when the target is 1. */
export function achDesc(a: Achievement) {
  const n = a.next ?? a.tiers[a.tiers.length - 1]
  let s = a.desc.replace('{n}', String(n))
  if (n === 1) s = s.replace(/\b(quizzes|weeks|notes|days|hours|nights|answers|habits|sessions|reviews|topics|quests)\b/,
    w => ({ quizzes: 'quiz', weeks: 'week' } as Record<string, string>)[w] ?? w.slice(0, -1))
  return s
}
