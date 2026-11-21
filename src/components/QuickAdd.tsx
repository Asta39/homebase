import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MetalFx } from 'metal-fx'
import { BorderBeam } from 'border-beam'
import { Mic } from 'lucide-react'
import { useMode } from "../lib/theme"
import { apply, describe, parseCommand, transcribe, valid, type Action } from '../lib/quickadd'
import Thinking from './Thinking'

/**
 * Floating 🎙️ button + Ctrl/Cmd+K. Speak or type ("Chem homework Thursday 4pm", "add milk and eggs"),
 * check what it understood, untick anything wrong, save.
 */
export default function QuickAdd() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [rec, setRec] = useState<MediaRecorder | null>(null)
  const [status, setStatus] = useState('')
  const [actions, setActions] = useState<{ a: Action; on: boolean }[] | null>(null)
  const [saved, setSaved] = useState('')
  const [hover, setHover] = useState(false)
  const { pathname } = useLocation()
  const { resolved } = useMode() // follow the app's Light/Dark choice, not just Windows
  const input = useRef<HTMLInputElement>(null)

  const reset = () => { setText(''); setActions(null); setStatus(''); setSaved('') }
  const show = () => { reset(); setOpen(true); setTimeout(() => input.current?.focus(), 0) }
  const close = () => { rec?.stop(); setOpen(false) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? close() : show() }
      if (e.key === 'Escape' && open) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const understand = async (t: string) => {
    if (!t.trim()) return
    setStatus('Understanding…'); setActions(null)
    try {
      const list = (await parseCommand(t)).filter(valid)
      if (!list.length) setStatus("Didn't catch anything to add — try e.g. “Biology test Friday 9am”.")
      else { setActions(list.map(a => ({ a, on: true }))); setStatus('') }
    } catch (e) { setStatus((e as Error).message) }
  }

  const toggleMic = async () => {
    if (rec) { rec.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      const parts: Blob[] = []
      r.ondataavailable = e => parts.push(e.data)
      r.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); setRec(null)
        setStatus('Listening back…')
        try { const t = await transcribe(new Blob(parts, { type: r.mimeType })); setText(t); await understand(t) }
        catch (e) { setStatus((e as Error).message) }
      }
      r.start(); setRec(r); setStatus('Listening… tap ■ to stop'); setActions(null)
      setTimeout(() => r.state === 'recording' && r.stop(), 30_000) // safety cap
    } catch { setStatus('Microphone blocked — allow it, or just type instead.') }
  }

  const save = async () => {
    const chosen = actions!.filter(x => x.on)
    for (const x of chosen) await apply(x.a)
    setSaved(`Added ${chosen.length} item${chosen.length === 1 ? '' : 's'} ✓`); setActions(null); setText('')
    setTimeout(() => setOpen(false), 900)
  }

  if (pathname === '/welcome') return null
  return <>
    {/* Liquid-metal ring (libraries.dev metal-fx). Frozen at rest so the always-on kiosk costs nothing; flows on hover. */}
    <div className="fixed bottom-5 right-5 z-40" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <MetalFx variant="circle" preset="silver" theme={resolved} paused={!hover}>
        <button onClick={show} title="Quick add (Ctrl+K)" aria-label="Quick add"
          className="w-14 h-14 rounded-full bg-[var(--panel)] text-[var(--text)] shadow-xl flex items-center justify-center transition hover:scale-105">
          <Mic size={24} strokeWidth={2} />
        </button>
      </MetalFx>
    </div>

    {open && <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-4" onMouseDown={e => e.target === e.currentTarget && close()}>
      <BorderBeam theme={resolved} size="md" colorVariant="colorful" active={!!rec || status === 'Understanding…'} className="w-full max-w-lg">
      <div className="panel w-full p-5 space-y-3 shadow-2xl">
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); understand(text) }}>
          <button type="button" onClick={toggleMic} aria-label={rec ? 'Stop recording' : 'Speak'}
            className={`w-11 h-11 shrink-0 rounded-full text-xl transition ${rec ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--line)] hover:bg-[var(--accent)] hover:text-white'}`}>{rec ? '■' : <Mic size={20} />}</button>
          <input ref={input} className="input !text-base" value={text} onChange={e => setText(e.target.value)}
            placeholder="“Chemistry homework Thursday 4pm” · “add milk and eggs”" />
          <button className="btn" disabled={!text.trim() || !!rec}>Go</button>
        </form>

        {status && <p className="text-sm muted">{status.endsWith('…') || status.includes('Listening') ? <Thinking state={rec ? 'listening' : 'working'} label={status} /> : status}</p>}
        {saved && <p className="text-sm text-green-500 font-medium">{saved}</p>}

        {actions && <>
          <div className="text-sm muted">I’ll add:</div>
          <div className="space-y-1.5">
            {actions.map((x, i) => (
              <label key={i} className={`flex items-center gap-3 p-2.5 rounded-xl border border-[var(--line)] cursor-pointer ${x.on ? '' : 'opacity-50'}`}>
                <input type="checkbox" className="w-4 h-4 accent-[var(--accent)]" checked={x.on}
                  onChange={() => setActions(actions.map((y, j) => (j === i ? { ...y, on: !y.on } : y)))} />
                <span className="text-sm">{describe(x.a)}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)]" onClick={reset}>Start over</button>
            <button className="btn" onClick={save} disabled={!actions.some(x => x.on)}>Add</button>
          </div>
        </>}
        {!actions && !status && !saved && <p className="text-xs muted">Events, shopping, meals, or “I don’t get … in Physics” for the weekend recap. Ctrl+K anywhere.</p>}
      </div>
      </BorderBeam>
    </div>}
  </>
}
