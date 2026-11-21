import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Attempt } from '../lib/db'
import { markAnswer } from '../lib/groq'
import { extractText } from '../lib/extract'
import { notify } from './Dialog'
import Thinking from './Thinking'
import Art from './Art'

const empty = { paper: '', question: '', scheme: '', answer: '' }
const pct = (a: Pick<Attempt, 'score' | 'max'>) => (a.max ? Math.round((a.score / a.max) * 100) : 0)
const tone = (p: number) => (p >= 70 ? 'text-green-500' : p >= 40 ? 'text-amber-500' : 'text-red-500')

/** Paste or load a question + mark scheme, write an answer, get it marked like an examiner. */
export default function PastPapers({ subjectId, subjectName }: { subjectId: number; subjectName: string }) {
  const attempts = useLiveQuery(() => db.attempts.where('subjectId').equals(subjectId).reverse().sortBy('createdAt'), [subjectId]) ?? []
  const [f, setF] = useState(empty)
  const [busy, setBusy] = useState('')
  const [result, setResult] = useState<Attempt | null>(null)
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const loadFile = (k: 'question' | 'scheme') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try { setBusy(`Reading ${file.name}…`); const t = await extractText(file, m => setBusy(m)); setF(p => ({ ...p, [k]: t, paper: p.paper || file.name.replace(/\.[^.]+$/, '') })) }
    catch (err) { await notify("Couldn't read file", (err as Error).message) }
    finally { setBusy('') }
  }

  const mark = async () => {
    setBusy('Marking…')
    try {
      const r = await markAnswer(subjectName, f.question, f.scheme, f.answer)
      const a: Attempt = { subjectId, ...f, paper: f.paper || 'Practice question', score: r.score, max: r.max, feedback: r.feedback, createdAt: new Date().toISOString() }
      a.id = await db.attempts.add(a)
      // Weak answers feed the weekend recap
      if (pct(a) < 60) await db.confusions.add({
        subjectId, source: 'manual', createdAt: a.createdAt,
        text: `Past paper (${a.score}/${a.max}): ${r.weakTopic || f.question.slice(0, 120)}`,
      })
      setResult(a)
    } catch (e) { await notify('Marking failed', (e as Error).message) }
    finally { setBusy('') }
  }

  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + pct(a), 0) / attempts.length) : null

  return (
    <div className="space-y-3">
      {result ? (
        <div className="panel p-5 space-y-3">
          <div className="flex items-baseline gap-3">
            <span className={`text-4xl font-bold ${tone(pct(result))}`}>{result.score}/{result.max}</span>
            <span className="muted">{pct(result)}% · {result.paper}</span>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{result.feedback}</div>
          {pct(result) < 60 && <p className="text-sm muted flex items-center gap-1.5"><Art name="pin" size={18} /> Added to this weekend's recap.</p>}
          <div className="flex gap-2">
            <button className="btn" onClick={() => { setResult(null); setF({ ...empty, paper: f.paper, scheme: '' }) }}>Next question</button>
            <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)]" onClick={() => setResult(null)}>Edit answer & retry</button>
          </div>
        </div>
      ) : (
        <div className="panel p-4 space-y-3">
          <input className="input" placeholder="Paper (e.g. 0620/42 May/June 2024 Q3b)" value={f.paper} onChange={set('paper')} />
          {(['question', 'scheme'] as const).map(k => (
            <div key={k}>
              <div className="flex justify-between text-sm mb-1">
                <span className="muted">{k === 'question' ? 'Question' : 'Mark scheme (optional, but marking is much more accurate with it)'}</span>
                <label className="text-[var(--accent)] cursor-pointer">From PDF/photo<input type="file" hidden accept=".pdf,.docx,.txt,image/*" onChange={loadFile(k)} /></label>
              </div>
              <textarea className="input h-24 text-sm" value={f[k]} onChange={set(k)} placeholder={k === 'question' ? 'Paste the question, including the marks e.g. [3]' : 'Paste the matching mark scheme points'} />
            </div>
          ))}
          <div>
            <div className="muted text-sm mb-1">Your answer</div>
            <textarea className="input h-32" value={f.answer} onChange={set('answer')} placeholder="Answer as you would in the exam" />
          </div>
          <button className="btn" disabled={!!busy || !f.question.trim() || !f.answer.trim()} onClick={mark}>{busy ? <Thinking onAccent state="solving" label={busy} /> : 'Mark my answer'}</button>
        </div>
      )}

      {attempts.length > 0 && <div className="panel p-4">
        <div className="flex justify-between mb-2"><h2 className="font-semibold">History</h2><span className="muted text-sm">Average {avg}%</span></div>
        {attempts.map(a => (
          <details key={a.id} className="border-t border-[var(--line)] py-2">
            <summary className="flex gap-3 cursor-pointer">
              <span className={`font-semibold tabular-nums w-14 ${tone(pct(a))}`}>{a.score}/{a.max}</span>
              <span className="flex-1 truncate">{a.paper}</span>
              <span className="muted text-sm">{new Date(a.createdAt).toLocaleDateString()}</span>
            </summary>
            <div className="text-sm mt-2 space-y-2">
              <p className="whitespace-pre-wrap"><b>Q:</b> {a.question}</p>
              <p className="whitespace-pre-wrap"><b>You:</b> {a.answer}</p>
              <p className="whitespace-pre-wrap">{a.feedback}</p>
            </div>
          </details>
        ))}
      </div>}
    </div>
  )
}
