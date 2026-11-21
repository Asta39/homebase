import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, type Reward } from '../lib/db'
import { gameState, TIER_GEMS, TIER_NAMES, type GameState } from '../lib/gamify'
import { ymd } from '../lib/workout'
import { celebrate } from '../lib/celebrate'
import { STREAK_MILESTONES, HABIT_LEVELS } from '../lib/habits'

const GEMS = { quest: 5, allQuests: 10, level: 20 }

/**
 * Runs on every screen (renders nothing). Whenever progress changes it:
 *  - pays gems/XP for finished quests, level-ups and new achievement tiers — each exactly once (unique reward keys)
 *  - spends a streak freeze for any missed day since it last looked, if that day would have broken a streak
 *  - celebrates the single most exciting new thing
 * The very first run credits existing progress silently (no pop-up flood).
 */
export default function GameEngine() {
  const now = useMinuteTick()
  const game = useLiveQuery(() => gameState(new Date()), [now])
  const busy = useRef(false)
  const latest = useRef<GameState | undefined>(undefined)

  useEffect(() => {
    latest.current = game
    if (!game || busy.current) return // a run is in progress; it will pick up `latest` when it finishes
    busy.current = true
    const run = async () => {
      let handled: GameState | undefined
      // Keep going until we've processed the newest state (progress can arrive while we're saving awards)
      while (latest.current && latest.current !== handled) { handled = latest.current; await award(handled) }
      busy.current = false
    }
    run().catch(() => { busy.current = false })
  }, [game])

  return null
}

async function award(g: GameState) {
  const firstRun = !(await getSetting('gameInit'))
  const have = new Set((await db.rewards.toArray()).map(r => r.key))
  const fresh: Reward[] = []
  const give = (key: string, gems: number, xp: number, label: string) => { if (!have.has(key)) { fresh.push({ key, date: g.today, gems, xp, label }); have.add(key) } }

  g.quests.filter(q => q.done).forEach(q => give(`quest:${g.today}:${q.id}`, GEMS.quest, q.xp, `Quest: ${q.title}`))
  if (g.quests.every(q => q.done)) give(`allquests:${g.today}`, GEMS.allQuests, 0, 'All daily quests done')
  for (let l = 2; l <= g.level; l++) give(`level:${l}`, GEMS.level, 0, `Reached level ${l}`)
  g.achievements.forEach(a => { for (let t = 1; t <= a.tier; t++) give(`tier:${a.id}:${t}`, TIER_GEMS[t - 1], 0, `${a.title} · ${TIER_NAMES[t - 1]}`) })
  // Habits: streak milestones (gems), growth stages, and a perfect habit day
  g.habitStatList.forEach(h => {
    STREAK_MILESTONES.filter(m => h.streak >= m.days).forEach(m => give(`hstreak:${h.habit.id}:${m.days}`, m.gems, 0, `${h.habit.icon} ${h.habit.name} · ${m.days}-day streak`))
    for (let i = 1; i <= h.level.index; i++) give(`hlevel:${h.habit.id}:${i}`, 5, 0, `${h.habit.icon} ${h.habit.name} grew into a ${HABIT_LEVELS[i].name} ${HABIT_LEVELS[i].icon}`)
  })
  const dueToday = g.habitStatList.filter(h => h.dueToday)
  if (dueToday.length >= 2 && dueToday.every(h => h.doneToday)) give(`hperfect:${g.today}`, 5, 0, 'Perfect habit day')
  if (g.goalMet) give(`streak:${g.today}`, 0, 0, `Daily goal hit · ${g.streak}-day streak`)

  // Streak freezes: look at each missed day since the last check (never today — it isn't over)
  const lastChecked = (await getSetting('freezeChecked')) || ymd(new Date(Date.now() - 864e5 * 2))
  let freezes = g.freezes
  const usedOn: string[] = []
  const yesterday = ymd(new Date(Date.now() - 864e5))
  for (let d = new Date(lastChecked + 'T00:00'); ymd(d) <= yesterday; d.setDate(d.getDate() + 1)) {
    const day = ymd(d), before = ymd(new Date(d.getTime() - 864e5))
    const kept = (x: string) => g.metDays.has(x) || g.frozenDays.has(x) || usedOn.includes(x)
    if (day <= lastChecked || kept(day)) continue
    if (freezes > 0 && kept(before)) { usedOn.push(day); freezes-- }
  }
  if (usedOn.length) {
    await db.freezeLog.bulkPut(usedOn.map(date => ({ date })))
    await setSetting('freezes', String(freezes))
  }
  await setSetting('freezeChecked', yesterday)

  if (fresh.length) await db.rewards.bulkAdd(fresh)
  if (firstRun) { await setSetting('gameInit', '1'); return }

  // One celebration per update, most exciting first
  const tier = fresh.filter(r => r.key.startsWith('tier:')).at(-1)
  const level = fresh.filter(r => r.key.startsWith('level:')).at(-1)
  const streak = fresh.find(r => r.key.startsWith('streak:'))
  const allQ = fresh.find(r => r.key.startsWith('allquests:'))
  const quest = fresh.find(r => r.key.startsWith('quest:'))
  const hStreak = fresh.filter(r => r.key.startsWith('hstreak:')).at(-1)
  const hLevel = fresh.filter(r => r.key.startsWith('hlevel:')).at(-1)
  const hPerfect = fresh.find(r => r.key.startsWith('hperfect:'))
  const gems = fresh.reduce((t, r) => t + r.gems, 0)
  if (usedOn.length) celebrate(`❄️ Streak freeze saved your ${g.streak}-day streak!`, ['#7dd3fc', '#bae6fd', '#ffffff'])
  else if (tier) celebrate(`🏅 ${tier.label} unlocked · +${gems} 💎`, ['#f2b632', '#c86bfa', '#7aa7ff'])
  else if (level) celebrate(`⭐ Level ${level.key.split(':')[1]}! +${gems} 💎`, ['#f59e0b', '#f97316', '#84cc16'])
  else if (streak) celebrate(`🔥 ${g.streak} day streak! Daily goal hit`, ['#ff9500', '#ff3b30', '#ffcc00'])
  else if (hStreak) celebrate(`🔥 ${hStreak.label}! +${gems} 💎`, ['#ff9500', '#ffcc00', '#ff2d55'])
  else if (hLevel) celebrate(`${hLevel.label} · +${gems} 💎`, ['#34c759', '#a4ff00', '#ffcc00'])
  else if (allQ) celebrate(`🏆 All quests done! +${gems} 💎`, ['#f59e0b', '#10b981', '#3b82f6'])
  else if (hPerfect) celebrate(`🌟 Perfect habit day! +${gems} 💎`, ['#34c759', '#ff9500'])
  else if (quest) celebrate(`✅ ${quest.label.replace('Quest: ', '')} · +${quest.xp} XP +${gems} 💎`, ['#10b981', '#f59e0b'])
}

/** Re-evaluate at least once a minute so day changes (midnight, freezes) are noticed even if nothing is clicked. */
function useMinuteTick() {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setT(Date.now()), 60_000); return () => clearInterval(id) }, [])
  return t
}
