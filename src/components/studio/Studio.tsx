import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import Quiz from './Quiz'
import Summary from './Summary'
import MindMap from './MindMap'
import AudioOverview from './AudioOverview'

const TOOLS = [
  { id: 'quiz', icon: '❓', label: 'Quiz' },
  { id: 'summary', icon: '📄', label: 'Revision sheet' },
  { id: 'mindmap', icon: '🧠', label: 'Mind map' },
  { id: 'audio', icon: '🎧', label: 'Audio overview' },
] as const
type Tool = typeof TOOLS[number]['id']

/** NotebookLM-style studio: pick which notes to use, then a tool. */
export default function Studio({ subjectId, subjectName }: { subjectId: number; subjectName: string }) {
  const notes = useLiveQuery(() => db.notes.where('subjectId').equals(subjectId).toArray(), [subjectId]) ?? []
  const [noteId, setNoteId] = useState<string>('all')
  const [tool, setTool] = useState<Tool>('quiz')

  const chosen = noteId === 'all' ? notes : notes.filter(n => String(n.id) === noteId)
  const source = chosen.map(n => `### ${n.title}\n${n.content}`).join('\n\n')
  const sourceLabel = noteId === 'all' ? `All ${subjectName} notes` : chosen[0]?.title ?? ''

  if (!notes.length) return <div className="panel p-6 muted">Add some notes first — everything in Studio is made from your own notes.</div>

  return (
    <div className="space-y-3">
      <div className="panel p-3 flex flex-wrap items-center gap-2">
        <span className="muted text-sm">Using</span>
        <select className="input !w-auto text-sm" value={noteId} onChange={e => setNoteId(e.target.value)}>
          <option value="all">All notes ({notes.length})</option>
          {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
        </select>
        {source.length > 22000 && <span className="text-xs text-amber-500">Long — only the first part is used. Pick a single note for best results.</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)}
            className={`panel p-3 text-left transition ${tool === t.id ? '!border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'hover:bg-[var(--line)]'}`}>
            <div className="text-xl">{t.icon}</div><div className="text-sm font-medium mt-1">{t.label}</div>
          </button>
        ))}
      </div>
      <div className="panel p-5">
        {/* key forces a fresh tool when the source changes */}
        {tool === 'quiz' && <Quiz key={noteId} subjectId={subjectId} subjectName={subjectName} source={source} />}
        {tool === 'summary' && <Summary key={noteId} subjectId={subjectId} subjectName={subjectName} source={source} sourceLabel={sourceLabel} />}
        {tool === 'mindmap' && <MindMap key={noteId} subjectName={subjectName} source={source} />}
        {tool === 'audio' && <AudioOverview key={noteId} subjectName={subjectName} source={source} />}
      </div>
    </div>
  )
}
