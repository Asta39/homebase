import Dexie, { type EntityTable } from 'dexie'

export interface Subject { id?: number; name: string; color: string; examDate?: string }
export interface CalEvent {
  id?: number; title: string; start: string; end?: string; allDay?: boolean
  subjectId?: number; kind: 'task' | 'study' | 'workout' | 'meal' | 'exam' | 'recap'; done?: boolean
  auto?: boolean // created by the study planner; replaced when the plan is regenerated
}
export interface Note { id?: number; subjectId: number; title: string; content: string; createdAt: string }
export interface Flashcard {
  id?: number; subjectId: number; noteId?: number; front: string; back: string
  due: string; fsrs?: string // serialized ts-fsrs Card
}
/** Things she didn't get — feeds the weekend recap */
export interface Confusion { id?: number; subjectId: number; text: string; source: 'card' | 'chat' | 'manual'; createdAt: string; resolved?: boolean }
export interface Workout { id?: number; day: number; name: string; sets: string } // day 0=Sun
export interface Meal { id?: number; date: string; slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'; name: string }
export interface Setting { key: string; value: string }
/** One syllabus point, self-rated Red / Amber / Green */
export type RAG = 'red' | 'amber' | 'green' | 'none'
export interface Topic { id?: number; subjectId: number; code: string; title: string; rating: RAG; order: number }
/** Shopping list item. auto = generated from the meal plan (replaced on regenerate). */
export interface ShopItem { id?: number; name: string; qty: string; aisle: string; done: boolean; auto: boolean; createdAt: string }
/** A searchable slice of a note, with its embedding (empty until indexed). */
export interface Chunk { id?: number; noteId: number; subjectId: number; idx: number; text: string; vec: Float32Array | null }
/** A completed focus (Pomodoro) block — feeds study-time stats and the weekly report. */
export interface FocusSession { id?: number; subjectId?: number; topic?: string; start: string; minutes: number }
/** Sets ticked for one exercise on one date. */
export interface WorkoutLog { id?: number; date: string; workoutId: number; done: number }
/** One row per day: sleep, water, mood. */
export interface DayCheck { date: string; sleep?: number; water: number; mood?: number }
export interface Habit { id?: number; name: string; icon: string; order: number }
export interface HabitLog { id?: number; date: string; habitId: number }
export interface QuizResult { id?: number; subjectId: number; score: number; total: number; date: string }
/** A red/amber/green rating change — lets the weekly report show topics that improved. */
export interface TopicChange { id?: number; topicId: number; subjectId: number; from: RAG; to: RAG; date: string }
/** A marked past-paper question attempt */
export interface Attempt {
  id?: number; subjectId: number; paper: string; question: string; scheme: string; answer: string
  score: number; max: number; feedback: string; createdAt: string
}

export const db = new Dexie('homebase') as Dexie & {
  subjects: EntityTable<Subject, 'id'>
  events: EntityTable<CalEvent, 'id'>
  notes: EntityTable<Note, 'id'>
  flashcards: EntityTable<Flashcard, 'id'>
  confusions: EntityTable<Confusion, 'id'>
  workouts: EntityTable<Workout, 'id'>
  meals: EntityTable<Meal, 'id'>
  settings: EntityTable<Setting, 'key'>
  topics: EntityTable<Topic, 'id'>
  attempts: EntityTable<Attempt, 'id'>
  shopping: EntityTable<ShopItem, 'id'>
  chunks: EntityTable<Chunk, 'id'>
  focus: EntityTable<FocusSession, 'id'>
  workoutLog: EntityTable<WorkoutLog, 'id'>
  wellbeing: EntityTable<DayCheck, 'date'>
  habits: EntityTable<Habit, 'id'>
  habitLog: EntityTable<HabitLog, 'id'>
  quizzes: EntityTable<QuizResult, 'id'>
  topicLog: EntityTable<TopicChange, 'id'>
}

db.version(1).stores({
  subjects: '++id, name',
  events: '++id, start, subjectId, kind',
  notes: '++id, subjectId, createdAt',
  flashcards: '++id, subjectId, due',
  confusions: '++id, subjectId, resolved, createdAt',
  workouts: '++id, day',
  meals: '++id, date',
  settings: 'key',
})
db.version(2).stores({
  topics: '++id, subjectId, rating, order',
  attempts: '++id, subjectId, createdAt',
})
db.version(3).stores({
  shopping: '++id, aisle, done, auto',
})
db.version(4).stores({
  chunks: '++id, noteId, subjectId',
})
db.version(5).stores({
  focus: '++id, subjectId, start',
})
db.version(6).stores({
  workoutLog: '++id, date, workoutId, [date+workoutId]',
})
db.version(7).stores({
  wellbeing: 'date',
  habits: '++id, order',
  habitLog: '++id, date, habitId, [date+habitId]',
})
db.version(8).stores({
  quizzes: '++id, subjectId, date',
})
db.version(9).stores({
  topicLog: '++id, subjectId, date',
})
// Record every rating change, whichever screen makes it
db.topics.hook('updating', (mods, key, obj) => {
  const to = (mods as Partial<Topic>).rating
  // setTimeout: write outside the topics-only transaction this hook runs in
  if (to && to !== obj.rating) { const row = { topicId: key as number, subjectId: obj.subjectId, from: obj.rating, to, date: new Date().toISOString() }; setTimeout(() => db.topicLog.add(row), 0) }
})
// Keep the search index in step with notes, whoever deletes them
db.notes.hook('deleting', (key) => { db.chunks.where('noteId').equals(key as number).delete() })

export async function getSetting(key: string) {
  return (await db.settings.get(key))?.value ?? ''
}
export const setSetting = (key: string, value: string) => db.settings.put({ key, value })

/** Full JSON backup / restore — the app's only persistence besides IndexedDB */
export async function exportAll() {
  const out: Record<string, unknown[]> = {}
  for (const t of db.tables) out[t.name] = await t.toArray()
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: out })
}
export async function importAll(json: string) {
  const { data } = JSON.parse(json) as { data: Record<string, unknown[]> }
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) { await t.clear(); if (data[t.name]) await t.bulkAdd(data[t.name]) }
  })
}

export async function seedIfEmpty() {
  // Check-and-insert inside ONE read-write transaction: IndexedDB runs these one at a time,
  // so a double call (React dev mode, two windows) can't seed twice.
  await db.transaction('rw', db.subjects, async () => {
    if ((await db.subjects.count()) > 0) return
    await db.subjects.bulkAdd([
      { name: 'Mathematics', color: '#0a84ff' },
      { name: 'Biology', color: '#30d158' },
      { name: 'Chemistry', color: '#ff9f0a' },
      { name: 'Physics', color: '#bf5af2' },
      { name: 'English', color: '#ff375f' },
    ])
  })
}
