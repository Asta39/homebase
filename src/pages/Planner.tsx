import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, type CalEvent } from '../lib/db'
import { buildPlan, summarize, weakness, PLANNER_DEFAULTS, type Block, type PlannerSettings } from '../lib/planner'
import { confirmBox, notify } from '../components/Dialog'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ORDER = [1, 2, 3, 4, 5, 6, 0]
const pad = (n: number) => String(n).padStart(2, '0')
/** Local "YYYY-MM-DDTHH:mm:00" — same format the calendar uses, so the dashboard's "today" filter works. */
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`

export default function Planner() {
  const [cfg, setCfg] = useState<PlannerSettings>(PLANNER_DEFAULTS)
  useEffect(() => { getSetting('planner').then(v => v && setCfg({ ...PLANNER_DEFAULTS, ...JSON.parse(v) })) }, [])
  const update = (patch: Partial<PlannerSettings>) => { const next = { ...cfg, ...patch }; setCfg(next); setSetting('planner', JSON.stringify(next)) }
  const setDay = (i: number, v: PlannerSettings['week'][number]) => update({ week: cfg.week.map((d, j) => (j === i ? v : d)) })

  const subjects = useLiveQuery(() => db.subjects.toArray()) ?? []
  const topics = useLiveQuery(() => db.topics.toArray()) ?? []
  const events = useLiveQuery(() => db.events.toArray()) ?? []
  const planned = events.filter(e => e.auto && new Date(e.start) >= new Date()).length

  const planSubjects = subjects.map(s => ({ id: s.id!, name: s.name, examDate: s.examDate, topics: topics.filter(t => t.subjectId === s.id) }))
  const noDate = subjects.filter(s => !s.examDate)

  // Preview, recomputed as settings change
  const preview: Block[] = useMemo(() => {
    const busy = events.filter(e => !e.auto && !e.allDay && e.end).map(e => ({ start: new Date(e.start), end: new Date(e.end!) }))
    return buildPlan(planSubjects, busy, cfg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, subjects, topics, events])
  const hours = summarize(preview, cfg)
  const maxH = Math.max(1, ...hours.values())
  const studyCount = preview.filter(b => b.kind === 'study').length

  const apply = async () => {
    if (planned && !(await confirmBox('Replace current plan?', `Removes ${planned} upcoming planner sessions and creates ${preview.length} new ones. Your own events are never touched.`, 'Replace'))) return
    const now = new Date()
    await db.transaction('rw', db.events, async () => {
      await db.events.filter(e => !!e.auto && new Date(e.start) >= now).delete()
      await db.events.bulkAdd(preview.map(b => ({
        title: b.title, subjectId: b.subjectId, kind: b.kind, auto: true,
        ...(b.kind === 'exam' ? { start: local(b.start).slice(0, 10), allDay: true } : { start: local(b.start), end: local(b.end) }),
      }) satisfies CalEvent))
    })
    await notify('Plan added to your calendar', `${studyCount} study sessions until your last exam. Drag any of them to move it — regenerate anytime.`)
  }
  const clear = async () => {
    if (await confirmBox('Remove the study plan?', 'Deletes all upcoming planner sessions. Your own events stay.', 'Remove'))
      db.events.filter(e => !!e.auto && new Date(e.start) >= new Date()).delete()
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Study planner</h1>
        <p className="muted">Fills your free time with revision until your exams — weakest subjects and topics first, never clashing with your own events.</p>
      </div>

      {noDate.length > 0 && <div className="panel p-4 text-sm border-amber-500/50">
        ⚠️ No exam date for <b>{noDate.map(s => s.name).join(', ')}</b>. Set dates on each subject page in <Link className="text-[var(--accent)]" to="/study">Study</Link> so the plan knows what's urgent.
      </div>}

      <section className="panel p-5 space-y-3">
        <h2 className="font-semibold">When can you study?</h2>
        {ORDER.map(i => {
          const d = cfg.week[i]
          return (
            <div key={i} className="flex items-center gap-3 text-sm">
              <label className="w-16 flex items-center gap-2">
                <input type="checkbox" className="accent-[var(--accent)]" checked={!!d} onChange={e => setDay(i, e.target.checked ? { from: '16:30', to: '19:30' } : null)} />
                {DAYS[i]}
              </label>
              {d ? <>
                <input type="time" className="input !w-auto" value={d.from} onChange={e => setDay(i, { ...d, from: e.target.value })} />
                <span className="muted">to</span>
                <input type="time" className="input !w-auto" value={d.to} onChange={e => setDay(i, { ...d, to: e.target.value })} />
              </> : <span className="muted">Day off</span>}
            </div>
          )
        })}
        <div className="flex flex-wrap gap-4 pt-2 text-sm">
          {([['sessionMin', 'Session', [25, 30, 45, 60, 90]], ['breakMin', 'Break', [5, 10, 15, 20, 30]], ['maxPerDay', 'Max per day', [1, 2, 3, 4, 5, 6]]] as const).map(([k, label, opts]) => (
            <label key={k} className="flex items-center gap-2">
              <span className="muted">{label}</span>
              <select className="input !w-auto" value={cfg[k]} onChange={e => update({ [k]: Number(e.target.value) })}>
                {opts.map(o => <option key={o} value={o}>{k === 'maxPerDay' ? o : `${o} min`}</option>)}
              </select>
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-[var(--accent)]" checked={cfg.weekendRecap} onChange={e => update({ weekendRecap: e.target.checked })} />
            Weekend recap session
          </label>
        </div>
      </section>

      <section className="panel p-5 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Preview</h2>
          <span className="muted text-sm">{studyCount} sessions · {Math.round(studyCount * cfg.sessionMin / 60)} h</span>
        </div>
        {!subjects.length ? <p className="muted">Add subjects first.</p> : subjects.map(s => {
          const h = hours.get(s.id!) ?? 0
          return (
            <div key={s.id} className="flex items-center gap-3 text-sm">
              <span className="w-28 truncate">{s.name}</span>
              <div className="flex-1 h-3 rounded-full bg-[var(--line)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(h / maxH) * 100}%`, background: s.color }} />
              </div>
              <span className="w-14 text-right tabular-nums">{h.toFixed(1)} h</span>
              <span className="w-24 muted text-xs">{s.examDate ? `exam ${new Date(s.examDate + 'T00:00').toLocaleDateString([], { day: 'numeric', month: 'short' })}` : 'no date'} · need {weakness(planSubjects.find(p => p.id === s.id)!).toFixed(0)}</span>
            </div>
          )
        })}
        {preview.length > 0 && <details className="text-sm">
          <summary className="cursor-pointer muted">First week</summary>
          <ul className="mt-2 space-y-0.5">{preview.filter(b => +b.start < Date.now() + 7 * 864e5).map((b, i) => (
            <li key={i}><span className="muted tabular-nums">{b.start.toLocaleDateString([], { weekday: 'short', day: 'numeric' })} {b.kind !== 'exam' && b.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> {b.title}</li>
          ))}</ul>
        </details>}
        <div className="flex gap-2 pt-1">
          <button className="btn" disabled={!preview.length} onClick={apply}>{planned ? 'Regenerate plan' : 'Add plan to calendar'}</button>
          {planned > 0 && <>
            <Link to="/calendar" className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)]">View calendar</Link>
            <button className="ml-auto text-sm text-red-500" onClick={clear}>Remove plan</button>
          </>}
        </div>
      </section>
    </div>
  )
}
