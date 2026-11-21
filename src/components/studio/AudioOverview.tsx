import { useEffect, useRef, useState } from 'react'
import { makeAudioScript, type Line } from '../../lib/studio'
import { notify } from '../Dialog'
import Thinking from '../Thinking'
import Art from '../Art'

/** Two-voice revision "podcast" read aloud with the device's built-in voices (free, works offline once written). */
export default function AudioOverview({ subjectName, source }: { subjectName: string; source: string }) {
  const [lines, setLines] = useState<Line[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [at, setAt] = useState(-1)          // line being spoken
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [minutes, setMinutes] = useState(4)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const stopRef = useRef(false)

  useEffect(() => {
    const load = () => setVoices(speechSynthesis.getVoices().filter(v => v.lang.startsWith('en')))
    load(); speechSynthesis.addEventListener('voiceschanged', load)
    return () => { speechSynthesis.removeEventListener('voiceschanged', load); speechSynthesis.cancel() }
  }, [])

  // Two distinct voices: prefer natural/online ones, then any two different English voices
  const pick = () => {
    const ranked = [...voices].sort((a, b) => Number(/natural|neural|online/i.test(b.name)) - Number(/natural|neural|online/i.test(a.name)))
    const a = ranked[0], b = ranked.find(v => v !== a && v.name.split(' ')[1] !== a?.name.split(' ')[1]) ?? ranked[1] ?? a
    return { A: a, B: b }
  }

  const speakFrom = (start: number) => {
    if (!lines) return
    speechSynthesis.cancel(); stopRef.current = false
    const { A, B } = pick()
    setPlaying(true)
    const say = (k: number) => {
      if (stopRef.current || k >= lines.length) { setPlaying(false); if (k >= lines.length) setAt(-1); return }
      setAt(k)
      const u = new SpeechSynthesisUtterance(lines[k].text)
      u.voice = (lines[k].speaker === 'A' ? A : B) ?? null
      u.rate = rate; u.pitch = lines[k].speaker === 'A' ? 1 : 1.15 // still sounds different if only one voice exists
      u.onend = () => say(k + 1)
      u.onerror = () => setPlaying(false)
      speechSynthesis.speak(u)
    }
    say(start)
  }
  const stop = () => { stopRef.current = true; speechSynthesis.cancel(); setPlaying(false) }

  const go = async () => {
    stop(); setBusy(true)
    try { setLines(await makeAudioScript(subjectName, source, minutes)); setAt(-1) } catch (e) { await notify("Couldn't write the audio overview", (e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <p className="muted text-sm flex-1 min-w-48">Two hosts talk through your notes — listen while you walk, cook or rest your eyes.</p>
        <select className="input !w-auto text-sm" value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
          {[2, 4, 6, 8].map(m => <option key={m} value={m}>~{m} min</option>)}
        </select>
        <button className="btn" onClick={go} disabled={busy || !source}>{busy ? <Thinking onAccent state="weaving" label="Writing script…" /> : lines ? 'New episode' : 'Make audio overview'}</button>
      </div>
      {!voices.length && <p className="text-sm text-amber-500">No English voices found on this device. On Windows: Settings → Time & language → Speech → add a voice.</p>}
      {lines && <>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg)]">
          {playing
            ? <button className="btn w-24" onClick={stop}><span className="inline-flex items-center gap-1.5"><Art name="pause" size={18} />Pause</span></button>
            : <button className="btn w-24" onClick={() => speakFrom(at >= 0 ? at : 0)} disabled={!voices.length}>▶ {at > 0 ? 'Resume' : 'Play'}</button>}
          <div className="flex-1 h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
            <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${((at + 1) / lines.length) * 100}%` }} />
          </div>
          <select className="input !w-auto text-sm" value={rate} onChange={e => setRate(Number(e.target.value))} aria-label="Speed">
            {[0.8, 1, 1.2, 1.5].map(r => <option key={r} value={r}>{r}×</option>)}
          </select>
        </div>
        <div className="space-y-2 max-h-80 overflow-auto text-sm">
          {lines.map((l, k) => (
            <p key={k} onClick={() => speakFrom(k)} title="Play from here"
              className={`cursor-pointer rounded-lg px-3 py-1.5 ${k === at ? 'bg-[var(--accent)]/15' : 'hover:bg-[var(--line)]'}`}>
              <b className={l.speaker === 'A' ? 'text-[var(--accent)]' : 'text-orange-500'}>{l.speaker === 'A' ? 'Alex' : 'Sam'}:</b> {l.text}
            </p>
          ))}
        </div>
      </>}
    </div>
  )
}
