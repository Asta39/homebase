import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type RAG } from '../lib/db'
import { parseSyllabus } from '../lib/groq'
import { confirmBox, form, notify } from './Dialog'
import Thinking from './Thinking'

const RAGS: { v: RAG; label: string; cls: string }[] = [
  { v: 'red', label: "Don't know", cls: 'bg-red-500' },
  { v: 'amber', label: 'Shaky', cls: 'bg-amber-500' },
  { v: 'green', label: 'Confident', cls: 'bg-green-600' },
]

export default function Syllabus({ subjectId, subjectName }: { subjectId: number; subjectName: string }) {
  const topics = useLiveQuery(() => db.topics.where('subjectId').equals(subjectId).sortBy('order'), [subjectId]) ?? []
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<RAG | 'all'>('all')

  const counts = Object.fromEntries(RAGS.map(r => [r.v, topics.filter(t => t.rating === r.v).length])) as Record<RAG, number>
  const rated = counts.red + counts.amber + counts.green
  const shown = filter === 'all' ? topics : topics.filter(t => t.rating === filter)

  const importSyllabus = async () => {
    const v = await form({
      title: 'Import syllabus', submit: 'Import',
      message: 'Paste the "Subject content" section from the official syllabus PDF, or just type its name (e.g. "Cambridge IGCSE Chemistry 0620").',
      fields: [{ name: 'text', label: 'Syllabus text or name', required: true }],
    })
    if (!v) return
    setBusy(true)
    try {
      const list = await parseSyllabus(subjectName, v.text)
      const start = topics.length
      await db.topics.bulkAdd(list.map((t, i) => ({ subjectId, code: t.code ?? '', title: t.title, rating: 'none' as RAG, order: start + i })))
    } catch (e) { await notify("Couldn't import syllabus", (e as Error).message) }
    finally { setBusy(false) }
  }
  const addTopic = async () => {
    const v = await form({ title: 'Add topic', submit: 'Add', fields: [
      { name: 'code', label: 'Code (optional)', placeholder: 'e.g. 4.2' },
      { name: 'title', label: 'Topic', required: true },
    ] })
    if (v) db.topics.add({ subjectId, code: v.code.trim(), title: v.title.trim(), rating: 'none', order: topics.length })
  }
  const clearAll = async () => {
    if (await confirmBox('Delete all topics?', `Removes all ${topics.length} topics and their ratings for ${subjectName}.`))
      db.topics.where('subjectId').equals(subjectId).delete()
  }

  return (
    <div className="space-y-3">
      <div className="panel p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="font-semibold whitespace-nowrap">Syllabus progress</h2>
          <span className="muted text-sm whitespace-nowrap">{rated}/{topics.length} rated</span>
          <div className="ml-auto flex gap-2 whitespace-nowrap">
            <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)] text-sm" onClick={addTopic}>+ Topic</button>
            <button className="btn text-sm" disabled={busy} onClick={importSyllabus}>{busy ? <Thinking onAccent state="working" label="Reading syllabus…" /> : 'Import syllabus'}</button>
          </div>
        </div>
        {topics.length > 0 && <div className="flex h-3 rounded-full overflow-hidden bg-[var(--line)]">
          {RAGS.map(r => <div key={r.v} className={r.cls} style={{ width: `${(counts[r.v] / topics.length) * 100}%` }} />)}
        </div>}
        <div className="flex flex-wrap gap-2 mt-3 text-sm whitespace-nowrap">
          {(['all', ...RAGS.map(r => r.v), 'none'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full ${filter === f ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--line)]'}`}>
              {f === 'all' ? `All ${topics.length}` : f === 'none' ? `Unrated ${topics.length - rated}` : `${RAGS.find(r => r.v === f)!.label} ${counts[f]}`}
            </button>
          ))}
        </div>
      </div>

      {topics.length === 0 && <p className="muted p-4">No topics yet. Import the syllabus so you can see exactly what's left to learn.</p>}
      <div className="panel divide-y divide-[var(--line)]">
        {shown.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-2 group">
            <span className="muted text-sm w-12 tabular-nums">{t.code}</span>
            <span className="flex-1">{t.title}</span>
            <div className="flex gap-1">
              {RAGS.map(r => (
                <button key={r.v} title={r.label} onClick={() => db.topics.update(t.id!, { rating: t.rating === r.v ? 'none' : r.v })}
                  className={`w-6 h-6 rounded-full transition ${t.rating === r.v ? `${r.cls} ring-2 ring-offset-2 ring-offset-[var(--panel)] ring-[var(--text)]` : `${r.cls} opacity-25 hover:opacity-70`}`} />
              ))}
            </div>
            <button className="muted opacity-0 group-hover:opacity-100 text-sm ml-1" title="Remove topic" onClick={() => db.topics.delete(t.id!)}>✕</button>
          </div>
        ))}
      </div>
      {topics.length > 0 && <button className="text-sm text-red-500" onClick={clearAll}>Delete all topics</button>}
    </div>
  )
}
