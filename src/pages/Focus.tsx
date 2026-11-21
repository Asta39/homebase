import { useEffect, useState } from 'react'
import { BorderBeam } from 'border-beam'
import { useMode } from "../lib/theme"
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { askNotificationPermission, fmt, pause, resume, skipBreak, start, stop, timeLeft, useFocus } from '../lib/focus'

const PRESETS = [[25, 5], [45, 10], [50, 10], [15, 3]] as const
const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString() }

export default function Focus() {
  const { resolved } = useMode()
  const s = useFocus()
  const subjects = useLiveQuery(() => db.subjects.toArray()) ?? []
  const today = useLiveQuery(() => db.focus.where('start').aboveOrEqual(dayStart()).toArray()) ?? []
  const [subjectId, setSubjectId] = useState<string>('')
  const [topic, setTopic] = useState('')
  const [preset, setPreset] = useState(0)

  // Pre-fill from the study block happening now on the calendar
  const nowBlock = useLiveQuery(async () => {
    const now = new Date()
    return (await db.events.filter(e => e.kind === 'study' && !!e.end && new Date(e.start) <= now && new Date(e.end!) > now).toArray())[0]
  })
  useEffect(() => {
    if (nowBlock && !subjectId) {
      setSubjectId(nowBlock.subjectId ? String(nowBlock.subjectId) : '')
      setTopic(nowBlock.title.split(': ')[1] ?? '')
    }
  }, [nowBlock]) // eslint-disable-line react-hooks/exhaustive-deps

  const subject = subjects.find(x => x.id === s.subjectId)
  const color = subject?.color ?? 'var(--accent)'
  const total = (s.phase === 'break' ? (s.round % 4 === 0 ? s.breakMin * 3 : s.breakMin) : s.focusMin) * 6e4
  const left = timeLeft(s)
  const progress = s.phase === 'idle' ? 0 : 1 - left / total
  const R = 120, C = 2 * Math.PI * R

  const mins = today.reduce((t, f) => t + f.minutes, 0)
  const bySubject = subjects.map(x => ({ ...x, m: today.filter(f => f.subjectId === x.id).reduce((t, f) => t + f.minutes, 0) })).filter(x => x.m)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Focus</h1>

      <BorderBeam theme={resolved} size={s.phase === "break" ? "pulse-inner" : "md"} colorVariant={s.phase === "break" ? "mono" : "ocean"} strength={0.8} active={s.phase !== "idle" && !s.paused}>
      <section className="panel p-6 flex flex-col items-center gap-4">
        <div className="relative">
          <svg width="280" height="280" className="-rotate-90">
            <circle cx="140" cy="140" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
            <circle cx="140" cy="140" r={R} fill="none" stroke={s.phase === 'break' ? '#30d158' : color} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset .5s linear' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="muted text-sm uppercase tracking-wide">{s.phase === 'idle' ? 'Ready' : s.phase === 'break' ? (s.round % 4 === 0 ? 'Long break' : 'Break') : s.paused ? 'Paused' : 'Focus'}</div>
            <div className="text-6xl font-semibold tabular-nums">{fmt(s.phase === 'idle' ? PRESETS[preset][0] * 6e4 : left)}</div>
            {s.phase !== 'idle' && <div className="muted text-sm mt-1 max-w-48 truncate">{subject?.name ?? 'General'}{s.topic ? ` · ${s.topic}` : ''}</div>}
            {s.round > 0 && <div className="text-sm mt-1">{'🍅'.repeat(Math.min(s.round, 8))}</div>}
          </div>
        </div>

        {s.phase === 'idle' ? (
          <div className="w-full max-w-sm space-y-3">
            <div className="flex gap-2 justify-center">
              {PRESETS.map(([f, b], i) => (
                <button key={i} onClick={() => setPreset(i)} className={`px-3 py-1.5 rounded-full text-sm ${preset === i ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--line)]'}`}>{f}/{b}</button>
              ))}
            </div>
            <select className="input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">General (no subject)</option>
              {subjects.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <input className="input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topic (optional), e.g. Electrolysis" />
            <button className="btn w-full !py-2.5 text-lg" onClick={() => {
              askNotificationPermission()
              start({ subjectId: subjectId ? Number(subjectId) : undefined, topic: topic.trim() || undefined, focusMin: PRESETS[preset][0], breakMin: PRESETS[preset][1] })
            }}>Start focus</button>
            {nowBlock && <p className="muted text-xs text-center">Filled in from your calendar: {nowBlock.title}</p>}
          </div>
        ) : (
          <div className="flex gap-2">
            {s.paused ? <button className="btn" onClick={resume}>Resume</button> : <button className="btn" onClick={pause}>Pause</button>}
            {s.phase === 'break' && <button className="px-4 py-1.5 rounded-lg hover:bg-[var(--line)]" onClick={skipBreak}>Skip break</button>}
            <button className="px-4 py-1.5 rounded-lg hover:bg-[var(--line)] text-red-500" onClick={stop}>Stop</button>
          </div>
        )}
      </section>
      </BorderBeam>

      <section className="panel p-5">
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="font-semibold">Today</h2>
          <span className="muted text-sm">{Math.floor(mins / 60)}h {mins % 60}m focused · {today.length} session{today.length === 1 ? '' : 's'}</span>
        </div>
        {bySubject.length ? bySubject.map(x => (
          <div key={x.id} className="flex items-center gap-3 text-sm mb-1.5">
            <span className="w-28 truncate">{x.name}</span>
            <div className="flex-1 h-2.5 rounded-full bg-[var(--line)] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(x.m / Math.max(...bySubject.map(y => y.m))) * 100}%`, background: x.color }} />
            </div>
            <span className="w-14 text-right tabular-nums muted">{x.m} min</span>
          </div>
        )) : <p className="muted text-sm">No focus time yet today. Stopping early still counts the minutes you did.</p>}
      </section>
    </div>
  )
}
