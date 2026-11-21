/** NotebookLM-style "Studio" generators, all grounded in the student's own notes. */
import { chat, MODEL_SMART } from './groq'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const GROUND = 'Use ONLY the student\'s notes below. Do not add facts that are not in them. Pitch everything at IGCSE level.'
const clip = (s: string) => s.slice(0, 22000)

export type QuizQ = { q: string; options: string[]; answer: number; explain: string; topic: string }

export async function makeQuiz(subject: string, notes: string, n = 8, difficulty: 'easy' | 'exam' | 'hard' = 'exam') {
  const out = await chat([
    { role: 'system', content: `${GROUND}
Write ${n} multiple-choice questions in IGCSE exam style (${difficulty} difficulty). Mix recall, application and "explain why" questions.
Each has exactly 4 options, one correct; wrong options should be plausible common misconceptions. Vary the position of the correct answer.
Reply as JSON: {"questions":[{"q":"...","options":["A","B","C","D"],"answer":0,"explain":"one or two sentences on why","topic":"short topic name"}]}` },
    { role: 'user', content: `Subject: ${subject}\n\nNOTES:\n${clip(notes)}` },
  ], { json: true, model: MODEL_SMART })
  const raw = (JSON.parse(out).questions ?? []) as (Omit<QuizQ, 'answer'> & { answer: number | string })[]
  return raw.flatMap(q => {
    if (!q.q || q.options?.length !== 4) return []
    // Accept 0-3, "2", "C" or the option text itself
    let a = typeof q.answer === 'number' ? q.answer : /^[A-D]$/i.test(String(q.answer).trim())
      ? 'ABCD'.indexOf(String(q.answer).trim().toUpperCase()) : Number.isFinite(Number(q.answer)) ? Number(q.answer) : q.options.indexOf(String(q.answer))
    if (!(a >= 0 && a < 4)) return []
    // Models love putting the right answer in the same slot — shuffle so position gives nothing away
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5)
    a = order.indexOf(a)
    return [{ ...q, options: order.map(i => q.options[i]), answer: a }]
  })
}

export function makeSummary(subject: string, notes: string) {
  return chat([
    { role: 'system', content: `${GROUND}
Write a one-page revision sheet in Markdown:
## Key ideas (bullets)
## Key terms (a table: Term | Meaning)
## Equations / processes (if any)
## Common exam mistakes
## 5 quick self-test questions (answers at the end)
Be concise. Bold the words an examiner would look for.` },
    { role: 'user', content: `Subject: ${subject}\n\nNOTES:\n${clip(notes)}` },
  ])
}

export type MindNode = { label: string; children?: MindNode[] }

export async function makeMindMap(subject: string, notes: string): Promise<MindNode> {
  const out = await chat([
    { role: 'system', content: `${GROUND}
Build a mind map of the notes: one central topic, 3–7 main branches, each with 2–5 short leaves (max 6 words each). Max depth 3.
Reply as JSON: {"label":"Central topic","children":[{"label":"Branch","children":[{"label":"Leaf"}]}]}` },
    { role: 'user', content: `Subject: ${subject}\n\nNOTES:\n${clip(notes)}` },
  ], { json: true })
  return JSON.parse(out) as MindNode
}

export type Line = { speaker: 'A' | 'B'; text: string }

/** A short two-voice "podcast" that talks through the notes — for revising on the go. */
export async function makeAudioScript(subject: string, notes: string, minutes = 4): Promise<Line[]> {
  const out = await chat([
    { role: 'system', content: `${GROUND}
Write a friendly, lively ${minutes}-minute audio revision chat between two hosts: A (explains) and B (a curious student who asks the questions a learner would, and sometimes gets things slightly wrong so A can correct it).
Use simple spoken English, short sentences, analogies, and recap the 3 most important points at the end. No stage directions, no emojis, no markdown.
Reply as JSON: {"lines":[{"speaker":"A","text":"..."},{"speaker":"B","text":"..."}]}` },
    { role: 'user', content: `Subject: ${subject}\n\nNOTES:\n${clip(notes)}` },
  ], { json: true })
  return ((JSON.parse(out).lines ?? []) as Line[]).filter(l => l.text?.trim())
}

/** Safe Markdown → HTML for AI output. */
export const md = (s: string) => DOMPurify.sanitize(marked.parse(s, { async: false }) as string)
