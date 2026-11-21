import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { makeQuiz, type QuizQ } from '../../lib/studio'
import { notify } from '../Dialog'
import Thinking from '../Thinking'
import Art from '../Art'

const LETTERS = 'ABCD'

export default function Quiz({ subjectId, subjectName, source }: { subjectId: number; subjectName: string; source: string }) {
  const history = useLiveQuery(() => db.quizzes.where('subjectId').equals(subjectId).reverse().sortBy('date'), [subjectId]) ?? []
  const [qs, setQs] = useState<QuizQ[] | null>(null)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [busy, setBusy] = useState(false)
  const [n, setN] = useState(8)
  const [level, setLevel] = useState<'easy' | 'exam' | 'hard'>('exam')

  const generate = async () => {
    setBusy(true)
    try {
      const q = await makeQuiz(subjectName, source, n, level)
      if (!q.length) throw new Error('No questions came back — try again.')
      setQs(q); setI(0); setPicked(null); setScore(0)
    } catch (e) { await notify("Couldn't make a quiz", (e as Error).message) }
    finally { setBusy(false) }
  }

  const choose = async (k: number) => {
    if (picked !== null || !qs) return
    setPicked(k)
    const q = qs[i]
    if (k === q.answer) setScore(s => s + 1)
    else await db.confusions.add({ subjectId, source: 'manual', createdAt: new Date().toISOString(), text: `Quiz: ${q.q} → ${q.options[q.answer]}` })
  }
  const next = async () => {
    if (!qs) return
    if (i + 1 < qs.length) { setI(i + 1); setPicked(null); return }
    await db.quizzes.add({ subjectId, score, total: qs.length, date: new Date().toISOString() })
    setI(qs.length) // results screen
  }

  if (qs && i >= qs.length) {
    const pct = Math.round((score / qs.length) * 100)
    return (
      <div className="text-center space-y-3 py-4">
        <Art name={pct >= 80 ? 'quests' : pct >= 50 ? 'thumbsup' : 'books'} size={72} className="mx-auto" />
        <div className="text-3xl font-bold">{score}/{qs.length}</div>
        <p className="muted">{pct >= 80 ? 'Excellent — you know this.' : pct >= 50 ? 'Good going. Missed ones are in your weekend recap.' : 'Worth another look. Missed ones are in your weekend recap.'}</p>
        <div className="flex gap-2 justify-center">
          <button className="btn" onClick={generate} disabled={busy}>{busy ? <Thinking onAccent state="solving" label="Writing…" /> : 'New quiz'}</button>
          <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)]" onClick={() => setQs(null)}>Done</button>
        </div>
      </div>
    )
  }

  if (qs) {
    const q = qs[i]
    return (
      <div className="space-y-3">
        <div className="flex justify-between text-sm muted"><span>Question {i + 1} of {qs.length} · {q.topic}</span><span>Score {score}</span></div>
        <div className="h-1 rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(i / qs.length) * 100}%` }} /></div>
        <p className="text-lg font-medium">{q.q}</p>
        <div className="space-y-2">
          {q.options.map((o, k) => {
            const state = picked === null ? '' : k === q.answer ? 'border-green-500 bg-green-500/10' : k === picked ? 'border-red-500 bg-red-500/10' : 'opacity-50'
            return (
              <button key={k} onClick={() => choose(k)} disabled={picked !== null}
                className={`w-full text-left flex gap-3 items-start p-3 rounded-xl border-2 border-[var(--line)] transition ${picked === null ? 'hover:border-[var(--accent)]' : ''} ${state}`}>
                <span className="font-semibold muted">{LETTERS[k]}</span><span>{o}</span>
              </button>
            )
          })}
        </div>
        {picked !== null && <>
          <p className={`text-sm rounded-lg p-3 ${picked === q.answer ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <b>{picked === q.answer ? 'Correct! ' : `Answer: ${LETTERS[q.answer]}. `}</b>{q.explain}
          </p>
          <button className="btn" onClick={next}>{i + 1 < qs.length ? 'Next question' : 'See results'}</button>
        </>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="muted text-sm">IGCSE-style multiple choice from your notes. Anything you get wrong goes into the weekend recap.</p>
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <label className="flex items-center gap-2"><span className="muted">Questions</span>
          <select className="input !w-auto" value={n} onChange={e => setN(Number(e.target.value))}>{[5, 8, 10, 15].map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="flex items-center gap-2"><span className="muted">Level</span>
          <select className="input !w-auto" value={level} onChange={e => setLevel(e.target.value as typeof level)}>
            <option value="easy">Warm-up</option><option value="exam">Exam</option><option value="hard">Stretch (A*)</option></select></label>
        <button className="btn" onClick={generate} disabled={busy || !source}>{busy ? <Thinking onAccent state="solving" label="Writing questions…" /> : 'Start quiz'}</button>
      </div>
      {history.length > 0 && <div className="text-sm">
        <div className="muted mb-1">Recent scores</div>
        <div className="flex gap-2 flex-wrap">{history.slice(0, 8).map(h => {
          const p = h.score / h.total
          return <span key={h.id} className={`px-2 py-0.5 rounded-full tabular-nums ${p >= 0.8 ? 'bg-green-500/15 text-green-600' : p >= 0.5 ? 'bg-amber-500/15 text-amber-600' : 'bg-red-500/15 text-red-500'}`}>{h.score}/{h.total}</span>
        })}</div>
      </div>}
    </div>
  )
}
