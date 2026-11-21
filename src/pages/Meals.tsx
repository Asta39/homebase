import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Meal } from '../lib/db'
import { form } from '../components/Dialog'
import ShoppingList from '../components/ShoppingList'
import { ymd } from '../lib/workout'

const SLOTS: Meal['slot'][] = ['breakfast', 'lunch', 'dinner', 'snack']

function weekDates() {
  const d = new Date(); const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return ymd(x) })
}

export default function Meals() {
  const dates = weekDates()
  const meals = useLiveQuery(() => db.meals.where('date').between(dates[0], dates[6], true, true).toArray(), [dates[0]]) ?? []
  const set = async (date: string, slot: Meal['slot']) => {
    const existing = meals.find(m => m.date === date && m.slot === slot)
    const day = new Date(date + 'T00:00').toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
    const v = await form({
      title: `${slot[0].toUpperCase() + slot.slice(1)} · ${day}`,
      fields: [{ name: 'name', label: 'Meal', value: existing?.name ?? '', placeholder: 'e.g. Chicken wrap' }],
      extra: existing ? { label: 'Remove', action: 'delete' } : undefined,
    })
    if (!v) return
    const name = v._action === 'delete' ? '' : v.name.trim()
    if (existing) name ? db.meals.update(existing.id!, { name }) : db.meals.delete(existing.id!)
    else if (name) db.meals.add({ date, slot, name })
  }
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Meal planner</h1>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th />{dates.map(d => <th key={d} className="p-2 text-left">{new Date(d + 'T00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</th>)}</tr></thead>
          <tbody>{SLOTS.map(s => (
            <tr key={s} className="border-t" style={{ borderColor: 'var(--line)' }}>
              <td className="p-2 muted capitalize">{s}</td>
              {dates.map(d => <td key={d} className="p-2 cursor-pointer hover:bg-[var(--line)]" onClick={() => set(d, s)}>
                {meals.find(m => m.date === d && m.slot === s)?.name ?? <span className="muted">+</span>}
              </td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-4 max-w-2xl"><ShoppingList meals={meals.map(m => m.name)} /></div>
    </div>
  )
}
