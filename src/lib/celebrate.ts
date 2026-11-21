import confetti from 'canvas-confetti'

/** Short confetti burst + a toast. Respects reduced-motion (toast only). */
export function celebrate(message: string, colors: string[] = ['#0a84ff', '#30d158', '#ff9f0a']) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!reduce) {
    const burst = (x: number, angle: number) => confetti({ particleCount: 70, spread: 70, startVelocity: 45, angle, origin: { x, y: 0.7 }, colors, disableForReducedMotion: true })
    burst(0.15, 60); burst(0.85, 120)
  }
  const el = document.createElement('div')
  el.textContent = message
  el.setAttribute('role', 'status')
  el.style.cssText = 'position:fixed;left:50%;top:28px;transform:translateX(-50%);z-index:60;padding:12px 22px;border-radius:999px;' +
    'font:600 16px -apple-system,"Segoe UI",system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.78);backdrop-filter:blur(12px);' +
    'box-shadow:0 10px 30px rgba(0,0,0,.3);transition:opacity .4s, transform .4s;opacity:0'
  document.body.appendChild(el)
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(4px)' })
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500) }, 2600)
}
