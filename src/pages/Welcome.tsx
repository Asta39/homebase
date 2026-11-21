import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import ThemePicker from '../components/ThemePicker'
import ActivityRings from '../components/ActivityRings'
import { db, getSetting, setSetting } from '../lib/db'
import { searchPlaces, type Place } from '../lib/weather'
import { useTheme } from '../lib/theme'
import { celebrate } from '../lib/celebrate'
import type { Ring } from '../lib/gamify'
import Art from '../components/Art'

const STEPS = [
  { key: 'hello', label: 'Welcome' },
  { key: 'look', label: 'Your look' },
  { key: 'ai', label: 'Study AI' },
  { key: 'weather', label: 'Weather' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'done', label: 'Ready' },
] as const
const COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a', '#ac8e68']
const DEMO_RINGS: Ring[] = [
  { key: 'study', label: 'Study', value: 64, goal: 90, unit: 'min', pct: .72, colors: ['#ff2d55', '#ff6482'] },
  { key: 'move', label: 'Move', value: 3, goal: 4, unit: 'sets', pct: .78, colors: ['#a4ff00', '#d5ff5c'] },
  { key: 'mind', label: 'Mind', value: 88, goal: 100, unit: '%', pct: .88, colors: ['#00d8ff', '#6ef0ff'] },
]
const daysTo = (d?: string) => d ? Math.max(0, Math.round((+new Date(d + 'T00:00') - +new Date(new Date().toDateString())) / 864e5)) : null

/** First-run setup: a split screen with a live preview of the app on the left and one simple step on the right. */
export default function Welcome() {
  const nav = useNavigate()
  const theme = useTheme()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyState, setKeyState] = useState<'' | 'checking' | 'ok' | 'bad'>('')
  const [city, setCity] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [newSubject, setNewSubject] = useState('')
  const [now, setNow] = useState(new Date())
  const subjects = useLiveQuery(() => db.subjects.toArray()) ?? []

  useEffect(() => {
    getSetting('name').then(setName); getSetting('groqKey').then(k => { setKey(k); if (k) setKeyState('ok') })
    getSetting('weatherPlace').then(v => v && setPlace(JSON.parse(v)))
    const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t)
  }, [])
  useEffect(() => { if (step === STEPS.length - 1) setTimeout(() => celebrate(`Welcome${name ? `, ${name}` : ''}!`), 250) }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (n: number) => setStep(Math.max(0, Math.min(STEPS.length - 1, n)))
  const next = () => go(step + 1)
  const finish = async (to: string) => { await setSetting('onboarded', '1'); nav(to, { replace: true }) }
  const checkKey = async () => {
    setKeyState('checking')
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key.trim()}` } })
      setKeyState(r.ok ? 'ok' : 'bad')
      if (r.ok) await setSetting('groqKey', key.trim())
    } catch { setKeyState('bad') }
  }
  const greet = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const exams = subjects.filter(s => s.examDate).sort((a, b) => a.examDate!.localeCompare(b.examDate!))

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-6">
      <div className="welcome-shell w-full max-w-6xl grid lg:grid-cols-[1.05fr_1fr] overflow-hidden rounded-[32px] shadow-2xl border border-[var(--glass-line)]">

        {/* ---------- Showcase: theme backdrop + a live preview that follows the step ---------- */}
        <aside className={`relative min-h-56 lg:min-h-[640px] overflow-hidden ${theme.wall ? '' : 'welcome-sunset'}`}
          style={theme.wall ? { backgroundImage: `url(${theme.wall})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          <div className={`absolute inset-0 ${theme.wall ? 'bg-gradient-to-t from-black/55 via-black/10 to-black/20' : 'bg-gradient-to-t from-[#5a1e0c]/45 via-transparent to-transparent'}`} />
          {theme.decos.slice(0, 4).map((d, i) => (
            <img key={d.src} src={d.src} alt="" aria-hidden className="decor absolute hidden sm:block"
              style={[{ top: '7%', left: '7%', width: 84, rotate: '-14deg' }, { top: '9%', right: '8%', width: 72, rotate: '12deg' },
                { bottom: '30%', left: '5%', width: 64, rotate: '8deg' }, { bottom: '33%', right: '6%', width: 78, rotate: '-10deg' }][i]} />
          ))}

          <div className="relative h-full flex flex-col justify-end p-6 sm:p-10 gap-6">
            <div key={step} className="step-in glass max-w-sm w-full p-5 self-center lg:self-start">
              {step === 0 && <>
                <div className="eyebrow">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                <div className="text-5xl font-semibold tracking-tight tabular-nums mt-1">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="text-lg font-semibold mt-1">{greet}{name.trim() ? `, ${name.trim()}` : ''} <Art name="wave" size={22} className="align-text-bottom" /></div>
              </>}
              {step === 1 && <>
                <div className="eyebrow">Theme</div>
                <div className="text-2xl font-semibold mt-1">{theme.name}</div>
                <div className="muted text-sm">{theme.tagline}</div>
                <div className="flex gap-2 mt-3">{['Calendar', 'Focus', 'Quiz'].map(t => <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-[var(--accent)] text-white">{t}</span>)}</div>
              </>}
              {step === 2 && <div className="space-y-2.5 text-sm">
                <div className="eyebrow flex items-center gap-1.5"><Art name="chat" size={14} /> Chat with your notes</div>
                <div className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-br-md px-3 py-2 bg-[var(--accent)] text-white">Why do arteries have thick walls?</div>
                <div className="max-w-[90%] rounded-2xl rounded-bl-md px-3 py-2 bg-[var(--line)]">Blood leaves the heart at high pressure, so the walls are thick and muscular to withstand it <span className="text-[var(--accent)] font-semibold">[1]</span></div>
              </div>}
              {step === 3 && <>
                <div className="eyebrow flex items-center gap-1.5"><Art name="partly" size={14} /> Weather</div>
                <div className="flex items-center gap-3 mt-1"><Art name="partly" size={60} />
                  <div><div className="text-4xl font-semibold">24°</div><div className="muted text-sm">{place ? place.name.split(',')[0] : 'Your town'}</div></div></div>
              </>}
              {step === 4 && <>
                <div className="eyebrow">Exam countdown</div>
                <div className="mt-2 space-y-1.5">
                  {(exams.length ? exams : subjects).slice(0, 4).map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-sm"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="tabular-nums font-semibold">{daysTo(s.examDate) != null ? `${daysTo(s.examDate)}d` : '—'}</span></div>
                  ))}
                </div>
              </>}
              {step === 5 && <div className="flex items-center gap-4">
                <ActivityRings rings={DEMO_RINGS} size={110} stroke={13} />
                <div><div className="eyebrow">Close your rings</div><div className="font-semibold mt-1">Study · Move · Mind</div><div className="muted text-xs mt-1">Earn XP, quests & badges every day.</div></div>
              </div>}
            </div>
            <div className="text-white drop-shadow hidden lg:block">
              <div className="text-sm font-semibold tracking-wide uppercase opacity-80">Homebase</div>
              <div className="text-2xl font-semibold leading-snug max-w-md">Your calendar, study notebook, planner and home screen — in one calm place.</div>
            </div>
          </div>
        </aside>

        {/* ---------- Step content ---------- */}
        <section className="welcome-form flex flex-col p-6 sm:p-10 min-h-[560px]">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex gap-1.5 flex-1" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
              {STEPS.map((s, i) => (
                <button key={s.key} onClick={() => i < step && go(i)} aria-label={s.label} disabled={i >= step}
                  className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'flex-[3] bg-[var(--accent)]' : i < step ? 'flex-1 bg-[var(--accent)] opacity-50 cursor-pointer' : 'flex-1 bg-[var(--line)]'}`} />
              ))}
            </div>
            <span className="text-xs muted tabular-nums">{step + 1}/{STEPS.length}</span>
          </div>

          <div key={step} className="step-in flex-1 flex flex-col">
            <div className="eyebrow mb-2">{STEPS[step].label}</div>

            {step === 0 && <>
              <h1 className="welcome-title">Hey there.<br /><span className="text-[var(--accent)]">Let's set up your space.</span></h1>
              <p className="muted text-lg mt-3">Calendar, notes, study AI, planner and a home screen for the fridge, all made for your exams. It takes about a minute, and everything stays on this computer.</p>
              <label className="block mt-8"><span className="text-sm font-medium">What should we call you?</span>
                <input className="input mt-2 !text-xl !py-3" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Your first name"
                  onKeyDown={async e => { if (e.key === 'Enter') { await setSetting('name', name.trim()); next() } }} /></label>
            </>}

            {step === 1 && <>
              <h2 className="welcome-title">Pick your look</h2>
              <p className="muted mt-2 mb-6">Calm for focus, or something more fun. Change it any time in Settings.</p>
              <ThemePicker bare />
            </>}

            {step === 2 && <>
              <h2 className="welcome-title">Turn on your study AI</h2>
              <p className="muted mt-2">Chat with your notes, quizzes, flashcards and past-paper marking all use Groq. It's free.</p>
              <ol className="mt-6 space-y-3">
                {[<>Go to <b>console.groq.com</b> and sign up, free.</>, <>Open <b>API Keys</b> → <b>Create API key</b>.</>, <>Copy it and paste it below.</>].map((t, i) => (
                  <li key={i} className="flex gap-3 items-start text-sm"><span className="w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs font-bold bg-[var(--accent)] text-white">{i + 1}</span><span className="pt-0.5">{t}</span></li>
                ))}
              </ol>
              <div className="flex gap-2 mt-6">
                <input className="input !py-2.5" type="password" value={key} onChange={e => { setKey(e.target.value); setKeyState('') }} placeholder="gsk_…" />
                <button className="btn shrink-0" disabled={!key.trim() || keyState === 'checking'} onClick={checkKey}>{keyState === 'checking' ? 'Checking…' : 'Check'}</button>
              </div>
              {keyState === 'ok' && <p className="mt-3 text-sm text-green-500 flex items-center gap-1.5"><Art name="check" size={18} /> Key works. Saved on this computer.</p>}
              {keyState === 'bad' && <p className="mt-3 text-sm text-red-500 flex items-center gap-1.5"><Art name="close" size={18} /> That key didn't work. Check it was copied fully.</p>}
            </>}

            {step === 3 && <>
              <h2 className="welcome-title">Where's home?</h2>
              <p className="muted mt-2">For the weather on your dashboard. Just your town. Nothing else is shared.</p>
              <form className="flex gap-2 mt-6" onSubmit={async e => { e.preventDefault(); setPlaces(await searchPlaces(city).catch(() => [])) }}>
                <input className="input !py-2.5" value={city} onChange={e => setCity(e.target.value)} placeholder="Town or city" />
                <button className="btn shrink-0" disabled={!city.trim()}>Search</button>
              </form>
              <div className="mt-3 space-y-1">
                {places && (places.length ? places.map(p => {
                  const on = place?.name === p.name
                  return <button key={`${p.lat},${p.lon}`} className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm flex items-center gap-2 transition ${on ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--line)]'}`}
                    onClick={async () => { setPlace(p); await setSetting('weatherPlace', JSON.stringify(p)) }}>{on && <Art name="check" size={16} />}{p.name}</button>
                }) : <p className="muted text-sm">No places found. Try a nearby city.</p>)}
                {place && !places && <p className="text-sm flex items-center gap-1.5"><Art name="check" size={18} /> {place.name}</p>}
              </div>
            </>}

            {step === 4 && <>
              <h2 className="welcome-title">Your subjects</h2>
              <p className="muted mt-2">Remove any you don't take, add the rest, and set exam dates. The planner works backwards from them.</p>
              <div className="mt-5 space-y-2 max-h-64 overflow-auto pr-1 -mr-1">
                {subjects.map(s => (
                  <div key={s.id} className="flex items-center gap-2 p-1.5 pl-2 rounded-2xl bg-[var(--line)]/60">
                    <input type="color" className="w-7 h-7 shrink-0 rounded-full overflow-hidden border-0 p-0 cursor-pointer bg-transparent" value={s.color} onChange={e => db.subjects.update(s.id!, { color: e.target.value })} aria-label={`${s.name} colour`} />
                    <input className="input !bg-transparent !border-transparent focus:!border-[var(--accent)] font-medium min-w-0" value={s.name} onChange={e => db.subjects.update(s.id!, { name: e.target.value })} aria-label="Subject name" />
                    <input type="date" className="input !w-auto text-sm" value={s.examDate ?? ''} onChange={e => db.subjects.update(s.id!, { examDate: e.target.value || undefined })} aria-label={`${s.name} exam date`} />
                    <button className="muted hover:text-red-500 p-1.5 shrink-0" onClick={() => db.subjects.delete(s.id!)} aria-label={`Remove ${s.name}`}><Art name="close" size={18} /></button>
                  </div>
                ))}
              </div>
              <form className="flex gap-2 mt-3" onSubmit={async e => {
                e.preventDefault(); if (!newSubject.trim()) return
                await db.subjects.add({ name: newSubject.trim(), color: COLORS[subjects.length % COLORS.length] }); setNewSubject('')
              }}>
                <input className="input" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Add a subject, e.g. Geography" />
                <button className="btn shrink-0" disabled={!newSubject.trim()}>Add</button>
              </form>
            </>}

            {step === 5 && <div className="flex-1 flex flex-col justify-center">
              <div className="pop"><Art name="party" size={64} /></div>
              <h2 className="welcome-title mt-5">You're all set{name.trim() ? `, ${name.trim()}` : ''}.</h2>
              <p className="muted text-lg mt-2">Drop your notes into a subject, then let the planner fill your week with revision.</p>
              <div className="flex flex-col sm:flex-row gap-2 mt-8">
                <button className="btn !py-3 !px-6 flex items-center justify-center gap-2" onClick={() => finish(exams.length ? '/planner' : '/study')}>
                  {exams.length ? 'Make my study plan' : 'Add my notes'} <Art name="arrow" size={20} /></button>
                <button className="px-6 py-3 rounded-xl hover:bg-[var(--line)] font-medium" onClick={() => finish('/')}>Go to my dashboard</button>
              </div>
              <p className="muted text-sm mt-6">Tip: press <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--line)] text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--line)] text-xs">K</kbd> anywhere to add things by voice.</p>
            </div>}
          </div>

          {step < 5 && (
            <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[var(--line)]">
              {step > 0 && <button className="flex items-center gap-1.5 text-sm muted hover:text-[var(--text)] px-2 py-2" onClick={() => go(step - 1)}><Art name="arrow" size={16} className="rotate-180" /> Back</button>}
              <div className="ml-auto flex items-center gap-3">
                {(step === 2 || step === 3) && <button className="text-sm muted hover:text-[var(--text)] px-2 py-2" onClick={next}>Skip for now</button>}
                <button className="btn !py-2.5 !px-6 flex items-center gap-2"
                  disabled={step === 2 && keyState !== 'ok'}
                  onClick={async () => { if (step === 0) await setSetting('name', name.trim()); next() }}>
                  {step === 0 ? "Let's go" : 'Continue'} <Art name="arrow" size={20} />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
