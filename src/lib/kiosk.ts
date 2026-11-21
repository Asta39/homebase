/** Kiosk helpers: full screen, keep screen awake, launch at startup. Work in Tauri and (mostly) in a browser. */
import { getSetting, setSetting } from './db'

export const isTauri = () => '__TAURI_INTERNALS__' in window

export type KioskSettings = {
  startInKiosk: boolean   // open straight into kiosk when the app launches
  idleMinutes: number     // return to kiosk after this many idle minutes (0 = never)
  dimFrom: string         // "22:00" — night dimming start ('' = off)
  dimTo: string           // "06:30"
}
export const KIOSK_DEFAULTS: KioskSettings = { startInKiosk: false, idleMinutes: 0, dimFrom: '22:00', dimTo: '06:30' }

export async function loadKiosk(): Promise<KioskSettings> {
  try { return { ...KIOSK_DEFAULTS, ...JSON.parse(await getSetting('kiosk') || '{}') } } catch { return KIOSK_DEFAULTS }
}
export const saveKiosk = (k: KioskSettings) => setSetting('kiosk', JSON.stringify(k))

export async function setFullscreen(on: boolean) {
  try {
    if (isTauri()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().setFullscreen(on)
    } else if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen()
    else if (!on && document.fullscreenElement) await document.exitFullscreen()
  } catch { /* browsers may refuse without a user gesture — kiosk still works windowed */ }
}

/** Screen Wake Lock: stops the laptop sleeping while the dashboard is up. Re-acquired when the tab is visible again. */
export function keepAwake() {
  let lock: WakeLockSentinel | null = null
  const get = async () => { try { if (document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen') } catch { /* unsupported */ } }
  const onVis = () => { if (document.visibilityState === 'visible') get() }
  get(); document.addEventListener('visibilitychange', onVis)
  return () => { document.removeEventListener('visibilitychange', onVis); lock?.release().catch(() => {}) }
}

/** Is `now` inside the dim window? Handles windows that cross midnight. */
export function isDimTime(k: KioskSettings, now = new Date()) {
  if (!k.dimFrom || !k.dimTo) return false
  const m = now.getHours() * 60 + now.getMinutes()
  const [a, b] = [k.dimFrom, k.dimTo].map(t => { const [h, mm] = t.split(':').map(Number); return h * 60 + mm })
  return a <= b ? m >= a && m < b : m >= a || m < b
}

export async function getAutostart() {
  if (!isTauri()) return null
  const { isEnabled } = await import('@tauri-apps/plugin-autostart')
  return isEnabled()
}
export async function setAutostart(on: boolean) {
  const { enable, disable } = await import('@tauri-apps/plugin-autostart')
  await (on ? enable() : disable())
}
