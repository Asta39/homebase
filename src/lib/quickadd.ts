/** Voice / text quick-add: speech → text (Groq Whisper) → structured actions (Groq LLM) → saved after she confirms. */
import { chat, MODEL_SMART } from './groq'
import { db, getSetting, type CalEvent, type Meal } from './db'
import { ymd } from './workout'

export async function transcribe(audio: Blob) {
  const key = await getSetting('groqKey')
  if (!key) throw new Error('Add your Groq API key in Settings first.')
  const fd = new FormData()
  fd.append('file', audio, 'speech.webm')
  fd.append('model', 'whisper-large-v3-turbo')
  fd.append('language', 'en')
  fd.append('response_format', 'json')
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd })
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`)
  return ((await res.json()).text as string).trim()
}

export type Action =
  | { type: 'event'; title: string; date: string; start?: string; end?: string; subject?: string; kind: CalEvent['kind'] }
  | { type: 'shopping'; items: string[] }
  | { type: 'meal'; date: string; slot: Meal['slot']; name: string }
  | { type: 'confusion'; subject: string; text: string }

export async function parseCommand(text: string): Promise<Action[]> {
  const now = new Date()
  const subjects = (await db.subjects.toArray()).map(s => s.name)
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(now); d.setDate(now.getDate() + i); return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${ymd(d)}` })
  const out = await chat([
    { role: 'system', content: `You turn a student's quick spoken note into app actions. Today is ${days[0]}, time ${now.toTimeString().slice(0, 5)}.
Upcoming dates: ${days.join(', ')}. "Thursday" means the NEXT Thursday on or after today. "Tonight" = today evening.
Subjects: ${subjects.join(', ')}.
Action types:
- event: anything with a day/time (homework, tests, lessons, plans). kind = "exam" for exams/tests, "study" for revision/homework in a subject, else "task". start/end "HH:MM" 24h; if only a start is given make it 1 hour; omit times for all-day. title short with no date/time words, but KEEP the subject and the thing (e.g. "Chemistry homework", "Biology test").
- shopping: things to buy ("add milk", "we need eggs"). items = list of item names.
- meal: planning a meal ("pasta for dinner Friday"). slot one of breakfast, lunch, dinner, snack.
- confusion: "I don't understand X in <subject>" → add to that subject's weekend recap.
One sentence can produce several actions. Match subject names loosely ("chem" → Chemistry, "maths" → Mathematics).
Reply as JSON: {"actions":[...]}` },
    { role: 'user', content: text },
  ], { json: true, model: MODEL_SMART })
  return (JSON.parse(out).actions ?? []) as Action[]
}

/** Human-readable one-liner for the preview. */
export function describe(a: Action) {
  const day = (d: string) => new Date(d + 'T00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  switch (a.type) {
    case 'event': return `📅 ${a.title} — ${day(a.date)}${a.start ? `, ${a.start}${a.end ? `–${a.end}` : ''}` : ' (all day)'}${a.subject ? ` · ${a.subject}` : ''}`
    case 'shopping': return `🛒 Shopping: ${a.items.join(', ')}`
    case 'meal': return `🥗 ${a.slot[0].toUpperCase() + a.slot.slice(1)} ${day(a.date)}: ${a.name}`
    case 'confusion': return `🧠 Recap (${a.subject}): ${a.text}`
  }
}

export async function apply(a: Action) {
  const subjectId = async (name?: string) => {
    if (!name) return undefined
    const all = await db.subjects.toArray()
    return all.find(s => s.name.toLowerCase() === name.toLowerCase())?.id ?? all.find(s => s.name.toLowerCase().startsWith(name.toLowerCase().slice(0, 4)))?.id
  }
  switch (a.type) {
    case 'event': {
      const sid = await subjectId(a.subject)
      const start = a.start ? `${a.date}T${a.start}:00` : a.date
      let end: string | undefined
      if (a.start) {
        if (a.end) end = `${a.date}T${a.end}:00`
        else { const [h, m] = a.start.split(':').map(Number); end = `${a.date}T${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}:00` }
      }
      await db.events.add({ title: a.title, start, end, allDay: !a.start, subjectId: sid, kind: a.kind ?? 'task' })
      return
    }
    case 'shopping':
      await db.shopping.bulkAdd(a.items.map(name => ({ name, qty: '', aisle: 'Other', done: false, auto: false, createdAt: new Date().toISOString() })))
      return
    case 'meal': {
      const existing = await db.meals.where('date').equals(a.date).filter(m => m.slot === a.slot).first()
      if (existing) await db.meals.update(existing.id!, { name: a.name })
      else await db.meals.add({ date: a.date, slot: a.slot, name: a.name })
      return
    }
    case 'confusion': {
      const sid = await subjectId(a.subject)
      if (sid) await db.confusions.add({ subjectId: sid, text: a.text, source: 'manual', createdAt: new Date().toISOString() })
      return
    }
  }
}

/** Check an action is complete enough to save. */
export function valid(a: Action) {
  switch (a.type) {
    case 'event': return !!a.title && /^\d{4}-\d{2}-\d{2}$/.test(a.date) && (!a.start || /^\d{2}:\d{2}$/.test(a.start))
    case 'shopping': return Array.isArray(a.items) && a.items.length > 0
    case 'meal': return /^\d{4}-\d{2}-\d{2}$/.test(a.date) && ['breakfast', 'lunch', 'dinner', 'snack'].includes(a.slot) && !!a.name
    case 'confusion': return !!a.subject && !!a.text
  }
}
