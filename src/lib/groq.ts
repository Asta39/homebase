import { getSetting } from './db'

/**
 * Groq's free model line-up changes over time (Llama 3.x was retired), so we don't hard-code one model.
 * Callers ask for a tier; we pick the first model in that tier's preference list that the key can actually use.
 */
export const MODEL_SMART = 'smart'
export const MODEL_FAST = 'fast'
const PREFER: Record<string, string[]> = {
  smart: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'],
  fast: ['openai/gpt-oss-20b', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
}

let available: { key: string; at: number; ids: Set<string> } | null = null
async function resolveModel(tier: string, key: string) {
  if (!PREFER[tier]) return tier // an explicit model id
  if (!available || available.key !== key || Date.now() - available.at > 6 * 3600e3) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } })
      if (r.ok) available = { key, at: Date.now(), ids: new Set(((await r.json()).data ?? []).map((m: { id: string }) => m.id)) }
    } catch { /* offline — fall through to first preference */ }
  }
  return PREFER[tier].find(m => available?.ids.has(m)) ?? PREFER[tier][0]
}

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

/** Friendlier messages for the errors she's most likely to hit. */
function explain(status: number, body: string) {
  if (status === 401) return 'Your Groq key was rejected. Check it in Settings.'
  if (status === 429) return 'Groq’s free limit was hit for now — wait a minute and try again.'
  if (status >= 500) return 'Groq is having trouble right now. Try again in a moment.'
  try { return `Groq error ${status}: ${JSON.parse(body).error?.message ?? body}` } catch { return `Groq error ${status}: ${body}` }
}

export async function chat(messages: Msg[], opts: { model?: string; json?: boolean } = {}) {
  const key = await getSetting('groqKey')
  if (!key) throw new Error('Add your Groq API key in Settings first.')
  const model = await resolveModel(opts.model ?? MODEL_SMART, key)
  let res: Response
  try {
    res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        // gpt-oss models "think" before answering; low effort keeps replies fast for a study app
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    })
  } catch { throw new Error('Can’t reach Groq — check the internet connection.') }
  if (!res.ok) throw new Error(explain(res.status, await res.text()))
  const data = await res.json()
  const content = (data.choices?.[0]?.message?.content ?? '') as string
  return opts.json ? extractJson(content) : content
}

/** Some models wrap JSON in ``` fences or add a sentence first — pull out the object. */
function extractJson(s: string) {
  const t = s.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  return a >= 0 && b > a ? t.slice(a, b + 1) : t
}

const TUTOR = `You are a patient IGCSE tutor. Answer ONLY from the student's notes provided.
Cite sources as [1], [2] after each claim, matching the numbered excerpts. If the notes don't cover it, say so plainly.`

/** Notebook-style Q&A grounded in the most relevant excerpts of this subject's notes (see rag.ts). */
export async function askNotes(subject: string, sources: { title: string; text: string }[], question: string) {
  const ctx = sources.map((s, i) => `[${i + 1}] (from "${s.title}")\n${s.text}`).join('\n\n')
  const out = await chat([
    { role: 'system', content: `${TUTOR}\nSubject: ${subject}` },
    { role: 'user', content: `NOTE EXCERPTS:\n${ctx || '(no matching notes)'}\n\nQUESTION: ${question}` },
  ])
  // gpt-oss cites as 【1】 or 【1†L2】 — normalise to [1] to match the Sources list
  return out.replace(/【(\d+)[^】]*】/g, '[$1]')
}

export async function makeFlashcards(subject: string, text: string, count = 10) {
  const out = await chat([
    { role: 'system', content: 'You create concise IGCSE flashcards. Reply as JSON: {"cards":[{"front":"...","back":"..."}]}' },
    { role: 'user', content: `Subject: ${subject}. Make ${count} flashcards from:\n${text.slice(0, 20000)}` },
  ], { json: true })
  return (JSON.parse(out).cards ?? []) as { front: string; back: string }[]
}

/** Turn pasted syllabus text (or just a syllabus name) into a topic list. */
export async function parseSyllabus(subject: string, text: string) {
  const out = await chat([
    { role: 'system', content: `Extract the syllabus content as a flat list of revisable topics, in syllabus order.
Keep official numbering as "code" when present (e.g. "4.2"), else "".
If given only a syllabus name, list the topics you know for it — the student will correct it.
Reply as JSON: {"topics":[{"code":"1.1","title":"States of matter"}]}` },
    { role: 'user', content: `Subject: ${subject}\n\n${text.slice(0, 24000)}` },
  ], { json: true })
  return (JSON.parse(out).topics ?? []) as { code: string; title: string }[]
}

/** Mark one past-paper answer strictly against its mark scheme, IGCSE examiner style. */
export async function markAnswer(subject: string, question: string, scheme: string, answer: string) {
  const out = await chat([
    { role: 'system', content: `You are a strict but kind Cambridge/Edexcel IGCSE examiner.
Mark the student's answer ONLY against the mark scheme. Award marks point by point.
Check the command word (state, describe, explain, evaluate, calculate…) is answered as asked.
If no mark scheme is given, estimate the marks from the question and say the mark is an estimate.
Reply as JSON: {"score":n,"max":n,"feedback":"markdown: ✓ points earned, ✗ points missed, then 'To get full marks:' with a model answer","weakTopic":"short topic name or empty"}` },
    { role: 'user', content: `Subject: ${subject}\n\nQUESTION:\n${question}\n\nMARK SCHEME:\n${scheme || '(none provided)'}\n\nSTUDENT ANSWER:\n${answer}` },
  ], { json: true })
  return JSON.parse(out) as { score: number; max: number; feedback: string; weakTopic?: string }
}

export const AISLES = ['Fruit & veg', 'Meat & fish', 'Dairy & eggs', 'Bakery', 'Pantry', 'Frozen', 'Drinks', 'Household', 'Other']

/** Combine a week of meals into one de-duplicated shopping list, grouped by aisle. */
export async function shoppingFromMeals(meals: string[], have: string) {
  const out = await chat([
    { role: 'system', content: `You turn a week's meal plan into ONE combined shopping list for a family home.
Merge duplicates and add up quantities across meals. Use simple everyday quantities (e.g. "500 g", "1 dozen", "2").
Skip basics most homes already have (salt, pepper, oil, water) and anything listed under ALREADY HAVE.
aisle must be one of: ${AISLES.join(', ')}.
Reply as JSON: {"items":[{"name":"Chicken breast","qty":"600 g","aisle":"Meat & fish"}]}` },
    { role: 'user', content: `MEALS THIS WEEK:\n- ${meals.join('\n- ')}\n\nALREADY HAVE: ${have || 'nothing noted'}` },
  ], { json: true, model: MODEL_FAST })
  return (JSON.parse(out).items ?? []) as { name: string; qty: string; aisle: string }[]
}

/** "What can I cook with…" — quick ideas from what's in the fridge. */
export function cookWith(ingredients: string) {
  return chat([
    { role: 'system', content: 'Suggest 3 simple, healthy meals a busy student could cook in under 30 minutes using mostly these ingredients. For each: name, time, short steps. Keep it brief.' },
    { role: 'user', content: ingredients },
  ], { model: MODEL_FAST })
}

export function weekendRecap(subject: string, confusions: string[]) {
  return chat([
    { role: 'system', content: `${TUTOR.split('\n')[0]} Write a short weekend recap: re-explain each confusing point simply, give one worked example, then 3 quick check questions with answers at the end.` },
    { role: 'user', content: `Subject: ${subject}\nThings I didn't get this week:\n- ${confusions.join('\n- ')}` },
  ])
}
