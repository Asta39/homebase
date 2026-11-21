/** Weekly report: everything she did Mon–Sun, compared with the week before. */
import { db, type RAG } from './db'
import { ymd, dayStatus, setCount } from './workout'
import { chat, MODEL_SMART } from './groq'

export const mondayOf = (d: Date) => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const RANK: Record<RAG, number> = { none: 0, red: 1, amber: 2, green: 3 }

export type WeekStats = Awaited<ReturnType<typeof weekStats>>

export async function weekStats(monday: Date) {
  const from = monday, to = addDays(monday, 7)
  const fromISO = from.toISOString(), toISO = to.toISOString()
  const fromKey = ymd(from), lastKey = ymd(addDays(monday, 6))
  const inWeek = (iso: string) => iso >= fromISO && iso < toISO

  const subjects = await db.subjects.toArray()
  const name = (id?: number) => subjects.find(s => s.id === id)?.name ?? 'General'
  const color = (id?: number) => subjects.find(s => s.id === id)?.color ?? '#8e8e93'

  // Study time
  const focus = await db.focus.where('start').between(fromISO, toISO).toArray()
  const focusMin = focus.reduce((t, f) => t + f.minutes, 0)
  const bySubject = [...new Set(focus.map(f => f.subjectId))].map(id => ({
    id, name: name(id), color: color(id), min: focus.filter(f => f.subjectId === id).reduce((t, f) => t + f.minutes, 0),
  })).sort((a, b) => b.min - a.min)

  // Planner: study blocks scheduled this week vs focus done
  const planned = (await db.events.toArray()).filter(e => e.kind === 'study' && e.end && e.start >= fromKey && e.start <= lastKey + 'T99' && new Date(e.end!) <= new Date())
  const plannedMin = planned.reduce((t, e) => t + (new Date(e.end!).getTime() - new Date(e.start).getTime()) / 6e4, 0)

  // Flashcards reviewed this week (ts-fsrs stores last_review on each card)
  const cards = await db.flashcards.toArray()
  const reviewed = cards.filter(c => { try { const lr = c.fsrs && JSON.parse(c.fsrs).last_review; return lr && inWeek(new Date(lr).toISOString()) } catch { return false } }).length
  const mastered = cards.filter(c => { try { return c.fsrs && JSON.parse(c.fsrs).stability >= 21 } catch { return false } }).length

  // Quizzes & past papers
  const quizzes = (await db.quizzes.toArray()).filter(q => inWeek(q.date))
  const quizPct = quizzes.length ? Math.round(quizzes.reduce((t, q) => t + q.score / q.total, 0) / quizzes.length * 100) : null
  const papers = (await db.attempts.toArray()).filter(a => inWeek(a.createdAt))
  const paperPct = papers.length ? Math.round(papers.reduce((t, a) => t + (a.max ? a.score / a.max : 0), 0) / papers.length * 100) : null

  // Topics that moved up (net change across the week)
  const changes = (await db.topicLog.where('date').between(fromISO, toISO).toArray()).sort((a, b) => a.date.localeCompare(b.date))
  const topics = await db.topics.toArray()
  const net = new Map<number, { from: RAG; to: RAG }>()
  changes.forEach(c => net.set(c.topicId, { from: net.get(c.topicId)?.from ?? c.from, to: c.to }))
  const improved = [...net].filter(([, v]) => RANK[v.to] > RANK[v.from] && v.from !== 'none').map(([id, v]) => {
    const t = topics.find(x => x.id === id); return { title: t?.title ?? 'Topic', subject: name(t?.subjectId), ...v }
  })
  const red = topics.filter(t => t.rating === 'red').map(t => ({ title: t.title, subject: name(t.subjectId) }))

  const flagged = (await db.confusions.toArray()).filter(c => inWeek(c.createdAt)).length

  // Workouts
  const plan = await db.workouts.toArray(), logs = await db.workoutLog.toArray()
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const statuses = days.map(d => dayStatus(d, plan, logs, new Date()))
  const workoutDays = statuses.filter(s => s === 'done').length
  const workoutPlanned = days.filter(d => plan.some(w => w.day === d.getDay()) && ymd(d) <= ymd(new Date())).length
  const setsDone = logs.filter(l => l.date >= fromKey && l.date <= lastKey).reduce((t, l) => {
    const w = plan.find(p => p.id === l.workoutId); return t + Math.min(l.done, w ? setCount(w.sets) : l.done)
  }, 0)

  // Wellbeing & habits
  const well = await db.wellbeing.where('date').between(fromKey, lastKey, true, true).toArray()
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const sleep = avg(well.filter(w => w.sleep != null).map(w => w.sleep!))
  const mood = avg(well.filter(w => w.mood).map(w => w.mood!))
  const water = avg(well.map(w => w.water))
  const habits = await db.habits.toArray()
  const hLogs = (await db.habitLog.toArray()).filter(l => l.date >= fromKey && l.date <= lastKey)
  // Count only days since she started tracking habits (not the whole week) and not days still to come
  const firstHabit = (await db.habitLog.orderBy('date').first())?.date
  const habitFrom = firstHabit && firstHabit > fromKey ? new Date(firstHabit + 'T00:00') : from
  const elapsed = Math.max(1, Math.min(7, Math.floor((Math.min(Date.now(), to.getTime() - 1) - habitFrom.getTime()) / 864e5) + 1))
  const habitPct = habits.length ? Math.round((hLogs.length / (habits.length * elapsed)) * 100) : null

  return {
    monday, focusMin, sessions: focus.length, bySubject, plannedMin: Math.round(plannedMin),
    reviewed, mastered, quizzes: quizzes.length, quizPct, papers: papers.length, paperPct,
    improved, red, flagged, workoutDays, workoutPlanned, setsDone,
    sleep, mood, water, habitPct, habitCount: habits.length,
  }
}

/** A letter-style grade for effort (not ability): time studied vs plan, practice done, consistency. */
export function effortGrade(s: WeekStats) {
  let pts = 0
  pts += s.plannedMin ? Math.min(40, (s.focusMin / s.plannedMin) * 40) : Math.min(40, s.focusMin / 6) // 4h ≈ full marks without a plan
  pts += Math.min(20, (s.reviewed / 5) + s.quizzes * 4 + s.papers * 4)
  pts += s.workoutPlanned ? (s.workoutDays / s.workoutPlanned) * 15 : 7.5
  pts += s.habitPct != null ? (s.habitPct / 100) * 10 : 5
  pts += s.sleep != null ? Math.min(15, (s.sleep / 8) * 15) : 7.5
  const g = pts >= 85 ? 'A*' : pts >= 75 ? 'A' : pts >= 62 ? 'B' : pts >= 50 ? 'C' : pts >= 35 ? 'D' : 'E'
  return { grade: g, pts: Math.round(pts) }
}

/** Friendly coach note from the numbers (needs Groq). */
export function coachNote(s: WeekStats, prev: WeekStats) {
  const brief = {
    studyHours: +(s.focusMin / 60).toFixed(1), lastWeekStudyHours: +(prev.focusMin / 60).toFixed(1),
    plannedHours: +(s.plannedMin / 60).toFixed(1), bySubject: s.bySubject.map(b => `${b.name} ${Math.round(b.min)}m`),
    flashcardsReviewed: s.reviewed, quizAvg: s.quizPct, pastPaperAvg: s.paperPct,
    topicsImproved: s.improved.map(t => `${t.subject}: ${t.title}`), stillRed: s.red.slice(0, 8).map(t => `${t.subject}: ${t.title}`),
    workouts: `${s.workoutDays}/${s.workoutPlanned}`, avgSleep: s.sleep?.toFixed(1), habitsPct: s.habitPct,
  }
  return chat([
    { role: 'system', content: `You are a warm, honest study coach for a student preparing for IGCSE exams. From this week's numbers write:
1) two sentences celebrating something specific,
2) one gentle, specific thing to improve,
3) "Next week:" then 3 short concrete bullet goals. Only mention subjects and topics that appear in the data (prefer the "stillRed" topics); never invent topics or activities that are not in the data.
Under 120 words. No fluff, no emojis overload (max 2).` },
    { role: 'user', content: JSON.stringify(brief) },
  ], { model: MODEL_SMART })
}
