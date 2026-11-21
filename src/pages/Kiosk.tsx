import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Dashboard from './Dashboard'
import { isDimTime, keepAwake, loadKiosk, setFullscreen, KIOSK_DEFAULTS, type KioskSettings } from '../lib/kiosk'

/** Fridge-screen mode: full screen dashboard, no sidebar, screen kept awake, dims at night. */
export default function Kiosk() {
  const nav = useNavigate()
  const [k, setK] = useState<KioskSettings>(KIOSK_DEFAULTS)
  const [active, setActive] = useState(true) // mouse/touch recently → show controls + cursor
  const [dim, setDim] = useState(false)
  const timer = useRef<number>(undefined)

  const exit = () => { setFullscreen(false); nav('/') }

  useEffect(() => {
    loadKiosk().then(setK)
    setFullscreen(true)
    const release = keepAwake()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') exit() }
    window.addEventListener('keydown', onKey)
    return () => { release(); window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const check = () => setDim(isDimTime(k))
    check(); const t = setInterval(check, 60_000)
    return () => clearInterval(t)
  }, [k])

  const wake = () => {
    setActive(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setActive(false), 4000)
  }
  useEffect(() => { wake(); return () => window.clearTimeout(timer.current) }, [])

  return (
    <div className={`h-screen overflow-auto p-6 text-[1.08rem] ${active ? '' : 'cursor-none'}`}
      onMouseMove={wake} onTouchStart={wake} onClick={wake}>
      <Dashboard />

      <button onClick={exit}
        className={`fixed top-4 right-4 z-40 panel px-4 py-2 text-sm shadow-lg transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        Exit Home mode <span className="muted">(Esc)</span>
      </button>

      {/* Night dimming: a dark veil, so it still shows the time but doesn't light up the kitchen. Tap to peek. */}
      <div className={`fixed inset-0 z-30 bg-black pointer-events-none transition-opacity duration-1000 ${dim && !active ? 'opacity-75' : 'opacity-0'}`} />
    </div>
  )
}
