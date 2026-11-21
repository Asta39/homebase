import { useState } from 'react'
import { ensureIndexed, search, words, type Hit } from '../lib/rag'
import Thinking from './Thinking'
import Art from './Art'

/** Search notes by meaning, not just exact words. Runs fully on this device, no API key needed. */
export default function NoteSearch({ subjectId, disabled }: { subjectId: number; disabled: boolean }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [status, setStatus] = useState('')

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return setHits(null)
    setStatus('Searching…')
    try {
      await ensureIndexed(subjectId, s => setStatus(s || 'Searching…'))
      setHits(await search(subjectId, q, 8))
    } catch { setHits(await search(subjectId, q, 8).catch(() => [])) }
    finally { setStatus('') }
  }

  const terms = words(q).filter(t => t.length > 2)
  const highlight = (text: string) => {
    if (!terms.length) return text
    // whole words only (plus simple plurals), so "the" never lights up inside "Photosynthesis"
    // One capture group → split() alternates [text, match, text, match, …]
    const re = new RegExp(`\\b((?:${terms.join('|')})(?:s|es)?)\\b`, 'gi')
    return text.split(re).map((p, i) => i % 2 ? <mark key={i} className="bg-yellow-300/60 text-inherit rounded px-0.5">{p}</mark> : p)
  }

  return (
    <div className="space-y-2">
      <form onSubmit={run} className="flex gap-2 items-center">
        <Art name="search" size={30} />
        <input className="input" disabled={disabled} value={q} onChange={e => { setQ(e.target.value); if (!e.target.value) setHits(null) }}
          placeholder={disabled ? 'Add notes to search them' : 'Search your notes by meaning, e.g. "how do plants make food"'} />
        <button className="btn" disabled={disabled || !!status || !q.trim()}>Search</button>
      </form>
      {status && <p className="muted text-sm"><Thinking state="searching" label={status} /></p>}
      {hits && (hits.length ? (
        <div className="panel divide-y divide-[var(--line)]">
          {hits.map(h => (
            <div key={h.chunk.id} className="p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="font-medium">{h.noteTitle} <span className="muted font-normal">· part {h.chunk.idx + 1}</span></span>
                <span className="muted text-xs tabular-nums">{Math.round(Math.min(1, h.score) * 100)}% match</span>
              </div>
              <p className="whitespace-pre-wrap muted line-clamp-4">{highlight(h.chunk.text)}</p>
            </div>
          ))}
        </div>
      ) : <p className="muted text-sm">Nothing in your notes matches that.</p>)}
    </div>
  )
}
