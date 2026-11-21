import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import { db } from '../lib/db'
import { extractText } from '../lib/extract'
import { confirmBox, notify } from '../components/Dialog'
import NoteSearch from '../components/NoteSearch'
import { ensureIndexed, search, type Hit } from '../lib/rag'
import Syllabus from '../components/Syllabus'
import PastPapers from '../components/PastPapers'
import Studio from '../components/studio/Studio'
import { askNotes, makeFlashcards, weekendRecap } from '../lib/groq'
import Thinking from '../components/Thinking'

const scheduler = fsrs()
type Tab = 'notes' | 'chat' | 'studio' | 'cards' | 'syllabus' | 'papers' | 'recap'
const TAB_LABEL: Record<Tab, string> = { notes: 'Notes', chat: 'Chat', studio: 'Studio', cards: 'Cards', syllabus: 'Syllabus', papers: 'Past papers', recap: 'Recap' }

export default function Subject() {
  const id = Number(useParams().id)
  const subject = useLiveQuery(() => db.subjects.get(id), [id])
  const notes = useLiveQuery(() => db.notes.where('subjectId').equals(id).toArray(), [id]) ?? []
  const due = useLiveQuery(() => db.flashcards.where('subjectId').equals(id)
    .filter(c => c.due <= new Date().toISOString()).toArray(), [id]) ?? []
  const confusions = useLiveQuery(() => db.confusions.where('subjectId').equals(id).filter(c => !c.resolved).toArray(), [id]) ?? []
  const redTopics = useLiveQuery(() => db.topics.where('subjectId').equals(id).filter(t => t.rating === 'red').toArray(), [id]) ?? []

  const [tab, setTab] = useState<Tab>('notes')
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState(''); const [answer, setAnswer] = useState('')
  const [flip, setFlip] = useState(false); const [recap, setRecap] = useState('')
  const [draft, setDraft] = useState({ title: '', content: '' })
  const [importing, setImporting] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [indexStatus, setIndexStatus] = useState('')
  const [sources, setSources] = useState<Hit[]>([])
  // Index new notes right away so search/chat are instant later. Failure is fine: chat retries, search falls back to keywords.
  const indexInBackground = () => { ensureIndexed(id, setIndexStatus).catch(() => setIndexStatus('')) }

  if (!subject) return null
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } catch (e) { await notify("Something went wrong", (e as Error).message) } finally { setBusy(false) } }

  const importFiles = async (files: File[]) => {
    const failed: string[] = []
    for (const f of files) {
      try {
        setImporting(`${f.name}: starting…`)
        const content = await extractText(f, msg => setImporting(`${f.name}: ${msg}`))
        if (!content.trim()) throw new Error('no text found')
        await db.notes.add({ subjectId: id, title: f.name.replace(/\.[^.]+$/, ''), content, createdAt: new Date().toISOString() })
      } catch (err) { failed.push(`${f.name} (${(err as Error).message})`) }
    }
    setImporting('')
    indexInBackground()
    if (failed.length) await notify("Couldn't import some files", failed.join('\n'))
  }
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); importFiles(Array.from(e.dataTransfer.files)) }

  const genCards = () => run(async () => {
    const cards = await makeFlashcards(subject.name, notes.map(n => n.content).join('\n\n'))
    const now = new Date().toISOString()
    await db.flashcards.bulkAdd(cards.map(c => ({ subjectId: id, ...c, due: now })))
    setTab('cards')
  })

  const grade = async (g: Grade) => {
    const c = due[0]
    const card: Card = c.fsrs ? JSON.parse(c.fsrs) : createEmptyCard()
    const next = scheduler.next({ ...card, due: new Date(card.due) }, new Date(), g).card
    await db.flashcards.update(c.id!, { fsrs: JSON.stringify(next), due: next.due.toISOString() })
    if (g === Rating.Again) await db.confusions.add({ subjectId: id, text: `${c.front} → ${c.back}`, source: 'card', createdAt: new Date().toISOString() })
    setFlip(false)
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-4 rounded-full" style={{ background: subject.color }} />
        <h1 className="text-2xl font-bold">{subject.name}</h1>
        <label className="ml-auto muted text-sm">Exam <input type="date" className="input !w-auto" value={subject.examDate ?? ''}
          onChange={e => db.subjects.update(id, { examDate: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(TAB_LABEL) as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-full ${tab === t ? 'bg-[var(--accent)] text-white' : 'panel'}`}>
            {TAB_LABEL[t]}{t === 'cards' && due.length ? ` (${due.length})` : ''}{t === 'recap' && confusions.length + redTopics.length ? ` (${confusions.length + redTopics.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'notes' && <div className="space-y-3">
        <label onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
          className={`panel p-8 text-center block cursor-pointer border-2 border-dashed ${dragOver ? '!border-[var(--accent)]' : ''}`}>
          <input type="file" multiple hidden accept=".pdf,.docx,.txt,.md,image/*" disabled={!!importing}
            onChange={e => { importFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          {importing ? <Thinking state="shaping" label={importing} /> : <>
            <div className="font-medium">Drop notes here or click to choose</div>
            <div className="muted text-sm mt-1">PDF · Word (.docx) · photos of handwritten notes · text</div>
          </>}
        </label>
        <div className="panel p-4 space-y-2">
          <input className="input" placeholder="Note title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          <textarea className="input h-28" placeholder="Paste or type notes…" value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} />
          <button className="btn" disabled={!draft.content} onClick={async () => {
            await db.notes.add({ subjectId: id, title: draft.title || 'Untitled', content: draft.content, createdAt: new Date().toISOString() })
            setDraft({ title: '', content: '' })
            indexInBackground()
          }}>Save note</button>
        </div>
        <NoteSearch subjectId={id} disabled={!notes.length} />
        {indexStatus && <p className="muted text-sm"><Thinking state="searching" label={indexStatus} /></p>}
        {notes.map(n => (
          <details key={n.id} className="panel p-4 group">
            <summary className="font-medium cursor-pointer flex">
              <span className="flex-1">{n.title}</span>
              <button className="muted text-sm opacity-0 group-hover:opacity-100" onClick={async e => {
                e.preventDefault()
                if (await confirmBox(`Delete "${n.title}"?`, 'The note and its search index are removed.')) db.notes.delete(n.id!)
              }}>Delete</button>
            </summary>
            <pre className="whitespace-pre-wrap text-sm mt-2 font-sans">{n.content}</pre>
          </details>
        ))}
      </div>}

      {tab === 'chat' && <div className="panel p-4 space-y-3">
        <form className="flex gap-2" onSubmit={e => {
          e.preventDefault()
          run(async () => {
            await ensureIndexed(id, setIndexStatus)
            const hits = await search(id, q, 6)
            setSources(hits)
            setAnswer(await askNotes(subject.name, hits.map(h => ({ title: h.noteTitle, text: h.chunk.text })), q))
          })
        }}>
          <input className="input" placeholder={`Ask about your ${subject.name} notes…`} value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn" disabled={busy || !q.trim() || !notes.length}>{busy ? <Thinking onAccent state="searching" label="Thinking…" /> : 'Ask'}</button>
        </form>
        {!notes.length && <p className="muted text-sm">Add some notes first — answers come only from your own notes.</p>}
        {indexStatus && <p className="muted text-sm"><Thinking state="searching" label={indexStatus} /></p>}
        {answer && <>
          <div className="whitespace-pre-wrap">{answer}</div>
          {sources.length > 0 && <div className="space-y-1">
            <div className="muted text-xs uppercase tracking-wide">Sources</div>
            {sources.map((h, i) => (
              <details key={h.chunk.id} className="text-sm rounded-lg bg-[var(--bg)] px-3 py-1.5">
                <summary className="cursor-pointer"><b>[{i + 1}]</b> {h.noteTitle} <span className="muted">· part {h.chunk.idx + 1}</span></summary>
                <p className="whitespace-pre-wrap mt-1 muted">{h.chunk.text}</p>
              </details>
            ))}
          </div>}
          <button className="text-sm muted underline" onClick={() => db.confusions.add({ subjectId: id, text: q, source: 'chat', createdAt: new Date().toISOString() })}>I still don't get this → add to weekend recap</button>
        </>}
      </div>}

      {tab === 'cards' && <div className="space-y-3">
        <button className="btn" disabled={busy || !notes.length} onClick={genCards}>{busy ? <Thinking onAccent state="shaping" label="Making cards…" /> : 'Generate flashcards from notes'}</button>
        {due[0] ? <div className="panel p-8 text-center space-y-4">
          <div className="text-xl">{due[0].front}</div>
          {flip ? <>
            <div className="muted">{due[0].back}</div>
            <div className="flex gap-2 justify-center">
              <button className="btn !bg-red-500" onClick={() => grade(Rating.Again)}>Didn't get it</button>
              <button className="btn !bg-orange-500" onClick={() => grade(Rating.Hard)}>Hard</button>
              <button className="btn !bg-green-600" onClick={() => grade(Rating.Good)}>Good</button>
              <button className="btn" onClick={() => grade(Rating.Easy)}>Easy</button>
            </div>
          </> : <button className="btn" onClick={() => setFlip(true)}>Show answer</button>}
        </div> : <p className="muted">No cards due. 🎉</p>}
      </div>}

      {tab === 'studio' && <Studio subjectId={id} subjectName={subject.name} />}
      {tab === 'syllabus' && <Syllabus subjectId={id} subjectName={subject.name} />}
      {tab === 'papers' && <PastPapers subjectId={id} subjectName={subject.name} />}

      {tab === 'recap' && <div className="panel p-4 space-y-3">
        <p className="muted text-sm">Everything you marked "didn't get it" this week, weak past-paper answers, and syllabus topics rated red. Best done on Saturday/Sunday.</p>
        <ul className="list-disc pl-5">
          {confusions.map(c => <li key={c.id}>{c.text}</li>)}
          {redTopics.map(t => <li key={'t' + t.id} className="text-red-500">Red topic: {t.code} {t.title}</li>)}
        </ul>
        <button className="btn" disabled={busy || !(confusions.length + redTopics.length)} onClick={() => run(async () => setRecap(await weekendRecap(subject.name,
          [...confusions.map(c => c.text), ...redTopics.map(t => `Syllabus topic I rated red: ${t.code} ${t.title}`)])))}>Build recap</button>
        {recap && <>
          <div className="whitespace-pre-wrap">{recap}</div>
          <button className="btn !bg-green-600" onClick={async () => { await db.confusions.bulkUpdate(confusions.map(c => ({ key: c.id!, changes: { resolved: true } }))); setRecap('') }}>Got it all — clear list</button>
        </>}
      </div>}
    </div>
  )
}
