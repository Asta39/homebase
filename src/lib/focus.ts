/**
 * Focus timer store (Pomodoro). Lives outside React so it keeps running across pages,
 * and saves its end time so a reload/app restart picks up where it left off.
 */
import { useSyncExternalStore } from 'react'
import { db } from './db'

export type Phase = 'idle' | 'focus' | 'break'
export type FocusState = {
  phase: Phase
  endsAt: number | null        // ms timestamp the current phase ends (null while paused/idle)
  remaining: number            // ms left (authoritative while paused)
  paused: boolean
  focusMin: number; breakMin: number
  subjectId?: number; topic?: string
  startedAt?: number           // when the current focus phase began
  round: number                // completed focus rounds this sitting
}

const KEY = 'homebase.focus'
const initial: FocusState = { phase: 'idle', endsAt: null, remaining: 25 * 6e4, paused: false, focusMin: 25, breakMin: 5, round: 0 }

let state: FocusState = (() => {
  try { return { ...initial, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return initial }
})()
const listeners = new Set<() => void>()
const set = (patch: Partial<FocusState>) => {
  state = { ...state, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
  listeners.forEach(l => l())
}
export const useFocus = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)

/** ms left in the current phase */
export const timeLeft = (s = state) => s.paused || !s.endsAt ? s.remaining : Math.max(0, s.endsAt - Date.now())

export function start(opts: { subjectId?: number; topic?: string; focusMin: number; breakMin: number }) {
  const ms = opts.focusMin * 6e4
  set({ ...opts, phase: 'focus', endsAt: Date.now() + ms, remaining: ms, paused: false, startedAt: Date.now(), round: 0 })
}
export function pause() { if (!state.paused && state.endsAt) set({ paused: true, remaining: timeLeft(), endsAt: null }) }
export function resume() { if (state.paused) set({ paused: false, endsAt: Date.now() + state.remaining }) }

/** Stop early. Logs the focus minutes done so far (if at least 1) so partial work still counts. */
export async function stop() {
  if (state.phase === 'focus' && state.startedAt) {
    const done = Math.floor((state.focusMin * 6e4 - timeLeft()) / 6e4)
    if (done >= 1) await log(done)
  }
  set({ phase: 'idle', endsAt: null, paused: false, remaining: state.focusMin * 6e4 })
}
export function skipBreak() { if (state.phase === 'break') nextFocus() }

async function log(minutes: number) {
  await db.focus.add({ subjectId: state.subjectId, topic: state.topic, start: new Date(state.startedAt ?? Date.now()).toISOString(), minutes })
}
function nextFocus() {
  const ms = state.focusMin * 6e4
  set({ phase: 'focus', endsAt: Date.now() + ms, remaining: ms, paused: false, startedAt: Date.now() })
}

// ---------- chime + notification ----------
function chime(up: boolean) {
  try {
    const ctx = new AudioContext()
    const notes = up ? [523, 659, 784] : [784, 659, 523]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = f; o.type = 'sine'
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5)
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.55)
    })
  } catch { /* no audio */ }
}
function notify(title: string, body: string) {
  try { if (Notification.permission === 'granted') new Notification(title, { body }) } catch { /* unsupported */ }
}
export function askNotificationPermission() {
  try { if (Notification.permission === 'default') Notification.requestPermission() } catch { /* unsupported */ }
}

// ---------- ticker: moves between phases even if the Focus page isn't open ----------
let ticking = false
export function startTicker() {
  if (ticking) return; ticking = true
  setInterval(async () => {
    if (state.phase === 'idle' || state.paused || !state.endsAt) return
    state = { ...state }; listeners.forEach(l => l()) // new snapshot → countdowns re-render
    if (Date.now() < (state.endsAt ?? Infinity)) return
    if (state.phase === 'focus') {
      const round = state.round + 1
      set({ endsAt: null }) // guard against double-logging before await finishes
      await log(state.focusMin)
      const long = round % 4 === 0 // every 4th break is long
      const ms = (long ? state.breakMin * 3 : state.breakMin) * 6e4
      chime(false); notify('Focus done 🎉', `Take a ${long ? 'long ' : ''}${ms / 6e4}-minute break.`)
      set({ phase: 'break', round, endsAt: Date.now() + ms, remaining: ms })
    } else {
      chime(true); notify('Break over', 'Back to it — next focus round started.')
      nextFocus()
    }
  }, 500)
}

export const fmt = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
