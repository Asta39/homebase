import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { coachNote, effortGrade, mondayOf, weekStats, type WeekStats } from '../lib/report'
import { md } from '../lib/studio'
import { MOODS } from '../lib/wellbeing'
import { getSetting, setSetting } from '../lib/db'
import { notify } from '../components/Dialog'
import Thinking from '../components/Thinking'
import Art from '../components/Art'

const h = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m` : `${Math.round(min)}m`)

function Delta({ now, prev, unit = '' }: { now: number; prev: number; unit?: string }) {
  if (!prev && !now) return null
  const d = now - prev
  if (Math.abs(d) < 0.5) return <span className="muted text-xs">same as last week</span>
  return <span className={`text-xs ${d > 0 ? 'text-green-500' : 'text-amber-500'}`}>{d > 0 ? '▲' : '▼'} {unit === 'min' ? h(Math.abs(d)) : Math.abs(Math.round(d))} vs last week</span>
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return <div className="panel p-4"><div className="muted text-xs uppercase tracking-wide">{label}</div><div className="text-2xl font-semibold mt-1">{value}</div>{sub && <div className="mt-0.5">{sub}</div>}</div>
}

export default function Report() {
  const [params] = useSearchParams()
  const [monday, setMonday] = useState(() => { const m = mondayOf(new Date()); if (params.get('last')) m.setDate(m.getDate() - 7); return m })
  const [s, setS] = useState<WeekStats | null>(null)
  const [prev, setPrev] = useState<WeekStats | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const key = `coach-${monday.toISOString().slice(0, 10)}`
  const isThisWeek = +monday === +mondayOf(new Date())

  useEffect(() => {
    const p = new Date(monday); p.setDate(p.getDate() - 7)
    Promise.all([weekStats(monday), weekStats(p)]).then(([a, b]) => { setS(a); setPrev(b) })
    getSetting(key).then(setNote)
  }, [+monday]) // eslint-disable-line react-hooks/exhaustive-deps

  const shift = (n: number) => { const m = new Date(monday); m.setDate(m.getDate() + n * 7); setMonday(m); setS(null); setNote('') }
  const writeNote = async () => {
    if (!s || !prev) return
    setBusy(true)
    try { const n = await coachNote(s, prev); setNote(n); await setSetting(key, n) } catch (e) { await notify("Couldn't write the coach note", (e as Error).message) }
    finally { setBusy(false) }
  }

  const end = new Date(monday); end.setDate(end.getDate() + 6)
  const range = `${monday.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString([], { day: 'numeric', month: 'short' })}`
  const g = s ? effortGrade(s) : null
  const maxMin = s ? Math.max(1, ...s.bySubject.map(b => b.min)) : 1

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold mr-auto">Weekly report</h1>
        <button className="w-8 h-8 rounded-full hover:bg-[var(--line)]" onClick={() => shift(-1)} aria-label="Previous week"><Art name="arrow" size={18} className="rotate-180 mx-auto" /></button>
        <span className="font-medium tabular-nums">{range}{isThisWeek && <span className="muted text-sm"> (so far)</span>}</span>
        <button className="w-8 h-8 rounded-full hover:bg-[var(--line)] disabled:opacity-30" onClick={() => shift(1)} disabled={isThisWeek} aria-label="Next week"><Art name="arrow" size={18} className="mx-auto" /></button>
        <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)] text-sm" onClick={() => window.print()}>Print</button>
      </div>

      {!s || !prev ? <p className="muted">Adding up your week…</p> : <>
        <section className="panel p-5 flex flex-wrap gap-6 items-center">
          <div className="text-center">
            <div className={`text-6xl font-black ${g!.pts >= 75 ? 'text-green-500' : g!.pts >= 50 ? 'text-[var(--accent)]' : 'text-amber-500'}`}>{g!.grade}</div>
            <div className="muted text-xs mt-1">effort grade · {g!.pts}/100</div>
          </div>
          <div className="flex-1 min-w-60 space-y-2">
            {note
              ? <div className="prose-sheet text-sm" dangerouslySetInnerHTML={{ __html: md(note) }} />
              : <p className="muted text-sm">Grades effort, not ability: time studied vs your plan, practice, workouts, habits and sleep.</p>}
            <button className="text-sm text-[var(--accent)]" onClick={writeNote} disabled={busy}>{busy ? <Thinking state="composing" label="Writing…" /> : note ? <span className="inline-flex items-center gap-1"><Art name="refresh" size={16} />Rewrite coach note</span> : <span className="inline-flex items-center gap-1"><Art name="level" size={16} />Get a coach note</span>}</button>
          </div>
        </section>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Studied" value={h(s.focusMin)} sub={<Delta now={s.focusMin} prev={prev.focusMin} unit="min" />} />
          <Tile label="Vs plan" value={s.plannedMin ? `${Math.round((s.focusMin / s.plannedMin) * 100)}%` : '–'} sub={<span className="muted text-xs">{s.plannedMin ? `of ${h(s.plannedMin)} planned` : 'no plan this week'}</span>} />
          <Tile label="Flashcards" value={s.reviewed} sub={<span className="muted text-xs">reviewed · {s.mastered} mastered total</span>} />
          <Tile label="Quizzes" value={s.quizPct != null ? `${s.quizPct}%` : '–'} sub={<span className="muted text-xs">{s.quizzes} taken{s.papers ? ` · papers ${s.paperPct}%` : ''}</span>} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel p-5">
            <h2 className="font-semibold mb-3">Time by subject</h2>
            {s.bySubject.length ? s.bySubject.map(b => (
              <div key={String(b.id)} className="flex items-center gap-3 text-sm mb-2">
                <span className="w-28 truncate">{b.name}</span>
                <div className="flex-1 h-3 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(b.min / maxMin) * 100}%`, background: b.color }} /></div>
                <span className="w-16 text-right tabular-nums muted">{h(b.min)}</span>
              </div>
            )) : <p className="muted text-sm">No focus sessions logged. Use Focus while studying so it counts here.</p>}
          </section>

          <section className="panel p-5 space-y-3">
            <h2 className="font-semibold">Topics</h2>
            {s.improved.length > 0 && <div>
              <div className="text-sm text-green-500 font-medium mb-1">▲ Improved ({s.improved.length})</div>
              <ul className="text-sm space-y-0.5">{s.improved.map((t, i) => <li key={i}>{t.subject}: {t.title} <span className="muted">({t.from} → {t.to})</span></li>)}</ul>
            </div>}
            <div>
              <div className="text-sm text-red-500 font-medium mb-1">Still red ({s.red.length})</div>
              {s.red.length ? <ul className="text-sm space-y-0.5">{s.red.slice(0, 6).map((t, i) => <li key={i}>{t.subject}: {t.title}</li>)}{s.red.length > 6 && <li className="muted">+{s.red.length - 6} more</li>}</ul>
                : <p className="muted text-sm flex items-center gap-1.5">None <Art name="party" size={18} /></p>}
            </div>
            <p className="muted text-xs">{s.flagged} thing{s.flagged === 1 ? '' : 's'} flagged for the weekend recap this week.</p>
          </section>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Tile label="Workouts" value={`${s.workoutDays}/${s.workoutPlanned}`} sub={<span className="muted text-xs">{s.setsDone} sets</span>} />
          <Tile label="Sleep" value={s.sleep != null ? `${s.sleep.toFixed(1)}h` : '–'} sub={prev.sleep != null && s.sleep != null ? <Delta now={s.sleep} prev={prev.sleep} /> : <span className="muted text-xs">avg per night</span>} />
          <Tile label="Mood" value={s.mood ? <Art name={MOODS[Math.round(s.mood) - 1]} size={34} /> : '–'} sub={<span className="muted text-xs">average</span>} />
          <Tile label="Habits" value={s.habitPct != null ? `${s.habitPct}%` : '–'} sub={<span className="muted text-xs">{s.water != null ? <span className="inline-flex items-center gap-1"><Art name="water" size={14} />{s.water.toFixed(1)} glasses/day</span> : 'done'}</span>} />
        </div>
      </>}
    </div>
  )
}
