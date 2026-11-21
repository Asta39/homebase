import confetti from 'canvas-confetti'
import { artUrl } from '../components/Art'

const TOP = 2147483000 // above cards, dialogs, decorations — everything

/**
 * Short confetti burst + a toast pinned above everything. Respects reduced-motion (toast only).
 * `icon` is generated art shown in the toast; `:gem:` `:flame:` `:freeze:` in the message render as inline art.
 */
export function celebrate(message: string, colors: string[] = ['#0a84ff', '#30d158', '#ff9f0a'], icon?: string) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!reduce) {
    const burst = (x: number, angle: number) => confetti({ particleCount: 70, spread: 70, startVelocity: 45, angle, origin: { x, y: 0.7 }, colors, disableForReducedMotion: true, zIndex: TOP })
    burst(0.15, 60); burst(0.85, 120)
  }
  const img = (src: string, px: number) => { const i = document.createElement('img'); i.src = src; i.alt = ''; i.style.cssText = `width:${px}px;height:${px}px;object-fit:contain;flex-shrink:0`; return i }
  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.style.cssText = `position:fixed;left:50%;top:28px;transform:translateX(-50%);z-index:${TOP + 1};display:flex;align-items:center;gap:10px;` +
    'padding:10px 22px 10px 12px;border-radius:999px;max-width:calc(100vw - 32px);pointer-events:none;' +
    'font:600 16px -apple-system,"Segoe UI",system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.82);backdrop-filter:blur(12px);' +
    'box-shadow:0 10px 30px rgba(0,0,0,.3);transition:opacity .4s, transform .4s;opacity:0'
  if (icon) el.appendChild(img(artUrl(icon), 34)); else el.style.paddingLeft = '22px'
  const text = document.createElement('span')
  text.style.cssText = 'display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap'
  message.split(/(:gem:|:flame:|:freeze:)/).forEach(part => {
    const m = part.match(/^:(gem|flame|freeze):$/)
    text.appendChild(m ? img(artUrl(m[1]), 20) : document.createTextNode(part))
  })
  el.appendChild(text)
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(4px)' })
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500) }, 2600)
}
