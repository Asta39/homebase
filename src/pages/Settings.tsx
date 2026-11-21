import { useEffect, useState } from 'react'
import { confirmBox, notify } from '../components/Dialog'
import { searchPlaces, type Place } from '../lib/weather'
import KioskSettings from '../components/KioskSettings'
import ThemePicker from "../components/ThemePicker"
import { exportAll, getSetting, importAll, setSetting } from '../lib/db'
import Art from '../components/Art'

export default function Settings() {
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [place, setPlace] = useState<Place | null>(null)
  const [city, setCity] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  useEffect(() => {
    getSetting('groqKey').then(setKey)
    getSetting('weatherPlace').then(v => v && setPlace(JSON.parse(v)))
  }, [])

  const download = async () => {
    const blob = new Blob([await exportAll()], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `homebase-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
  }
  const upload = async (f?: File) => {
    if (!f || !(await confirmBox('Restore this backup?', 'This replaces ALL current data on this device.', 'Replace'))) return
    try { await importAll(await f.text()); await notify('Backup restored') }
    catch (e) { await notify("Couldn't restore backup", (e as Error).message) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <ThemePicker />
      <section className="panel p-5 space-y-2">
        <h2 className="font-semibold">Groq API key</h2>
        <p className="muted text-sm">Free at console.groq.com. Stored only on this computer.</p>
        <input className="input" type="password" value={key} onChange={e => { setKey(e.target.value); setSaved(false) }} placeholder="gsk_…" />
        <button className="btn" onClick={async () => { await setSetting('groqKey', key.trim()); setSaved(true) }}>{saved ? <span className="inline-flex items-center gap-1"><Art name="check" size={16} />Saved</span> : 'Save'}</button>
      </section>
      <KioskSettings />
      <section className="panel p-5 space-y-2">
        <h2 className="font-semibold">Weather location</h2>
        <p className="muted text-sm">{place ? `Showing weather for ${place.name}` : 'Not set — the dashboard weather card stays empty.'}</p>
        <form className="flex gap-2" onSubmit={async e => {
          e.preventDefault()
          try { setResults(await searchPlaces(city)) } catch (err) { notify('Search failed', (err as Error).message) }
        }}>
          <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="Town or city" />
          <button className="btn" disabled={!city.trim()}>Search</button>
        </form>
        {results && (results.length ? results.map(p => (
          <button key={`${p.lat},${p.lon}`} className="block w-full text-left px-3 py-1.5 rounded-lg hover:bg-[var(--line)] text-sm"
            onClick={async () => { await setSetting('weatherPlace', JSON.stringify(p)); setPlace(p); setResults(null); setCity('') }}>{p.name}</button>
        )) : <p className="muted text-sm">No places found.</p>)}
      </section>
      <section className="panel p-5 space-y-2">
        <h2 className="font-semibold">Backup</h2>
        <p className="muted text-sm">All data lives on this device. Export regularly (e.g. into a OneDrive folder).</p>
        <div className="flex gap-2 items-center">
          <button className="btn" onClick={download}>Export JSON</button>
          <input type="file" accept="application/json" onChange={e => upload(e.target.files?.[0])} />
        </div>
      </section>
    </div>
  )
}
