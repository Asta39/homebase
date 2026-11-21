import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { form } from '../components/Dialog'

export default function Study() {
  const subjects = useLiveQuery(() => db.subjects.toArray()) ?? []
  const add = async () => {
    const v = await form({ title: 'New subject', submit: 'Add', fields: [
      { name: 'name', label: 'Name', placeholder: 'e.g. Geography', required: true },
      { name: 'color', label: 'Colour', type: 'color', value: '#64d2ff' },
      { name: 'examDate', label: 'Exam date (optional)', type: 'date' },
    ] })
    if (v) db.subjects.add({ name: v.name.trim(), color: v.color, examDate: v.examDate || undefined })
  }
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Subjects</h1>
        <button className="btn" onClick={add}>+ Subject</button>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {subjects.map(s => (
          <Link key={s.id} to={`/study/${s.id}`} className="panel p-5 hover:scale-[1.02] transition-transform">
            <div className="w-3 h-3 rounded-full mb-3" style={{ background: s.color }} />
            <div className="font-semibold">{s.name}</div>
            <div className="muted text-sm">{s.examDate ? `Exam ${s.examDate}` : 'No exam date'}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
