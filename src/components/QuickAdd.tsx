import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MetalFx } from 'metal-fx'
import { useMode } from "../lib/theme"
import { apply, describe, parseCommand, transcribe, valid, type Action } from '../lib/quickadd'
import Thinking from './Thinking'
import Art from './Art'

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
    setSaved(`Added ${chosen.length} item${chosen.length === 1 ? '' : 's'}`); setActions(null); setText('')
    setTimeout(() => setOpen(false), 900)
  }

  if (pathname === '/welcome') return null
  return <>
    {/* Liquid-metal ring (libraries.dev metal-fx). Frozen at rest so the always-on kiosk costs nothing; flows on hover. */}
    <div className="fixed bottom-5 right-5 z-40" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <MetalFx variant="circle" preset="silver" theme={resolved} paused={!hover}>
        <button onClick={show} title="Quick add (Ctrl+K)" aria-label="Quick add"
          className="w-14 h-14 rounded-full bg-[var(--panel)] text-[var(--text)] shadow-xl flex items-center justify-center transition hover:scale-105">
          <Art name="mic" size={32} />
        </button>
      </MetalFx>
    </div>

    {open && <div className="fixed inset-0 z-[1000] bg-black/35 backdrop-blur-[3px] flex items-start justify-center pt-[14vh] p-4" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="w-full max-w-xl rounded-[20px] overflow-hidden border border-[var(--line)] shadow-[0_30px_80px_-20px_rgba(0,0,0,.55)]"
        style={{ background: 'var(--panel)', backdropFilter: 'blur(30px) saturate(1.4)' }}>
        <form className="flex items-center gap-3 px-5 h-16" onSubmit={e => { e.preventDefault(); understand(text) }}>
          <Art name="plus" size={26} />
          <input ref={input} className="flex-1 min-w-0 bg-transparent outline-none text-[19px] placeholder:text-[var(--muted)]" value={text}
            onChange={e => setText(e.target.value)} placeholder="Add something…" />
          <button type="button" onClick={toggleMic} aria-label={rec ? 'Stop recording' : 'Speak'} title={rec ? 'Stop' : 'Speak'}
            className={`w-9 h-9 shrink-0 rounded-full grid place-items-center transition ${rec ? 'bg-red-500 text-white' : 'muted hover:bg-[var(--line)] hover:text-[var(--text)]'}`}>
            {rec ? <Art name="pause" size={24} /> : <Art name="mic" size={24} />}
          </button>
        </form>

        {(status || saved || actions || !text) && <div className="border-t border-[var(--line)] px-5 py-4 space-y-3">
          {status && <p className="text-sm muted">{status.endsWith('…') || status.includes('Listening') ? <Thinking state={rec ? 'listening' : 'working'} label={status} /> : status}</p>}
          {saved && <p className="text-sm text-green-500 font-medium flex items-center gap-1.5"><Art name="check" size={18} />{saved}</p>}

          {actions && <>
            <div className="space-y-1">
              {actions.map((x, i) => (
                <label key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[var(--line)] transition ${x.on ? '' : 'opacity-45'}`}>
                  <input type="checkbox" className="w-4 h-4 accent-[var(--accent)]" checked={x.on}
                    onChange={() => setActions(actions.map((y, j) => (j === i ? { ...y, on: !y.on } : y)))} />
                  <Art name={({ event: 'today', shopping: 'cart', meal: 'eat', confusion: 'brain' } as Record<string, string>)[x.a.type] ?? 'plus'} size={24} /><span className="text-[15px]">{describe(x.a)}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button className="px-3 py-1.5 rounded-lg text-sm hover:bg-[var(--line)]" onClick={reset}>Start over</button>
              <button className="btn" onClick={save} disabled={!actions.some(x => x.on)}>Add</button>
            </div>
          </>}

          {!actions && !status && !saved && <>
            <div className="text-[11px] font-semibold uppercase tracking-wider muted">Try</div>
            <div className="flex flex-wrap gap-2">
              {['Chemistry homework Thursday 4pm', 'Add milk and eggs', 'Pasta for dinner tomorrow', 'I don’t get moles in Chemistry'].map(t => (
                <button key={t} type="button" onClick={() => { setText(t); input.current?.focus() }}
                  className="text-sm px-3 py-1.5 rounded-full border border-[var(--line)] hover:bg-[var(--line)] transition">{t}</button>
              ))}
            </div>
          </>}
        </div>}

        <div className="flex items-center gap-4 px-5 py-2.5 text-[11px] muted border-t border-[var(--line)]">
          <span><Kbd>↵</Kbd> to add</span><span><Kbd>esc</Kbd> to close</span><span className="ml-auto"><Kbd>Ctrl</Kbd> <Kbd>K</Kbd> anywhere</span>
        </div>
      </div>
    </div>}
  </>
}

const Kbd = ({ children }: { children: React.ReactNode }) =>
  <kbd className="inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-md border border-[var(--line)] font-sans text-[10px] font-semibold">{children}</kbd>
