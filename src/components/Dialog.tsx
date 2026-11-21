import { useEffect, useRef, useState } from 'react'

/**
 * In-app replacement for prompt()/confirm()/alert(), which the Tauri webview blocks.
 * Usage: const v = await form({ title, fields }); if (v) ...
 */

export type Field = {
  name: string; label: string
  type?: 'text' | 'select' | 'color' | 'date'
  value?: string; placeholder?: string; required?: boolean
  options?: { value: string; label: string }[]
}
type Values = Record<string, string>
type Request = {
  title: string; message?: string; fields: Field[]
  submit: string; cancel?: string; danger?: boolean
  /** Optional secondary destructive button (e.g. Delete) — resolves with { _action: name } */
  extra?: { label: string; action: string }
  resolve: (v: Values | null) => void
}

let open: ((r: Request) => void) | null = null
const show = (r: Omit<Request, 'resolve'>) =>
  new Promise<Values | null>(resolve => open ? open({ ...r, resolve }) : resolve(null))

export const form = (o: { title: string; message?: string; fields: Field[]; submit?: string; extra?: Request['extra'] }) =>
  show({ submit: 'Save', cancel: 'Cancel', ...o })

export const confirmBox = async (title: string, message?: string, submit = 'Delete') =>
  (await show({ title, message, fields: [], submit, cancel: 'Cancel', danger: true })) !== null

export const notify = async (title: string, message?: string) => { await show({ title, message, fields: [], submit: 'OK' }) }

export function DialogHost() {
  const [req, setReq] = useState<Request | null>(null)
  const [values, setValues] = useState<Values>({})
  const first = useRef<HTMLInputElement & HTMLSelectElement>(null)

  useEffect(() => {
    open = r => { setValues(Object.fromEntries(r.fields.map(f => [f.name, f.value ?? f.options?.[0]?.value ?? '']))); setReq(r) }
    return () => { open = null }
  }, [])
  useEffect(() => { if (req) setTimeout(() => first.current?.focus(), 0) }, [req])

  if (!req) return null
  const close = (v: Values | null) => { req.resolve(v); setReq(null) }
  const missing = req.fields.some(f => f.required && !values[f.name]?.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onMouseDown={e => e.target === e.currentTarget && close(null)}
      onKeyDown={e => e.key === 'Escape' && close(null)}>
      <form className="panel w-full max-w-sm p-5 space-y-3 shadow-2xl"
        onSubmit={e => { e.preventDefault(); if (!missing) close(values) }}>
        <h2 className="text-lg font-semibold">{req.title}</h2>
        {req.message && <p className="muted text-sm whitespace-pre-wrap">{req.message}</p>}
        {req.fields.map((f, i) => (
          <label key={f.name} className="block text-sm">
            <span className="muted">{f.label}</span>
            {f.type === 'select'
              ? <select ref={i === 0 ? first : undefined} className="input mt-1" value={values[f.name]}
                  onChange={e => setValues({ ...values, [f.name]: e.target.value })}>
                  {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              : <input ref={i === 0 ? first : undefined} className={`input mt-1 ${f.type === 'color' ? '!h-10 !p-1' : ''}`}
                  type={f.type ?? 'text'} placeholder={f.placeholder} value={values[f.name]}
                  onChange={e => setValues({ ...values, [f.name]: e.target.value })} />}
          </label>
        ))}
        <div className="flex gap-2 pt-2">
          {req.extra && <button type="button" className="text-red-500 text-sm mr-auto"
            onClick={() => close({ _action: req.extra!.action })}>{req.extra.label}</button>}
          <div className="flex gap-2 ml-auto">
            {req.cancel && <button type="button" className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)]" onClick={() => close(null)}>{req.cancel}</button>}
            <button type="submit" disabled={missing} className={`btn ${req.danger ? '!bg-red-500' : ''}`}>{req.submit}</button>
          </div>
        </div>
      </form>
    </div>
  )
}
