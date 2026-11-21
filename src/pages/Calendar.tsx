import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg, DateSelectArg, EventClickArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CalEvent } from '../lib/db'
import { form, type Field } from '../components/Dialog'

export default function Calendar() {
  const subjects = useLiveQuery(() => db.subjects.toArray()) ?? []
  const events = useLiveQuery(() => db.events.toArray()) ?? []
  const color = (sid?: number) => subjects.find(s => s.id === sid)?.color ?? '#8e8e93'

  const move = (a: EventDropArg | EventResizeDoneArg) => db.events.update(Number(a.event.id), {
    start: a.event.startStr, end: a.event.endStr || undefined, allDay: a.event.allDay,
    auto: false, // she moved it by hand → it's hers now; regenerating the plan will work around it
  })
  const subjectField = (value = ''): Field => ({
    name: 'subjectId', label: 'Subject', type: 'select', value,
    options: [{ value: '', label: 'None' }, ...subjects.map(s => ({ value: String(s.id), label: s.name }))],
  })
  const kindField = (value = 'task'): Field => ({
    name: 'kind', label: 'Type', type: 'select', value,
    options: ['task', 'study', 'exam', 'workout', 'meal'].map(k => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })),
  })
  const when = (start: Date, end: Date | null, allDay: boolean) => allDay
    ? start.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
    : `${start.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${end ? ` – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`

  const add = async (s: DateSelectArg) => {
    s.view.calendar.unselect()
    const v = await form({
      title: 'New event', message: when(s.start, s.end, s.allDay), submit: 'Add',
      fields: [{ name: 'title', label: 'Title', placeholder: 'e.g. Chemistry homework', required: true }, subjectField(), kindField()],
    })
    if (!v) return
    const subjectId = v.subjectId ? Number(v.subjectId) : undefined
    await db.events.add({ title: v.title.trim(), start: s.startStr, end: s.endStr, allDay: s.allDay, subjectId, kind: v.kind as CalEvent['kind'] })
  }
  const edit = async (c: EventClickArg) => {
    const id = Number(c.event.id)
    const e = events.find(x => x.id === id); if (!e) return
    const v = await form({
      title: 'Edit event', message: when(c.event.start!, c.event.end, c.event.allDay),
      fields: [{ name: 'title', label: 'Title', value: e.title, required: true }, subjectField(e.subjectId ? String(e.subjectId) : ''), kindField(e.kind)],
      extra: { label: 'Delete', action: 'delete' },
    })
    if (!v) return
    if (v._action === 'delete') return db.events.delete(id)
    await db.events.update(id, { title: v.title.trim(), subjectId: v.subjectId ? Number(v.subjectId) : undefined, kind: v.kind as CalEvent['kind'] })
  }

  return (
    <div className="panel ios-cal p-4 sm:p-5 h-[calc(100vh-7.5rem)] min-h-[520px]">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }}
        buttonText={{ today: 'Today', day: 'Day', week: 'Week', month: 'Month' }}
        dayHeaderContent={a => a.view.type === 'dayGridMonth'
          ? <span className="ios-dh-w">{a.date.toLocaleDateString([], { weekday: 'short' })}</span>
          : <div className={`ios-dh ${[0, 6].includes(a.date.getDay()) ? 'is-wkend' : ''}`}><span className="ios-dh-w">{a.date.toLocaleDateString([], { weekday: 'short' })}</span><span className="ios-dh-d">{a.date.getDate()}</span></div>}
        allDayText="all-day" slotLabelFormat={{ hour: 'numeric', meridiem: 'short' }} dayMaxEvents={3}
        eventContent={a => <div className="ios-ev" style={{ '--ev': a.event.backgroundColor } as React.CSSProperties}>
          {a.timeText && !a.event.allDay && <div className="ios-ev-t">{a.timeText}</div>}<div className="ios-ev-n">{a.event.title}</div></div>}
        height="100%" nowIndicator editable selectable selectMirror firstDay={1}
        slotMinTime="06:00:00" scrollTime="07:00:00"
        events={events.map(e => ({ id: String(e.id), title: e.title, start: e.start, end: e.end, allDay: e.allDay, backgroundColor: color(e.subjectId) }))}
        eventDrop={move} eventResize={move} select={add} eventClick={edit}
      />
    </div>
  )
}
