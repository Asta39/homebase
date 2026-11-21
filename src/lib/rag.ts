/**
 * Local RAG over a subject's notes.
 * Notes → overlapping chunks → embeddings (in a worker, on-device) → stored in IndexedDB.
 * Search = cosine similarity blended with keyword overlap, so it still works if the model can't load (offline first run).
 */
import { db, type Chunk, type Note } from './db'

// ---------- embedding worker ----------
let worker: Worker | null = null
let seq = 0
const pending = new Map<number, { resolve: (v: Float32Array[]) => void; reject: (e: Error) => void }>()
const progressListeners = new Set<(p: number) => void>()
export const onModelProgress = (fn: (p: number) => void) => { progressListeners.add(fn); return () => { progressListeners.delete(fn) } }

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./embed.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e) => {
    const m = e.data
    if (m.type === 'progress') return progressListeners.forEach(f => f(m.progress))
    const p = pending.get(m.id); if (!p) return
    pending.delete(m.id)
    if (m.type === 'result') p.resolve(m.vecs)
    else p.reject(new Error(m.error))
  }
  return worker
}

export function embed(texts: string[]): Promise<Float32Array[]> {
  return new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, texts })
  })
}

// ---------- chunking ----------
const SIZE = 900, OVERLAP = 150

/** Split on paragraphs, then pack into ~900-char chunks with a little overlap for context. */
export function chunkText(text: string): string[] {
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const out: string[] = []
  let cur = ''
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = cur.slice(-OVERLAP) }
  for (const p of paras) {
    if (p.length > SIZE) { // very long paragraph → split by sentence
      for (const s of p.split(/(?<=[.!?])\s+/)) { if (cur.length + s.length > SIZE) push(); cur += (cur ? ' ' : '') + s }
    } else {
      if (cur.length + p.length > SIZE) push()
      cur += (cur ? '\n\n' : '') + p
    }
  }
  if (cur.trim() && (!out.length || !out[out.length - 1].endsWith(cur.trim()))) out.push(cur.trim())
  return out
}

// ---------- indexing ----------
/** Make sure every note in the subject has chunks; embed any that don't have vectors yet. */
export async function ensureIndexed(subjectId: number, onStatus: (s: string) => void = () => {}) {
  const notes = await db.notes.where('subjectId').equals(subjectId).toArray()
  const have = new Set((await db.chunks.where('subjectId').equals(subjectId).toArray()).map(c => c.noteId))
  for (const n of notes.filter(n => !have.has(n.id!))) await addChunks(n)

  const todo = await db.chunks.where('subjectId').equals(subjectId).filter(c => !c.vec).toArray()
  if (!todo.length) return
  const unsub = onModelProgress(p => onStatus(`Downloading search model… ${p}% (first time only)`))
  try {
    for (let i = 0; i < todo.length; i += 16) {
      onStatus(`Indexing notes… ${Math.min(i + 16, todo.length)}/${todo.length}`)
      const batch = todo.slice(i, i + 16)
      const vecs = await embed(batch.map(c => c.text))
      await db.chunks.bulkUpdate(batch.map((c, j) => ({ key: c.id!, changes: { vec: vecs[j] } })))
    }
  } finally { unsub(); onStatus('') }
}

async function addChunks(n: Note) {
  const parts = chunkText(`${n.title}\n\n${n.content}`)
  await db.chunks.bulkAdd(parts.map((text, idx) => ({ noteId: n.id!, subjectId: n.subjectId, idx, text, vec: null })))
}

// ---------- search ----------
const STOP = new Set(('the a an and or of to in on for is are was were be by with as at it this that what why how which from does do ' +
  'around about into out up down my your our their its can could would should will i you we they he she me us them there here when where who').split(' '))
export const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 1 && !STOP.has(w)) ?? []

function keywordScore(q: string[], text: string) {
  if (!q.length) return 0
  const t = new Set(words(text))
  return q.filter(w => t.has(w)).length / q.length
}
function cosine(a: Float32Array, b: Float32Array) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s } // vectors are normalized

export type Hit = { chunk: Chunk; noteTitle: string; score: number }

export async function search(subjectId: number, query: string, k = 6): Promise<Hit[]> {
  const chunks = await db.chunks.where('subjectId').equals(subjectId).toArray()
  if (!chunks.length) return []
  let qv: Float32Array | null = null
  try { qv = (await embed([query]))[0] } catch { /* model unavailable → keyword only */ }
  const qw = words(query)
  const titles = new Map((await db.notes.where('subjectId').equals(subjectId).toArray()).map(n => [n.id!, n.title]))

  return chunks
    .map(c => ({
      chunk: c, noteTitle: titles.get(c.noteId) ?? 'Note',
      score: (qv && c.vec ? cosine(qv, c.vec) : 0) + 0.25 * keywordScore(qw, c.text),
    }))
    .filter(h => h.score > 0.3) // below this, MiniLM matches are usually unrelated
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}
