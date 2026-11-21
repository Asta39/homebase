import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { AISLES, cookWith, shoppingFromMeals } from '../lib/groq'
import { confirmBox, form, notify } from './Dialog'
import Thinking from './Thinking'

/** Shopping list: auto-built from the week's meals, plus anything added by hand. */
export default function ShoppingList({ meals }: { meals: string[] }) {
  const items = useLiveQuery(() => db.shopping.toArray()) ?? []
  const [busy, setBusy] = useState('')
  const [quick, setQuick] = useState('')
  const [ideas, setIdeas] = useState('')
  const left = items.filter(i => !i.done).length

  const generate = async () => {
    const v = await form({
      title: 'Build list from meal plan', submit: 'Build list',
      message: `Uses the ${meals.length} meals planned this week. Items added by hand are kept.`,
      fields: [{ name: 'have', label: 'Already have at home (optional)', placeholder: 'e.g. rice, eggs, onions' }],
    })
    if (!v) return
    setBusy('Building list…')
    try {
      const list = await shoppingFromMeals(meals, v.have)
      const now = new Date().toISOString()
      await db.transaction('rw', db.shopping, async () => {
        await db.shopping.filter(i => i.auto).delete()
        await db.shopping.bulkAdd(list.map(i => ({ name: i.name, qty: i.qty ?? '', aisle: AISLES.includes(i.aisle) ? i.aisle : 'Other', done: false, auto: true, createdAt: now })))
      })
    } catch (e) { await notify("Couldn't build the list", (e as Error).message) }
    finally { setBusy('') }
  }

  const addQuick = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = quick.trim(); if (!name) return
    setQuick('') // clear first so fast typing doesn't merge into this item
    await db.shopping.add({ name, qty: '', aisle: 'Other', done: false, auto: false, createdAt: new Date().toISOString() })
  }

  const ideasFor = async () => {
    const v = await form({ title: 'What can I cook with…', submit: 'Get ideas',
      fields: [{ name: 'have', label: 'Ingredients you have', placeholder: 'e.g. chicken, rice, peppers', required: true }] })
    if (!v) return
    setBusy('Thinking…')
    try { setIdeas(await cookWith(v.have)) } catch (e) { await notify('Something went wrong', (e as Error).message) }
    finally { setBusy('') }
  }

  const copy = async () => {
    const text = AISLES.map(a => {
      const list = items.filter(i => i.aisle === a && !i.done)
      return list.length ? `${a}\n${list.map(i => `- ${i.name}${i.qty ? ` (${i.qty})` : ''}`).join('\n')}` : ''
    }).filter(Boolean).join('\n\n')
    try { await navigator.clipboard.writeText(text); await notify('Copied', 'Paste it into WhatsApp or Notes.') }
    catch { await notify("Couldn't copy", text) }
  }

  return (
    <section className="panel p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Shopping list</h2>
        <span className="muted text-sm">{left} to buy</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)] text-sm" onClick={ideasFor} disabled={!!busy}>🍳 Cook with…</button>
          {left > 0 && <button className="px-3 py-1.5 rounded-lg hover:bg-[var(--line)] text-sm" onClick={copy}>Copy</button>}
          <button className="btn text-sm" onClick={generate} disabled={!!busy || !meals.length}
            title={meals.length ? '' : 'Plan some meals first'}>{busy ? <Thinking onAccent state="working" label={busy} /> : 'Build from meals'}</button>
        </div>
      </div>

      <form onSubmit={addQuick}><input className="input" value={quick} onChange={e => setQuick(e.target.value)} placeholder="Add an item and press Enter" /></form>

      {items.length === 0 && <p className="muted text-sm">Empty. Plan meals above, then “Build from meals” — or add items by hand.</p>}
      {AISLES.map(a => {
        const list = items.filter(i => i.aisle === a).sort((x, y) => Number(x.done) - Number(y.done))
        if (!list.length) return null
        return (
          <div key={a}>
            <div className="muted text-xs uppercase tracking-wide mb-1">{a}</div>
            {list.map(i => (
              <label key={i.id} className="flex items-center gap-3 py-1 group cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-[var(--accent)]" checked={i.done} onChange={() => db.shopping.update(i.id!, { done: !i.done })} />
                <span className={`flex-1 ${i.done ? 'line-through muted' : ''}`}>{i.name}{i.qty && <span className="muted"> · {i.qty}</span>}</span>
                <button type="button" className="muted opacity-0 group-hover:opacity-100 text-sm" onClick={e => { e.preventDefault(); db.shopping.delete(i.id!) }}>✕</button>
              </label>
            ))}
          </div>
        )
      })}
      {items.some(i => i.done) && <button className="text-sm muted underline" onClick={async () => {
        if (await confirmBox('Clear ticked items?', undefined, 'Clear')) db.shopping.filter(i => i.done).delete()
      }}>Clear ticked items</button>}

      {ideas && <div className="border-t border-[var(--line)] pt-3">
        <div className="flex justify-between"><h3 className="font-semibold">Meal ideas</h3><button className="muted text-sm" onClick={() => setIdeas('')}>✕</button></div>
        <div className="whitespace-pre-wrap text-sm mt-1">{ideas}</div>
      </div>}
    </section>
  )
}
