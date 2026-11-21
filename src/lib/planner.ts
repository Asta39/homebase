/**
 * Auto study planner — pure function, no AI needed.
 * Fills free time between now and the exams with revision blocks, weighted by
 *   urgency (exam soon) × weakness (red/amber/unrated topics),
 * avoids existing calendar events, rotates subjects, names a specific topic per block,
 * and adds a light review the day before each exam plus a weekend recap.
 */

export type DayHours = { from: string; to: string } | null // null = day off
export type PlannerSettings = {
  week: DayHours[]      // index 0 = Sunday … 6 = Saturday
  sessionMin: number    // length of one study block
  breakMin: number      // gap between blocks
  maxPerDay: number     // cap blocks per day
  weekendRecap: boolean // reserve the first weekend block for the recap
}
export const PLANNER_DEFAULTS: PlannerSettings = {
  week: [
    { from: '10:00', to: '13:00' },                        // Sun
    ...Array(5).fill({ from: '16:30', to: '19:30' }),     // Mon–Fri after school
    { from: '10:00', to: '13:00' },                        // Sat
  ],
  sessionMin: 45, breakMin: 15, maxPerDay: 4, weekendRecap: true,
}

export type PlanSubject = { id: number; name: string; examDate?: string; topics: { title: string; rating: 'red' | 'amber' | 'green' | 'none' }[] }
export type Busy = { start: Date; end: Date }
export type Block = { title: string; start: Date; end: Date; subjectId?: number; kind: 'study' | 'recap' | 'exam' }

const DAY = 864e5
const at = (d: Date, hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const x = new Date(d); x.setHours(h, m, 0, 0); return x }
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const examDay = (s: string) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd) }
const overlaps = (a: Busy, b: Busy) => a.start < b.end && b.start < a.end

/** How much revision a subject still needs (unrated counts as fairly weak; no topics = average need). */
export function weakness(s: PlanSubject) {
  if (!s.topics.length) return 4
  const w = { red: 3, amber: 2, none: 1.5, green: 0.4 }
  return s.topics.reduce((t, x) => t + w[x.rating], 0) / s.topics.length * 3
}

export function buildPlan(subjects: PlanSubject[], busy: Busy[], cfg: PlannerSettings, now = new Date(), horizonDays = 42): Block[] {
  const today = startOfDay(now)
  const withExam = subjects.filter(s => s.examDate && examDay(s.examDate) >= today)
  const pool = withExam.length ? withExam : subjects // no exam dates yet → plan all subjects evenly over the horizon
  if (!pool.length) return []
  const lastExam = withExam.length ? Math.max(...withExam.map(s => +examDay(s.examDate!))) : +today + horizonDays * DAY
  const end = Math.min(lastExam, +today + horizonDays * DAY)

  // Topic choice: weak topics come round more often (red 4×, amber 2.5×, unrated 2×, green 1×), weakest first on ties
  const topicW = { red: 4, amber: 2.5, none: 2, green: 1 }
  const seen = new Map<string, number>()
  const nextTopic = (id: number) => {
    const ts = pool.find(s => s.id === id)!.topics
    if (!ts.length) return ''
    const pick = ts.reduce((a, b) =>
      topicW[b.rating] / (1 + (seen.get(`${id}:${b.title}`) ?? 0)) > topicW[a.rating] / (1 + (seen.get(`${id}:${a.title}`) ?? 0)) ? b : a)
    seen.set(`${id}:${pick.title}`, (seen.get(`${id}:${pick.title}`) ?? 0) + 1)
    return pick.title
  }
  const given = new Map<number, number>() // blocks given so far → spreads time fairly
  const blocks: Block[] = []
  const taken = [...busy]
  let last = -1

  for (let d = new Date(today); +d <= end; d = new Date(+d + DAY)) {
    const hours = cfg.week[d.getDay()]
    const dayStr = ymd(d)
    const examsToday = pool.filter(s => s.examDate === dayStr)
    examsToday.forEach(s => blocks.push({ title: `📝 ${s.name} exam`, start: d, end: d, subjectId: s.id, kind: 'exam' }))
    if (!hours || examsToday.length) continue // no studying on exam days

    // Slots for the day, skipping anything already on the calendar and anything in the past
    const slots: Busy[] = []
    for (let t = at(d, hours.from); +t + cfg.sessionMin * 6e4 <= +at(d, hours.to) && slots.length < cfg.maxPerDay; t = new Date(+t + (cfg.sessionMin + cfg.breakMin) * 6e4)) {
      const slot = { start: t, end: new Date(+t + cfg.sessionMin * 6e4) }
      if (slot.start < now) continue
      if (taken.some(b => overlaps(b, slot))) continue
      slots.push(slot)
    }

    const tomorrowExam = pool.find(s => s.examDate === ymd(new Date(+d + DAY)))
    slots.forEach((slot, i) => {
      if (cfg.weekendRecap && i === 0 && (d.getDay() === 0 || d.getDay() === 6)) {
        blocks.push({ ...slot, title: '🧠 Weekend recap — things I didn’t get', kind: 'recap' }); return
      }
      // Day before an exam: only that subject, light review
      let s = tomorrowExam
      if (!s) {
        const live = pool.filter(p => !p.examDate || p.examDate > dayStr)
        if (!live.length) return
        const score = (p: PlanSubject) => {
          const daysLeft = p.examDate ? Math.max(1, (+examDay(p.examDate) - +d) / DAY) : 60
          const urgency = 1 + 20 / daysLeft
          return (weakness(p) * urgency) / (1 + (given.get(p.id) ?? 0)) * (p.id === last && live.length > 1 ? 0.3 : 1)
        }
        s = live.reduce((a, b) => (score(b) > score(a) ? b : a))
      }
      const topic = tomorrowExam ? 'final review & past paper' : nextTopic(s.id)
      blocks.push({ ...slot, title: `📚 ${s.name}${topic ? `: ${topic}` : ''}`, subjectId: s.id, kind: 'study' })
      given.set(s.id, (given.get(s.id) ?? 0) + 1)
      last = s.id
      taken.push(slot)
    })
  }
  return blocks
}

/** Summary for the preview: hours per subject. */
export function summarize(blocks: Block[], cfg: PlannerSettings) {
  const m = new Map<number, number>()
  blocks.filter(b => b.kind === 'study').forEach(b => m.set(b.subjectId!, (m.get(b.subjectId!) ?? 0) + cfg.sessionMin / 60))
  return m
}
