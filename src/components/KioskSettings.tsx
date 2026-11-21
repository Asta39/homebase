import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAutostart, loadKiosk, saveKiosk, setAutostart, KIOSK_DEFAULTS, type KioskSettings as K } from '../lib/kiosk'
import { notify } from './Dialog'

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer py-1">
      <span className="flex-1"><span>{label}</span>{hint && <span className="block muted text-xs">{hint}</span>}</span>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={`w-11 h-6 rounded-full relative transition-colors ${on ? 'bg-green-500' : 'bg-[var(--line)]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

export default function KioskSettings() {
  const [k, setK] = useState<K>(KIOSK_DEFAULTS)
  const [auto, setAuto] = useState<boolean | null>(null)
  useEffect(() => { loadKiosk().then(setK); getAutostart().then(setAuto).catch(() => setAuto(null)) }, [])
  const update = (patch: Partial<K>) => { const next = { ...k, ...patch }; setK(next); saveKiosk(next) }

  return (
    <section className="panel p-5 space-y-2">
      <div className="flex items-center">
        <h2 className="font-semibold">Home mode</h2>
        <Link to="/kiosk" className="btn ml-auto text-sm">Start Home mode</Link>
      </div>
      <p className="muted text-sm">Full-screen dashboard for a screen by the fridge. Keeps the screen awake. Press Esc or tap “Exit Home mode” to leave.</p>

      <Toggle label="Open in Home mode on launch" on={k.startInKiosk} onChange={v => update({ startInKiosk: v })} />
      {auto !== null && <Toggle label="Launch when Windows starts" hint="Combine with the above for a true always-on dashboard"
        on={auto} onChange={async v => {
          try { await setAutostart(v); setAuto(v) } catch (e) { notify("Couldn't change startup setting", (e as Error).message) }
        }} />}

      <label className="flex items-center gap-3 py-1">
        <span className="flex-1">Return to Home mode when idle</span>
        <select className="input !w-auto" value={k.idleMinutes} onChange={e => update({ idleMinutes: Number(e.target.value) })}>
          {[0, 2, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m ? `after ${m} min` : 'Never'}</option>)}
        </select>
      </label>

      <Toggle label="Dim at night" hint="Darkens the screen; tap to peek" on={!!k.dimFrom}
        onChange={v => update(v ? { dimFrom: '22:00', dimTo: '06:30' } : { dimFrom: '', dimTo: '' })} />
      {k.dimFrom && <div className="flex items-center gap-2 text-sm pl-1">
        <span className="muted">From</span><input type="time" className="input !w-auto" value={k.dimFrom} onChange={e => update({ dimFrom: e.target.value })} />
        <span className="muted">to</span><input type="time" className="input !w-auto" value={k.dimTo} onChange={e => update({ dimTo: e.target.value })} />
      </div>}
    </section>
  )
}
