import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../lib/db'
import { DAILY_GOALS, FREEZE_PRICE, LEAGUES, MAX_FREEZES, TIER_NAMES, achDesc, gameState } from '../lib/gamify'
import { ymd } from '../lib/workout'
import { confirmBox, notify } from '../components/Dialog'
import Medal from '../components/Medal'
import Flame from '../components/Flame'
import Art from '../components/Art'
import Decor from '../components/Decor'

/** The game hub: streak, daily goal, league, gem shop, every achievement and recent XP. */
export default function Trophies() {
  const g = useLiveQuery(() => gameState(new Date()))
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  if (!g) return null

  const setGoal = (xp: number) => setSetting('dailyGoal', String(xp))
  const buyFreeze = async () => {
    if (g.freezes >= MAX_FREEZES) return notify('Already fully stocked', `You can hold up to ${MAX_FREEZES} streak freezes.`)
    if (g.gems < FREEZE_PRICE) return notify('Not enough gems', `A streak freeze costs ${FREEZE_PRICE} gems. Complete quests and unlock achievements to earn more.`)
    if (!(await confirmBox('Buy a streak freeze?', `Costs ${FREEZE_PRICE} gems. If you miss your goal one day, it's used automatically to keep your streak.`, 'Buy'))) return
    await db.rewards.add({ key: `buy:freeze:${Date.now()}`, date: ymd(new Date()), gems: -FREEZE_PRICE, xp: 0, label: 'Bought a streak freeze' })
    await setSetting('freezes', String(g.freezes + 1))
  }

  const goalPct = Math.min(1, g.xpToday / g.dailyGoal)
  const unlocked = g.achievements.filter(a => a.tier > 0).length
  const tiersEarned = g.achievements.reduce((t, a) => t + a.tier, 0)
  const sorted = [...g.achievements].sort((a, b) => (b.next ? (b.value - b.prev) / (b.next - b.prev) : -1) - (a.next ? (a.value - a.prev) / (a.next - a.prev) : -1))
  const maxXp = Math.max(g.dailyGoal, ...g.last7.map(d => d.xp))

  // month grid (Mon-first)
  const first = new Date(month), offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))]

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-end gap-3">
        <h1 className="text-2xl font-bold mr-auto">Trophies</h1>
        <span className="text-sm muted">{unlocked}/{g.achievements.length} achievements · {tiersEarned} tiers</span>
      </div>

      {/* ---------- headline stats ---------- */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <section className="glass relative p-5 overflow-hidden">
          <Decor item={0} corner="tr" size={64} rotate={12} />
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-500"><Flame size={16} /> Streak</div>
          <div className="flex items-center gap-2 mt-1"><Flame size={44} className={g.streak ? '' : 'grayscale opacity-50'} /><span className={`text-5xl font-black tabular-nums ${g.streak ? 'text-orange-500' : 'muted'}`}>{g.streak}</span><span className="muted">day{g.streak === 1 ? '' : 's'}</span></div>
          <div className="text-xs muted mt-1">Longest {g.longest} · {g.goalMet ? 'goal hit today' : 'hit your goal to extend'}</div>
        </section>
        <section className="glass p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-500"><Art name="gem" size={18} /> Gems</div>
          <div className="text-5xl font-black tabular-nums mt-1">{g.gems}</div>
          <div className="text-xs muted mt-1 flex items-center gap-1"><Art name="freeze" size={14} /> {g.freezes}/{MAX_FREEZES} streak freezes</div>
        </section>
        <section className="glass p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-500"><Art name="level" size={20} /> Level {g.level}</div>
          <div className="text-2xl font-bold mt-1">{g.title}</div>
          <div className="h-2 rounded-full bg-[var(--line)] mt-3 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${(g.into / g.need) * 100}%` }} /></div>
          <div className="text-xs muted mt-1 tabular-nums">{g.into} / {g.need} XP · {g.xp.toLocaleString()} total</div>
        </section>
        <section className="glass p-5">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: g.league.color }}><Art name="medal" size={20} /> {g.league.name} League</div>
          <div className="text-3xl font-bold tabular-nums mt-1">{g.thisWeekXp} <span className="text-base muted font-normal">XP this week</span></div>
          <div className="text-xs muted mt-1">{g.nextLeague ? `${Math.max(0, g.nextLeague.min - g.thisWeekXp)} more for ${g.nextLeague.name} next week` : 'Top division!'}</div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------- daily goal ---------- */}
        <section className="glass p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold"><Art name="target" size={24} /> Daily goal</div>
          <div className="flex items-center gap-4">
            <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90 shrink-0" aria-label={`${g.xpToday} of ${g.dailyGoal} XP`}>
              <circle cx="42" cy="42" r="34" fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle cx="42" cy="42" r="34" fill="none" stroke={g.goalMet ? '#22c55e' : '#f59e0b'} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={213.6} strokeDashoffset={213.6 * (1 - goalPct)} style={{ transition: 'stroke-dashoffset .8s' }} />
            </svg>
            <div><div className="text-3xl font-bold tabular-nums">{g.xpToday}<span className="text-base muted font-normal">/{g.dailyGoal} XP</span></div>
              <div className="text-sm muted">{g.goalMet ? 'Goal reached — streak safe' : `${g.dailyGoal - g.xpToday} XP to go today`}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DAILY_GOALS.map(d => (
              <button key={d.xp} onClick={() => setGoal(d.xp)} aria-pressed={g.dailyGoal === d.xp}
                className={`rounded-xl px-3 py-2 text-left border-2 transition ${g.dailyGoal === d.xp ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--line)] hover:border-[var(--accent)]/50'}`}>
                <div className="text-sm font-semibold">{d.label}</div><div className="text-xs muted">{d.xp} XP / day</div>
              </button>
            ))}
          </div>
          <details className="text-xs muted"><summary className="cursor-pointer">How to earn XP</summary>
            <ul className="mt-2 space-y-0.5">
              <li className="flex items-center gap-2"><Art name="tomato" size={20} />2 XP per focus minute</li><li className="flex items-center gap-2"><Art name="cards" size={20} />3 XP per flashcard</li><li className="flex items-center gap-2"><Art name="quiz" size={20} />10 XP per correct quiz answer</li><li className="flex items-center gap-2"><Art name="notes" size={20} />25 XP per past-paper answer</li><li className="flex items-center gap-2"><Art name="chart" size={20} />30 XP per topic moved up a colour</li><li className="flex items-center gap-2"><Art name="muscle" size={20} />5 XP per workout set</li><li className="flex items-center gap-2"><Art name="check" size={20} />10 XP per habit</li><li className="flex items-center gap-2"><Art name="water" size={20} />2 XP per glass</li><li className="flex items-center gap-2"><Art name="quests" size={20} />Quests give bonus XP + gems</li>
            </ul></details>
        </section>

        {/* ---------- streak calendar ---------- */}
        <section className="glass p-5">
          <div className="flex items-center mb-3">
            <div className="font-semibold mr-auto">{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
            <button className="w-8 h-8 rounded-full hover:bg-[var(--line)]" aria-label="Previous month" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><Art name="arrow" size={18} className="rotate-180 mx-auto" /></button>
            <button className="w-8 h-8 rounded-full hover:bg-[var(--line)]" aria-label="Next month" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><Art name="arrow" size={18} className="mx-auto" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] muted mb-1">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />
              const key = ymd(d), met = g.metDays.has(key), froze = g.frozenDays.has(key), isToday = key === g.today
              return (
                <div key={i} title={met ? 'Goal hit' : froze ? 'Saved by a freeze' : undefined}
                  className={`aspect-square rounded-lg grid place-items-center text-xs tabular-nums ${met ? 'bg-orange-500/20 font-bold' : froze ? 'bg-sky-400/30' : key < g.today ? 'muted' : ''} ${isToday ? 'ring-2 ring-[var(--accent)]' : ''}`}>
                  {met ? <Flame size={20} /> : froze ? <Art name="freeze" size={20} /> : d.getDate()}
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 text-xs muted mt-3"><span className="inline-flex items-center gap-1"><Flame size={14} /> goal hit</span><span className="inline-flex items-center gap-1"><Art name="freeze" size={14} /> freeze used</span></div>
        </section>

        {/* ---------- XP chart + shop ---------- */}
        <section className="glass p-5 space-y-5">
          <div>
            <div className="font-semibold mb-3">Last 7 days</div>
            <div className="flex items-end gap-2 h-28 relative">
              <div className="absolute inset-x-0 border-t border-dashed border-[var(--muted)] opacity-40" style={{ bottom: `${(g.dailyGoal / maxXp) * 100}%` }} />
              {g.last7.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end" title={`${d.xp} XP`}>
                  <div className={`w-full max-w-7 rounded-t-md ${d.xp >= g.dailyGoal ? 'bg-orange-500' : 'bg-amber-400/50'}`} style={{ height: `${(d.xp / maxXp) * 100}%`, minHeight: d.xp ? 3 : 0 }} />
                  <span className={`text-[10px] ${d.day === g.today ? 'font-bold' : 'muted'}`}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Shop</div>
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--line)]/60 p-3">
              <div className="w-11 h-11 rounded-xl grid place-items-center bg-sky-400/25"><Art name="freeze" size={34} /></div>
              <div className="flex-1 min-w-0"><div className="font-medium text-sm">Streak freeze</div><div className="text-xs muted">Saves your streak if you miss a day · have {g.freezes}/{MAX_FREEZES}</div></div>
              <button className="btn !px-3 text-sm whitespace-nowrap" onClick={buyFreeze} disabled={g.freezes >= MAX_FREEZES}><span className="inline-flex items-center gap-1">{FREEZE_PRICE}<Art name="gem" size={16} /></span></button>
            </div>
          </div>
        </section>
      </div>

      {/* ---------- leagues ladder ---------- */}
      <section className="glass p-5">
        <div className="font-semibold mb-3">Leagues <span className="muted font-normal text-sm">· your weekly XP decides next week's division</span></div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {LEAGUES.map(l => {
            const on = l.name === g.league.name
            return <div key={l.name} className={`shrink-0 rounded-2xl px-3 py-2 text-center min-w-20 border-2 ${on ? 'shadow-lg' : 'opacity-60'}`} style={{ borderColor: on ? l.color : 'transparent', background: on ? `${l.color}22` : 'var(--line)' }}>
              <Art name="medal" size={30} className="mx-auto" /><div className="text-xs font-semibold" style={{ color: on ? l.color : undefined }}>{l.name}</div><div className="text-[10px] muted">{l.min}+ XP</div>
            </div>
          })}
        </div>
      </section>

      {/* ---------- achievements ---------- */}
      <section className="glass p-5">
        <div className="font-semibold mb-4">Achievements</div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map(a => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl p-3 bg-[var(--line)]/40">
              <Medal a={a} size={60} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2"><span className="font-semibold truncate">{a.title}</span>
                  {a.tier > 0 && <span className="text-[11px] font-semibold muted">{TIER_NAMES[a.tier - 1]}</span>}</div>
                <div className="text-xs muted truncate">{achDesc(a)}</div>
                {a.next ? <>
                  <div className="h-1.5 rounded-full bg-[var(--line)] mt-2 overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(1, (a.value - a.prev) / (a.next - a.prev)) * 100}%` }} /></div>
                  <div className="text-[11px] muted mt-0.5 tabular-nums">{a.value} / {a.next} · next: {TIER_NAMES[a.tier]}</div>
                </> : <div className="text-[11px] font-semibold mt-1" style={{ color: '#c86bfa' }}><span className="inline-flex items-center gap-1"><Art name="star" size={14} />Legend — maxed out</span></div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
