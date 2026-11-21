import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSetting } from '../lib/db'
import { describe, getWeather, type Place, type Weather } from '../lib/weather'
import Art from './Art'

const CACHE = 'homebase.weather'
const REFRESH = 30 * 60 * 1000

/** Dashboard weather. Caches the last result so it still shows when offline. */
export default function WeatherCard({ className = "panel p-6" }: { className?: string }) {
  const [place, setPlace] = useState<Place | null | undefined>(undefined)
  const [w, setW] = useState<Weather | null>(() => {
    try { return JSON.parse(localStorage.getItem(CACHE) ?? 'null')?.w ?? null } catch { return null }
  })
  const [error, setError] = useState('')

  useEffect(() => { getSetting('weatherPlace').then(v => setPlace(v ? JSON.parse(v) : null)) }, [])
  useEffect(() => {
    if (!place) return
    const load = () => getWeather(place)
      .then(x => { setW(x); setError(''); try { localStorage.setItem(CACHE, JSON.stringify({ w: x })) } catch { /* ignore */ } })
      .catch(e => setError((e as Error).message))
    load()
    const t = setInterval(load, REFRESH)
    return () => clearInterval(t)
  }, [place])

  if (place === null) return (
    <section className={className}>
      <h2 className="font-semibold mb-3">Weather</h2>
      <Link to="/settings" className="text-[var(--accent)] text-sm inline-flex items-center gap-1">Set your town in Settings <Art name="arrow" size={14} /></Link>
    </section>
  )
  const [icon, label] = w ? describe(w.code, w.isDay) : ['', '']
  return (
    <section className={className}>
      <h2 className="font-semibold mb-1">Weather</h2>
      <div className="muted text-sm truncate">{place?.name.split(',')[0]}</div>
      {w ? <>
        <div className="flex items-center gap-3 mt-2">
          {icon && <Art name={icon} size={64} />}
          <div>
            <div className="text-4xl font-semibold tabular-nums">{w.temp}°</div>
            <div className="muted text-sm">{label} · H {w.high}° L {w.low}°</div>
          </div>
        </div>
        {w.rain >= 40 && <div className="text-sm mt-2 flex items-center gap-1.5"><Art name="umbrella" size={20} /> {w.rain}% chance of rain — take an umbrella</div>}
        <div className="flex justify-between mt-3 text-xs muted">
          {w.hourly.map(h => (
            <div key={h.time} className="text-center"><div>{h.time.slice(0, 2)}</div><Art name={describe(h.code)[0]} size={24} className="mx-auto" /><div>{h.temp}°</div></div>
          ))}
        </div>
      </> : <p className="muted mt-2">{error || 'Loading…'}</p>}
      {w && error && <p className="muted text-xs mt-2">Offline — showing last update</p>}
    </section>
  )
}
