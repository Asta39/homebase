import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowRight, Check, KeyRound, MapPin, BookOpen, Sparkles, X, Palette } from 'lucide-react'
import ThemePicker from '../components/ThemePicker'
import { db, getSetting, setSetting } from '../lib/db'
import { searchPlaces, type Place } from '../lib/weather'

const STEPS = ['Hello', 'Look', 'AI key', 'Weather', 'Subjects', 'Done'] as const
const COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a', '#ac8e68']

/** First-run setup. Every step can be skipped and changed later in Settings / Study. */
export default function Welcome() {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [keyState, setKeyState] = useState<'' | 'checking' | 'ok' | 'bad'>('')
  const [city, setCity] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [place, setPlace] = useState<Place | null>(null)
  const [newSubject, setNewSubject] = useState('')
  const subjects = useLiveQuery(() => db.subjects.toArray()) ?? []

  useEffect(() => {
    getSetting('name').then(setName); getSetting('groqKey').then(setKey)
    getSetting('weatherPlace').then(v => v && setPlace(JSON.parse(v)))
  }, [])

  const next = () => setStep(s => Math.min(STEPS.length - 1, s + 1))
  const finish = async (to: string) => { await setSetting('onboarded', '1'); nav(to, { replace: true }) }

  const checkKey = async () => {
    setKeyState('checking')
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key.trim()}` } })
      setKeyState(r.ok ? 'ok' : 'bad')
      if (r.ok) await setSetting('groqKey', key.trim())
    } catch { setKeyState('bad') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className={`panel w-full ${step === 1 ? "max-w-3xl" : "max-w-xl"} p-8 space-y-6 shadow-2xl transition-all`}>
        <div className="flex gap-1.5">{STEPS.map((s, i) => <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[var(--accent)]' : 'bg-[var(--line)]'}`} />)}</div>

        {step === 0 && <div className="space-y-4">
          <div className="text-4xl">👋</div>
          <h1 className="text-3xl font-bold">Welcome to Homebase</h1>
          <p className="muted">Your calendar, study notebook, planner and home dashboard in one place. A minute of setup and you're ready. Everything stays on this computer.</p>
          <label className="block"><span className="muted text-sm">What should we call you?</span>
            <input className="input mt-1 !text-lg" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Your first name" /></label>
          <button className="btn !py-2.5 w-full flex items-center justify-center gap-2" onClick={async () => { await setSetting('name', name.trim()); next() }}>Let's go <ArrowRight size={18} /></button>
        </div>}

        {step === 1 && <div className="space-y-4">
          <Palette className="text-[var(--accent)]" size={32} />
          <h2 className="text-2xl font-bold">Pick your look</h2>
          <p className="muted">Classic for focus, or something more fun. You can change it any time in Settings.</p>
          <ThemePicker bare />
          <div className="flex justify-end"><button className="btn flex items-center gap-2" onClick={next}>Next <ArrowRight size={16} /></button></div>
        </div>}

        {step === 2 && <div className="space-y-4">
          <KeyRound className="text-[var(--accent)]" size={32} />
          <h2 className="text-2xl font-bold">Turn on the study AI</h2>
          <p className="muted">Chat with your notes, quizzes, flashcards, past-paper marking and more use Groq — it's free.</p>
          <ol className="text-sm space-y-1 list-decimal pl-5">
            <li>Go to <b>console.groq.com</b> and sign up (free).</li>
            <li>Open <b>API Keys</b> → <b>Create API key</b>.</li>
            <li>Copy it and paste it below.</li>
          </ol>
          <div className="flex gap-2">
            <input className="input" type="password" value={key} onChange={e => { setKey(e.target.value); setKeyState('') }} placeholder="gsk_…" />
            <button className="btn shrink-0" disabled={!key.trim() || keyState === 'checking'} onClick={checkKey}>{keyState === 'checking' ? 'Checking…' : 'Check'}</button>
          </div>
          {keyState === 'ok' && <p className="text-sm text-green-500 flex items-center gap-1"><Check size={16} /> Key works — saved on this computer.</p>}
          {keyState === 'bad' && <p className="text-sm text-red-500 flex items-center gap-1"><X size={16} /> That key didn't work. Check it was copied fully.</p>}
          <div className="flex justify-between">
            <button className="muted text-sm" onClick={next}>Skip for now</button>
            <button className="btn flex items-center gap-2" disabled={keyState !== 'ok'} onClick={next}>Next <ArrowRight size={16} /></button>
          </div>
        </div>}

        {step === 3 && <div className="space-y-4">
          <MapPin className="text-[var(--accent)]" size={32} />
          <h2 className="text-2xl font-bold">Where are you?</h2>
          <p className="muted">For the weather on your dashboard. Just your town — nothing else is shared.</p>
          <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); setPlaces(await searchPlaces(city).catch(() => [])) }}>
            <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Town or city" />
            <button className="btn shrink-0" disabled={!city.trim()}>Search</button>
          </form>
          {places && (places.length ? places.map(p => (
            <button key={`${p.lat},${p.lon}`} className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${place?.name === p.name ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--line)]'}`}
              onClick={async () => { setPlace(p); await setSetting('weatherPlace', JSON.stringify(p)) }}>{p.name}</button>
          )) : <p className="muted text-sm">No places found.</p>)}
          {place && !places && <p className="text-sm flex items-center gap-1"><Check size={16} className="text-green-500" /> {place.name}</p>}
          <div className="flex justify-between">
            <button className="muted text-sm" onClick={next}>Skip</button>
            <button className="btn flex items-center gap-2" onClick={next}>Next <ArrowRight size={16} /></button>
          </div>
        </div>}

        {step === 4 && <div className="space-y-4">
          <BookOpen className="text-[var(--accent)]" size={32} />
          <h2 className="text-2xl font-bold">Your subjects & exams</h2>
          <p className="muted">Remove any you don't take, add the rest, and set exam dates if you know them — the planner uses them.</p>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {subjects.map(s => (
              <div key={s.id} className="flex items-center gap-2">
                <input type="color" className="w-8 h-8 rounded-full overflow-hidden border-0 p-0 cursor-pointer bg-transparent" value={s.color} onChange={e => db.subjects.update(s.id!, { color: e.target.value })} aria-label={`${s.name} colour`} />
                <input className="input" value={s.name} onChange={e => db.subjects.update(s.id!, { name: e.target.value })} aria-label="Subject name" />
                <input type="date" className="input !w-auto" value={s.examDate ?? ''} onChange={e => db.subjects.update(s.id!, { examDate: e.target.value || undefined })} aria-label={`${s.name} exam date`} />
                <button className="muted hover:text-red-500 p-1" onClick={() => db.subjects.delete(s.id!)} aria-label={`Remove ${s.name}`}><X size={18} /></button>
              </div>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={async e => {
            e.preventDefault(); if (!newSubject.trim()) return
            await db.subjects.add({ name: newSubject.trim(), color: COLORS[subjects.length % COLORS.length] }); setNewSubject('')
          }}>
            <input className="input" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="Add a subject, e.g. Geography" />
            <button className="btn shrink-0" disabled={!newSubject.trim()}>Add</button>
          </form>
          <div className="flex justify-end"><button className="btn flex items-center gap-2" onClick={next}>Next <ArrowRight size={16} /></button></div>
        </div>}

        {step === 5 && <div className="space-y-4 text-center">
          <Sparkles className="text-[var(--accent)] mx-auto" size={40} />
          <h2 className="text-2xl font-bold">You're all set{name ? `, ${name}` : ''}!</h2>
          <p className="muted">Next: drop your notes into a subject, then let the planner fill your week with revision.</p>
          <div className="flex flex-col gap-2">
            <button className="btn !py-2.5" onClick={() => finish(subjects.some(s => s.examDate) ? '/planner' : '/study')}>
              {subjects.some(s => s.examDate) ? 'Make my study plan' : 'Add my notes'}</button>
            <button className="px-3 py-2 rounded-lg hover:bg-[var(--line)]" onClick={() => finish('/')}>Go to my dashboard</button>
          </div>
          <p className="muted text-xs">Tip: press <kbd className="px-1.5 py-0.5 rounded bg-[var(--line)]">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-[var(--line)]">K</kbd> anywhere to add things by voice.</p>
        </div>}

        {step > 0 && step < 5 && <button className="muted text-xs" onClick={() => setStep(step - 1)}>← Back</button>}
      </div>
    </div>
  )
}
