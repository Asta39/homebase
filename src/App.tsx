import { lazy, Suspense, useEffect, useState } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  House, CalendarDays, Trophy, BookOpen, CalendarRange, Timer, ChartColumn, Dumbbell, HeartPulse, UtensilsCrossed, Settings as SettingsIcon, Tv,
  type LucideIcon,
} from 'lucide-react'
import { getSetting, seedIfEmpty } from './lib/db'
import { loadKiosk } from './lib/kiosk'
import { startTicker } from './lib/focus'
import { DialogHost } from './components/Dialog'
import MiniTimer from './components/MiniTimer'
import QuickAdd from './components/QuickAdd'
import GameEngine from "./components/GameEngine"
import Thinking from './components/Thinking'
import Wallpaper from './components/Wallpaper'
import PageScatter from "./components/PageScatter"
import Dashboard from './pages/Dashboard' // home loads instantly; everything else on demand

// Code-split: heavy pages (PDF/OCR, search model, calendar, charts) only load when opened
const Calendar = lazy(() => import('./pages/Calendar'))
const Study = lazy(() => import('./pages/Study'))
const Subject = lazy(() => import('./pages/Subject'))
const Planner = lazy(() => import('./pages/Planner'))
const Focus = lazy(() => import('./pages/Focus'))
const Report = lazy(() => import('./pages/Report'))
const Workout = lazy(() => import('./pages/Workout'))
const Wellbeing = lazy(() => import('./pages/Wellbeing'))
const Meals = lazy(() => import('./pages/Meals'))
const Settings = lazy(() => import('./pages/Settings'))
const Kiosk = lazy(() => import('./pages/Kiosk'))
const Welcome = lazy(() => import('./pages/Welcome'))
const Trophies = lazy(() => import('./pages/Trophies'))

type Item = { to: string; label: string; icon: LucideIcon }
const NAV: { heading?: string; items: Item[] }[] = [
  { items: [{ to: '/', label: 'Home', icon: House }, { to: '/calendar', label: 'Calendar', icon: CalendarDays }, { to: '/trophies', label: 'Trophies', icon: Trophy }] },
  { heading: 'Study', items: [
    { to: '/study', label: 'Subjects', icon: BookOpen }, { to: '/planner', label: 'Planner', icon: CalendarRange },
    { to: '/focus', label: 'Focus', icon: Timer }, { to: '/report', label: 'Report', icon: ChartColumn },
  ] },
  { heading: 'Life', items: [
    { to: '/workout', label: 'Workout', icon: Dumbbell }, { to: '/wellbeing', label: 'Wellbeing', icon: HeartPulse },
    { to: '/meals', label: 'Meals', icon: UtensilsCrossed },
  ] },
]

/** Opens kiosk on launch if enabled, and drifts back to it after a period of no use. */
function KioskController() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    loadKiosk().then(k => { if (k.startInKiosk && !sessionStorage.getItem('homebase.launched')) navigate('/kiosk') })
    try { sessionStorage.setItem('homebase.launched', '1') } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pathname === '/kiosk' || pathname === '/welcome') return
    let timer: number | undefined
    let minutes = 0
    const reset = () => { window.clearTimeout(timer); if (minutes > 0) timer = window.setTimeout(() => navigate('/kiosk'), minutes * 60_000) }
    const events = ['mousemove', 'keydown', 'touchstart', 'wheel'] as const
    loadKiosk().then(k => { minutes = k.idleMinutes; reset() })
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => { window.clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [pathname, navigate])

  return null
}

function Link({ to, label, icon: Icon, muted = false }: Item & { muted?: boolean }) {
  return (
    <NavLink to={to} end={to === '/'} title={label}
      className={({ isActive }) => `px-3 py-2 rounded-lg flex items-center gap-2.5 justify-center lg:justify-start text-[15px] transition-colors ${
        isActive ? 'bg-[var(--accent)] text-white' : `hover:bg-[var(--line)] ${muted ? 'muted' : ''}`}`}>
      <Icon size={18} strokeWidth={2} className="shrink-0" />
      <span className="hidden lg:inline truncate">{label}</span>
    </NavLink>
  )
}

const Loading = () => <div className="p-10 flex justify-center"><Thinking state="breathing" size={64} /></div>

function Shell() {
  const { pathname } = useLocation()
  if (pathname === '/kiosk') return <><Wallpaper /><Suspense fallback={<Loading />}><Kiosk /></Suspense></>
  if (pathname === '/welcome') return <><Wallpaper /><Suspense fallback={<Loading />}><Welcome /></Suspense></>
  return (
    <div className="flex h-screen">
      <Wallpaper />
      {/* Full labels on laptops ≥1024px; icon rail below that */}
      <aside className="w-16 lg:w-52 shrink-0 p-2 lg:p-4 flex flex-col gap-0.5 border-r overflow-y-auto" style={{ borderColor: 'var(--line)' }}>
        <h1 className="text-xl font-bold px-2 mb-3 hidden lg:block">Homebase</h1>
        <div className="lg:hidden text-center text-xl font-black mb-3">H</div>
        {NAV.map((g, i) => (
          <div key={i} className={i ? 'mt-3' : ''}>
            {g.heading && <div className="hidden lg:block px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider muted">{g.heading}</div>}
            {g.heading && <div className="lg:hidden mx-3 mb-1 border-t" style={{ borderColor: 'var(--line)' }} />}
            {g.items.map(it => <Link key={it.to} {...it} />)}
          </div>
        ))}
        <div className="mt-auto" />
        <MiniTimer />
        <Link to="/settings" label="Settings" icon={SettingsIcon} muted />
        <Link to="/kiosk" label="Home mode" icon={Tv} muted />
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6 pb-24 lg:pb-24 relative">
        <PageScatter />
        <div className="relative z-10">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/trophies" element={<Trophies />} />
            <Route path="/study" element={<Study />} />
            <Route path="/study/:id" element={<Subject />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/focus" element={<Focus />} />
            <Route path="/workout" element={<Workout />} />
            <Route path="/wellbeing" element={<Wellbeing />} />
            <Route path="/report" element={<Report />} />
            <Route path="/meals" element={<Meals />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </div>
      </main>
    </div>
  )
}

/** First launch → welcome setup. */
function FirstRun() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    if (checked) return
    getSetting('onboarded').then(v => { setChecked(true); if (!v && pathname !== '/welcome') navigate('/welcome', { replace: true }) })
  }, [checked, pathname, navigate])
  return null
}

export default function App() {
  useEffect(() => { seedIfEmpty(); startTicker() }, [])
  return (
    <HashRouter>
      <FirstRun />
      <KioskController />
      <GameEngine />
      <Shell />
      <QuickAdd />
      <DialogHost />
    </HashRouter>
  )
}
