import { useState } from 'react'
import { db } from '../../lib/db'
import { makeSummary, md } from '../../lib/studio'
import { notify } from '../Dialog'
import Thinking from '../Thinking'

export default function Summary({ subjectId, subjectName, source, sourceLabel }: { subjectId: number; subjectName: string; source: string; sourceLabel: string }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const go = async () => {
    setBusy(true); setSaved(false)
    try { setText(await makeSummary(subjectName, source)) } catch (e) { await notify("Couldn't write the summary", (e as Error).message) }
    finally { setBusy(false) }
  }
  const save = async () => {
    await db.notes.add({ subjectId, title: `Revision sheet: ${sourceLabel}`, content: text, createdAt: new Date().toISOString() })
    setSaved(true)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <p className="muted text-sm flex-1">A one-page revision sheet: key ideas, key terms, common mistakes and quick self-test questions.</p>
        <button className="btn" onClick={go} disabled={busy || !source}>{busy ? <Thinking onAccent state="composing" label="Writing…" /> : text ? 'Rewrite' : 'Make revision sheet'}</button>
      </div>
      {text && <>
        <article className="prose-sheet" dangerouslySetInnerHTML={{ __html: md(text) }} />
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)] text-sm" onClick={save} disabled={saved}>{saved ? 'Saved to notes ✓' : 'Save as note'}</button>
          <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)] text-sm" onClick={() => window.print()}>Print</button>
        </div>
      </>}
    </div>
  )
}
