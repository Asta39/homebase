import { useMemo, useState } from 'react'
import { makeMindMap, type MindNode } from '../../lib/studio'
import { notify } from '../Dialog'
import Thinking from '../Thinking'

const PALETTE = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a']
const ROW = 34, GAP = 48, CHAR = 7.2

type Placed = { label: string; x: number; y: number; w: number; depth: number; color: string; side: 1 | -1; parent?: Placed }

/** Root in the middle; branches split left/right; each subtree gets vertical space by its leaf count. */
function layout(root: MindNode): { nodes: Placed[]; width: number; height: number } {
  const leaves = (n: MindNode): number => (n.children?.length ? n.children.reduce((t, c) => t + leaves(c), 0) : 1)
  const branches = root.children ?? []
  const right: MindNode[] = [], left: MindNode[] = []
  let r = 0, l = 0 // balance by leaf count
  branches.forEach(b => { if (r <= l) { right.push(b); r += leaves(b) } else { left.push(b); l += leaves(b) } })
  const height = Math.max(r, l, 1) * ROW + 40
  const nodes: Placed[] = []
  const w = (s: string, d: number) => s.length * (d === 0 ? 8.5 : CHAR) + 24
  const rootNode: Placed = { label: root.label, x: 0, y: height / 2, w: w(root.label, 0), depth: 0, color: '#8e8e93', side: 1 }
  nodes.push(rootNode)

  const place = (list: MindNode[], side: 1 | -1, total: number) => {
    let top = (height - total * ROW) / 2
    list.forEach((b, i) => {
      const color = PALETTE[(side === 1 ? i : i + right.length) % PALETTE.length]
      const walk = (n: MindNode, depth: number, parent: Placed, y0: number): number => {
        const span = leaves(n) * ROW
        // x = this node's edge nearest its parent: parent's far edge + a gap
        const parentFar = parent.depth === 0 ? side * parent.w / 2 : parent.x + side * parent.w
        const p: Placed = { label: n.label, x: parentFar + side * GAP, y: y0 + span / 2, w: w(n.label, depth), depth, color, side, parent }
        nodes.push(p)
        let y = y0
        n.children?.forEach(c => { y += walk(c, depth + 1, p, y) })
        return span
      }
      top += walk(b, 1, rootNode, top)
    })
  }
  place(right, 1, r); place(left, -1, l)
  const maxX = Math.max(...nodes.map(n => Math.abs(n.x) + n.w))
  return { nodes, width: maxX * 2 + 40, height }
}

export default function MindMap({ subjectName, source }: { subjectName: string; source: string }) {
  const [tree, setTree] = useState<MindNode | null>(null)
  const [busy, setBusy] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set()) // collapsed branches
  const go = async () => {
    setBusy(true)
    try { setTree(await makeMindMap(subjectName, source)); setHidden(new Set()) } catch (e) { await notify("Couldn't build the mind map", (e as Error).message) }
    finally { setBusy(false) }
  }

  const shown = useMemo(() => {
    if (!tree) return null
    const prune = (n: MindNode, d: number): MindNode => ({ label: n.label, children: d === 1 && hidden.has(n.label) ? [] : n.children?.map(c => prune(c, d + 1)) })
    return { ...tree, children: tree.children?.map(c => prune(c, 1)) }
  }, [tree, hidden])
  const g = shown ? layout(shown) : null
  const cx = g ? g.width / 2 : 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <p className="muted text-sm flex-1">See how the whole topic fits together. Click a branch to fold it.</p>
        <button className="btn" onClick={go} disabled={busy || !source}>{busy ? <Thinking onAccent state="connecting" label="Mapping ideas…" /> : tree ? 'Rebuild' : 'Make mind map'}</button>
      </div>
      {g && <div className="overflow-auto rounded-xl bg-[var(--bg)] border border-[var(--line)]">
        <svg width={g.width} height={g.height} className="block mx-auto" role="img" aria-label={`Mind map of ${tree!.label}`}>
          {g.nodes.filter(n => n.parent).map((n, i) => {
            const p = n.parent!
            const x1 = cx + p.x + (p.depth === 0 ? n.side * p.w / 2 : n.side * p.w), y1 = p.y
            const x2 = cx + n.x, y2 = n.y
            const mx = (x1 + x2) / 2
            return <path key={i} d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={n.color} strokeWidth={n.depth === 1 ? 3 : 1.5} opacity={0.7} />
          })}
          {g.nodes.map((n, i) => {
            const x = n.depth === 0 ? cx - n.w / 2 : n.side === 1 ? cx + n.x : cx + n.x - n.w
            const isBranch = n.depth === 1
            const folded = isBranch && hidden.has(n.label)
            return (
              <g key={i} onClick={isBranch ? () => setHidden(h => { const s = new Set(h); s.has(n.label) ? s.delete(n.label) : s.add(n.label); return s }) : undefined}
                className={isBranch ? 'cursor-pointer' : ''}>
                <rect x={x} y={n.y - 13} width={n.w} height={26} rx={13}
                  fill={n.depth === 0 ? 'var(--text)' : n.depth === 1 ? n.color : 'var(--panel)'} stroke={n.depth > 1 ? n.color : 'none'} />
                <text x={x + n.w / 2} y={n.y + 4.5} textAnchor="middle" fontSize={n.depth === 0 ? 14 : 12.5} fontWeight={n.depth < 2 ? 600 : 400}
                  fill={n.depth === 0 ? 'var(--bg)' : n.depth === 1 ? '#fff' : 'var(--text)'}>{n.label}{folded ? ' ＋' : ''}</text>
              </g>
            )
          })}
        </svg>
      </div>}
    </div>
  )
}
