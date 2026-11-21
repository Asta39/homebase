import type { CSSProperties } from 'react'
import { useTheme } from '../lib/theme'

type Corner = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm'
const POS: Record<Corner, CSSProperties> = {
  tl: { top: 0, left: 0, translate: '-38% -42%' },
  tr: { top: 0, right: 0, translate: '38% -42%' },
  bl: { bottom: 0, left: 0, translate: '-38% 40%' },
  br: { bottom: 0, right: 0, translate: '34% 36%' },
  tm: { top: 0, left: '62%', translate: '-50% -55%' },   // peeking over the top edge
  bm: { bottom: 0, left: '30%', translate: '-50% 52%' }, // tucked under the bottom edge
}

/**
 * A cut-out object tucked over a card's edge (themes only; Classic renders nothing).
 * `item` indexes the theme's ordered cut-out list (wraps around), so every theme fills the same slots with its own pieces.
 * Place inside a positioned card. Purely decorative: hidden from screen readers and never blocks clicks.
 */
export default function Decor({ item, corner = 'tr', size = 64, rotate = 0 }: { item: number; corner?: Corner; size?: number; rotate?: number }) {
  const theme = useTheme()
  if (!theme.decos.length) return null
  const d = theme.decos[item % theme.decos.length]
  return (
    <img src={d.src} alt="" aria-hidden draggable={false} loading="lazy"
      className="decor pointer-events-none select-none absolute z-20"
      style={{ ...POS[corner], width: `calc(${size}px * var(--deco-scale))`, height: `calc(${size}px * var(--deco-scale))`, rotate: `${rotate}deg` }} />
  )
}
