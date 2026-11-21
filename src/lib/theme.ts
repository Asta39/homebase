/**
 * Themes: Classic (calm, default) + three playful ones with an image wallpaper and cut-out decorations.
 * Each playful theme has 12 cut-outs in a deliberate order: index 0 is its signature piece (top of the dashboard);
 * later ones scatter across the other cards and pages.
 * The choice lives in localStorage (instant on startup, no flash) and in the DB (so it's in backups).
 */
import { useSyncExternalStore } from 'react'
import { setSetting } from './db'

export type ThemeId = 'classic' | 'glam' | 'kitty' | 'blue'

export type Deco = { src: string; alt: string }
export type Theme = { id: ThemeId; name: string; tagline: string; preview: string; wall?: string; darkByDefault?: boolean; decos: Deco[] }

// Asset paths respect Vite's base, so the same code works at / (desktop app) and /homebase/ (GitHub Pages)
const A = (path: string) => `${import.meta.env.BASE_URL}${path}`
const set = (dir: string, files: string[]): Deco[] => files.map(f => ({ src: A(`themes/${dir}/${f}.png`), alt: f.replace(/-/g, ' ') }))

export const THEMES: Theme[] = [
  { id: 'classic', name: 'Classic', tagline: 'Calm and focused', preview: '', decos: [] },
  {
    id: 'glam', name: 'Cherry Glam', tagline: 'Leopard, cherries & red lips', preview: A('themes/glam/wall.jpg'), wall: A('themes/glam/wall.jpg'), darkByDefault: true,
    decos: set('glam', ['cherries', 'bow', 'star', 'kiss', 'eightball', 'leopard-kiss', 'bolt', 'red-bow', 'glitter-star', 'rose', 'perfume', 'heart']),
  },
  {
    id: 'kitty', name: 'Kitty', tagline: 'Pink leopard, bows & lace', preview: A('themes/kitty/wall.jpg'), wall: A('themes/kitty/wall.jpg'),
    decos: set('kitty', ['cherries', 'bow', 'star', 'lace-heart', 'kitten', 'leopard-bow', 'butterfly', 'disco', 'shell', 'macaron', 'flower', 'heart']),
  },
  {
    id: 'blue', name: 'Midnight Blue', tagline: 'Blue leopard, flowers & ocean', preview: A('themes/blue/wall.jpg'), wall: A('themes/blue/wall.jpg'), darkByDefault: true,
    decos: set('blue', ['leopard-bow', 'navy-bow', 'glitter-star', 'kiss', 'ball', 'turtle', 'disco', 'shell', 'starfish', 'flower', 'butterfly', 'jellyfish']),
  },
]

const KEY = 'homebase.theme'
const MODE_KEY = 'homebase.mode'
export type Mode = 'auto' | 'light' | 'dark'
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
}
let current: ThemeId = (THEMES.some(t => t.id === store.get(KEY)) ? store.get(KEY) : 'classic') as ThemeId
let mode: Mode = (['auto', 'light', 'dark'].includes(store.get(MODE_KEY) ?? '') ? store.get(MODE_KEY) : 'auto') as Mode

const media = window.matchMedia?.('(prefers-color-scheme: dark)')
/** What's actually shown. Auto follows Windows — except dark-wallpaper themes (Glam, Midnight Blue), which look best with dark cards. */
const resolve = (): 'light' | 'dark' => mode !== 'auto' ? mode : THEMES.find(t => t.id === current)?.darkByDefault ? 'dark' : media?.matches ? 'dark' : 'light'

const listeners = new Set<() => void>()
let snapshot = { theme: current, mode, resolved: resolve() }
const apply = () => {
  const resolved = resolve()
  const root = document.documentElement
  root.dataset.theme = current
  root.dataset.mode = resolved
  root.style.colorScheme = resolved
  // class for widgets that look for .dark/.light on an ancestor (e.g. thinking orbs)
  root.classList.toggle('dark', resolved === 'dark'); root.classList.toggle('light', resolved === 'light')
  snapshot = { theme: current, mode, resolved }
  listeners.forEach(l => l())
}
apply()
media?.addEventListener?.('change', apply)

export function setTheme(id: ThemeId) { current = id; store.set(KEY, id); setSetting('theme', id); apply() }
export function setMode(m: Mode) { mode = m; store.set(MODE_KEY, m); setSetting('mode', m); apply() }

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb) } }
const useSnap = () => useSyncExternalStore(subscribe, () => snapshot)
export function useTheme() {
  // Hook first, unconditionally — never inside a loop/callback (call count must not depend on the theme)
  const { theme } = useSnap()
  return THEMES.find(t => t.id === theme)!
}
/** { mode: the user's choice, resolved: 'light' | 'dark' actually shown } */
export function useMode() { const { mode, resolved } = useSnap(); return { mode, resolved } }
