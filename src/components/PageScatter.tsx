import { useLocation } from 'react-router-dom'
import { useTheme } from '../lib/theme'

/** Spots in the page margins/gaps, as % of the content area. Cards sit above, so these read like a collage layer. */
const SPOTS = [
  { left: '2%', top: '78%', size: 124, rot: -14 },
  { left: '88%', top: '12%', size: 104, rot: 12 },
  { left: '46%', top: '90%', size: 96, rot: 8 },
  { left: '93%', top: '62%', size: 112, rot: -8 },
  { left: '24%', top: '4%', size: 88, rot: 18 },
]

/** A few loose cut-outs behind each page, picked per route so every screen looks a little different. */
export default function PageScatter() {
  const theme = useTheme()
  const { pathname } = useLocation()
  if (!theme.decos.length || pathname === '/') return null // the dashboard has its own placements
  const seed = [...pathname].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  const n = theme.decos.length
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 hidden lg:block" aria-hidden>
      {SPOTS.slice(0, 4 + (seed % 2)).map((s, i) => {
        const d = theme.decos[(seed + i * 5) % n]
        return <img key={i} src={d.src} alt="" draggable={false} className="decor absolute opacity-90"
          style={{ left: s.left, top: s.top, width: `calc(${s.size}px * var(--deco-scale))`, height: `calc(${s.size}px * var(--deco-scale))`, rotate: `${s.rot + ((seed >> i) % 11) - 5}deg` }} />
      })}
    </div>
  )
}
