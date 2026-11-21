import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BorderBeam } from 'border-beam'
import { useMode } from "../lib/theme"
import { ChevronRight, Sparkles, Trophy, CalendarClock, GraduationCap, Layers, Flame } from 'lucide-react'
import { db } from '../lib/db'
import { ymd as iso } from '../lib/workout' // local date, not UTC
import { achDesc, gameState, type Ring } from '../lib/gamify'
import { celebrate } from '../lib/celebrate'
import ActivityRings from '../components/ActivityRings'
import WeatherCard from '../components/WeatherCard'
import TodayWorkout from '../components/TodayWorkout'
import CheckIn from '../components/CheckIn'
import Decor from "../components/Decor"
import Medal from "../components/Medal"

const greet = (h: number) => (h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`)

/** Home: the fridge-screen dashboard. Rings, quests and XP make the day's progress visible at a glance. */
export default function Dashboard() {
  const { resolved } = useMode()
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t) }, [])
  const today = iso(now)

  const name = useLiveQuery(() => db.settings.get('name').then(s => s?.value ?? '')) ?? ''
  const events = useLiveQuery(() => db.events.where('start').startsWith(today).sortBy('start'), [today]) ?? []
  const meals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today]) ?? []
  const due = useLiveQuery(() => db.flashcards.where('due').belowOrEqual(new Date().toISOString()).count()) ?? 0
  const subjects = useLiveQuery(() => db.subjects.toArray()) ?? []
  const red = useLiveQuery(() => db.topics.where('rating').equals('red').count()) ?? 0
  const recap = useLiveQuery(() => db.confusions.filter(c => !c.resolved).count()) ?? 0
  const game = useLiveQuery(() => gameState(new Date()), [today])

  const happening = events.find(e => !e.allDay && e.end && new Date(e.start) <= now && new Date(e.end) > now)
  const upcomingExams = subjects.filter(s => s.examDate && s.examDate >= today).sort((a, b) => a.examDate!.localeCompare(b.examDate!))
  const nextExam = upcomingExams[0]
  const days = nextExam ? Math.max(0, Math.round((+new Date(nextExam.examDate + 'T00:00') - +new Date(today + 'T00:00')) / 864e5)) : null
  const colorOf = (id?: number) => subjects.find(s => s.id === id)?.color ?? '#8e8e93'
  const isWeekend = now.getDay() === 0 || now.getDay() === 6

  useCelebrations(game?.rings, game?.level, today)

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-6 xl:grid-cols-12">
        {/* ---------- Hero: time, greeting, level ---------- */}
        <section className="glass relative p-7 md:col-span-6 xl:col-span-7 flex flex-col justify-between min-h-56">
          <Decor item={0} corner="tr" size={92} rotate={14} />
          <Decor item={10} corner="bm" size={54} rotate={-10} />
          <div>
            <div className="eyebrow">{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div className="text-[clamp(56px,8vw,96px)] leading-none font-semibold tracking-tight tabular-nums mt-2">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-2xl font-semibold mt-2">{greet(now.getHours())}{name ? `, ${name}` : ''}</div>
          </div>
          {game && <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link to="/trophies" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold ${game.streak ? 'bg-orange-500 text-white' : 'bg-[var(--line)] muted'}`} title="Day streak">
                🔥 {game.streak}<span className="font-medium opacity-90">day{game.streak === 1 ? '' : 's'}</span></Link>
              <Link to="/trophies" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold bg-sky-500/15 text-sky-500" title="Gems">💎 {game.gems}</Link>
              {game.freezes > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-sky-400/15 text-xs" title="Streak freezes">❄️ {game.freezes}</span>}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold" style={{ background: `${game.league.color}26`, color: `color-mix(in srgb, ${game.league.color} 70%, var(--text))` }}>🏅 {game.league.name}</span>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{game.goalMet ? 'Daily goal reached ✓' : 'Daily goal'}</span>
                <span className="ml-auto muted tabular-nums">{game.xpToday} / {game.dailyGoal} XP</span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--line)] mt-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${game.goalMet ? 'bg-green-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} style={{ width: `${Math.min(1, game.xpToday / game.dailyGoal) * 100}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs muted">
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--text)]"><Sparkles size={12} /> Level {game.level}</span>
              <span>{game.title}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(game.into / game.need) * 100}%` }} /></div>
              <span className="tabular-nums">{game.into}/{game.need}</span>
            </div>
          </div>}
        </section>

        {/* ---------- Activity rings ---------- */}
        <section className="glass relative p-6 md:col-span-6 xl:col-span-5 flex items-center gap-6">
          <Decor item={1} corner="bl" size={74} rotate={-14} />
          {game && <ActivityRings rings={game.rings} size={176} stroke={20} />}
          <div className="flex-1 space-y-3 min-w-0">
            <div className="eyebrow">Today’s rings</div>
            {game?.rings.map(r => <RingRow key={r.key} r={r} />)}
          </div>
        </section>

        {/* ---------- Agenda ---------- */}
        <div className="md:col-span-6 xl:col-span-5 flex">
          <BorderBeam theme={resolved} size="line" colorVariant="ocean" strength={0.7} active={!!happening} className="flex-1 flex" style={{ display: "flex" }}>
            <section className="glass relative p-6 flex-1 flex flex-col min-w-0">
              <Decor item={6} corner="br" size={66} rotate={10} />
              <div className="flex items-center mb-4"><CalendarClock size={18} className="mr-2 text-[var(--accent)]" /><h2 className="font-semibold">Today</h2>
                <Link to="/calendar" className="ml-auto text-sm text-[var(--accent)] flex items-center">Calendar <ChevronRight size={16} /></Link></div>
              {events.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-2">
                  <div className="text-4xl">🌤️</div>
                  <div className="font-medium">A free day</div>
                  <div className="text-sm muted">Nothing on the calendar yet.</div>
                  <Link to="/planner" className="mt-1 text-sm font-medium px-3 py-1.5 rounded-full bg-[var(--line)] hover:bg-[var(--accent)] hover:text-white transition">Plan some study</Link>
                </div>
              ) : (
                <ol className="relative space-y-3 before:absolute before:left-[54px] before:top-1 before:bottom-1 before:w-px before:bg-[var(--line)]">
                  {events.slice(0, 6).map(e => {
                    const past = !e.allDay && e.end && new Date(e.end) < now
                    return (
                      <li key={e.id} className={`flex items-center gap-3 ${past ? 'opacity-45' : ''}`}>
                        <span className="w-11 text-right text-sm muted tabular-nums shrink-0">{e.allDay ? 'All day' : e.start.slice(11, 16)}</span>
                        <span className="relative z-10 w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-[var(--glass)]" style={{ background: colorOf(e.subjectId) }} />
                        <span className={`truncate ${e === happening ? 'font-semibold' : ''}`}>{e.title}</span>
                        {e === happening && <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)] text-white">NOW</span>}
                      </li>
                    )
                  })}
                  {events.length > 6 && <li className="muted text-sm pl-16">+{events.length - 6} more</li>}
                </ol>
              )}
            </section>
          </BorderBeam>
        </div>

        {/* ---------- Daily quests ---------- */}
        <section className="glass relative p-6 md:col-span-3 xl:col-span-4">
          <div className="flex items-center mb-4"><Trophy size={18} className="mr-2 text-amber-500" /><h2 className="font-semibold">Daily quests</h2>
          <Decor item={3} corner="tl" size={60} rotate={-14} />
            {game && <span className="ml-auto text-sm muted tabular-nums">{game.quests.filter(q => q.done).length}/3</span>}</div>
          <div className="space-y-3">
            {game?.quests.map(q => (
              <Link key={q.id} to={q.to} className="flex items-center gap-3 group">
                <span className={`w-9 h-9 rounded-xl grid place-items-center text-lg shrink-0 ${q.done ? 'bg-green-500/20' : 'bg-[var(--line)]'}`}>{q.done ? '✅' : q.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm truncate ${q.done ? 'line-through muted' : 'font-medium'}`}>{q.title}</span>
                  <span className="block h-1.5 rounded-full bg-[var(--line)] mt-1.5 overflow-hidden">
                    <span className={`block h-full rounded-full transition-all duration-700 ${q.done ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(1, q.progress / q.goal) * 100}%` }} />
                  </span>
                </span>
                <span className={`text-xs font-semibold tabular-nums ${q.done ? 'text-green-500' : 'muted'}`}>+{q.xp}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- Exam countdown ---------- */}
        <section className="glass relative p-6 md:col-span-3 xl:col-span-3 flex flex-col">
          <Decor item={2} corner="tr" size={60} rotate={18} />
          <div className="flex items-center"><GraduationCap size={18} className="mr-2 text-orange-500" /><h2 className="font-semibold">Next exam</h2></div>
          {nextExam ? <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-7xl font-bold tracking-tight grad-text tabular-nums leading-none">{days}</span>
              <span className="text-lg muted">{days === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="mt-1 font-medium flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: nextExam.color }} />{nextExam.name}</div>
            <div className="mt-auto pt-3 space-y-1">
              {upcomingExams.slice(1, 4).map(s => (
                <div key={s.id} className="flex text-sm muted"><span className="truncate">{s.name}</span>
                  <span className="ml-auto tabular-nums">{Math.round((+new Date(s.examDate + 'T00:00') - +new Date(today + 'T00:00')) / 864e5)}d</span></div>
              ))}
            </div>
          </> : <Link to="/study" className="mt-3 text-sm text-[var(--accent)]">Add exam dates →</Link>}
        </section>

        {/* ---------- Study snapshot ---------- */}
        <section className="glass relative p-6 md:col-span-3 xl:col-span-4">
          <Decor item={7} corner="tl" size={58} rotate={-20} />
          <div className="flex items-center mb-4"><Layers size={18} className="mr-2 text-[var(--accent)]" /><h2 className="font-semibold">Study</h2>
            <Link to="/study" className="ml-auto text-sm text-[var(--accent)] flex items-center">Subjects <ChevronRight size={16} /></Link></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat value={due} label="cards due" tone={due ? 'text-[var(--accent)]' : ''} />
            <Stat value={red} label="red topics" tone={red ? 'text-red-500' : ''} />
            <Stat value={game ? fmtMin(game.focusToday) : '–'} label="focused" />
          </div>
          {(isWeekend && recap > 0) && <Link to="/study" className="mt-4 flex items-center gap-2 text-sm rounded-xl bg-[var(--accent)]/10 px-3 py-2">🧠 {recap} thing{recap === 1 ? '' : 's'} to recap this weekend <ChevronRight size={14} className="ml-auto" /></Link>}
          {(isWeekend || now.getDay() === 1) && <Link to={now.getDay() === 1 ? '/report?last=1' : '/report'} className="mt-2 flex items-center gap-2 text-sm rounded-xl bg-orange-500/10 px-3 py-2">📊 {now.getDay() === 1 ? 'Last week’s' : 'This week’s'} report is ready <ChevronRight size={14} className="ml-auto" /></Link>}
        </section>

        <section className="glass relative p-6 md:col-span-3 xl:col-span-4"><Decor item={5} corner="bl" size={70} rotate={-12} /><TodayWorkout compact /></section>
        <WeatherCard className="glass p-6 md:col-span-3 xl:col-span-4" />

        <section className="glass relative p-6 md:col-span-6 xl:col-span-8"><Decor item={8} corner="tm" size={58} rotate={12} /><CheckIn compact /></section>
        <section className="glass relative p-6 md:col-span-6 xl:col-span-4">
          <Decor item={9} corner="br" size={60} rotate={-8} />
          <div className="flex items-center mb-3"><h2 className="font-semibold">Meals</h2>
            <Link to="/meals" className="ml-auto text-sm text-[var(--accent)] flex items-center">Plan <ChevronRight size={16} /></Link></div>
          {(['breakfast', 'lunch', 'dinner'] as const).map(slot => {
            const m = meals.find(x => x.slot === slot)
            return <div key={slot} className="flex py-1.5 border-b border-[var(--line)] last:border-0 text-sm">
              <span className="muted capitalize w-24">{slot}</span><span className={m ? 'font-medium' : 'muted'}>{m?.name ?? '—'}</span></div>
          })}
        </section>

        {/* ---------- Achievements ---------- */}
        {game && <section className="glass relative p-6 md:col-span-6 xl:col-span-12">
          <Decor item={4} corner="tr" size={92} rotate={8} />
          <Decor item={11} corner="bl" size={62} rotate={-16} />
          <div className="flex items-center mb-4"><Flame size={18} className="mr-2 text-orange-500" /><h2 className="font-semibold">Achievements</h2>
            <span className="ml-3 text-sm muted hidden sm:inline">{game.achievements.filter(a => a.tier).length} of {game.achievements.length} unlocked · {game.xp.toLocaleString()} XP total</span>
            <Link to="/trophies" className="ml-auto text-sm text-[var(--accent)] flex items-center">All trophies <ChevronRight size={16} /></Link></div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
            {[...game.achievements].sort((x, y) => (y.next ? (y.value - y.prev) / (y.next - y.prev) + y.tier : -1) - (x.next ? (x.value - x.prev) / (x.next - x.prev) + x.tier : -1)).slice(0, 9).map(a => (
              <Link to="/trophies" key={a.id} title={`${a.title}: ${achDesc(a)}`} className="flex flex-col items-center text-center gap-1.5">
                <Medal a={a} size={60} />
                <div className={`text-xs font-medium leading-tight ${a.tier ? '' : 'muted'}`}>{a.title}</div>
                <div className="text-[10px] muted tabular-nums">{a.next ? `${a.value}/${a.next}` : 'Legend ★'}</div>
              </Link>
            ))}
          </div>
        </section>}
      </div>
    </div>
  )
}

function RingRow({ r }: { r: Ring }) {
  const done = r.pct >= 1
  return (
    <div>
      {/* Mix toward the text colour so lime/cyan stay readable on light glass, and still glow on dark */}
      <div className="text-sm font-semibold" style={{ color: `color-mix(in srgb, ${r.colors[0]} 55%, var(--text))` }}>{r.label}{done && ' ✓'}</div>
      <div className="text-xl font-semibold tabular-nums leading-tight">
        {r.key === 'move' && r.unit === 'rest day' ? <span className="text-base">Rest day 😌</span>
          : r.key === 'mind' ? <>{r.value}<span className="text-sm muted">%</span></>
          : <>{r.value}<span className="text-sm muted">/{r.goal} {r.unit}</span></>}
      </div>
    </div>
  )
}

function Stat({ value, label, tone = '' }: { value: React.ReactNode; label: string; tone?: string }) {
  return <div className="rounded-2xl bg-[var(--line)]/50 py-3"><div className={`text-3xl font-bold tabular-nums ${tone}`}>{value}</div><div className="text-xs muted mt-0.5">{label}</div></div>
}

/** Confetti when a ring closes or she levels up — once per ring per day, remembered across reloads. */
function useCelebrations(rings: Ring[] | undefined, level: number | undefined, today: string) {
  const first = useRef(true)
  useEffect(() => {
    if (!rings || level == null) return
    const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
    const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }
    const key = `homebase.rings.${today}`
    const closed = new Set((read(key) ?? '').split(',').filter(Boolean))
    const newlyClosed = rings.filter(r => r.pct >= 1 && r.unit !== 'rest day' && !closed.has(r.key))
    // On first load just record state (no confetti for things done earlier)
    if (!first.current) {
      if (newlyClosed.length) celebrate(`${newlyClosed[0].label} ring closed!`, newlyClosed[0].colors)
    }
    first.current = false
    newlyClosed.forEach(r => closed.add(r.key))
    write(key, [...closed].join(',')); write('homebase.level', String(level))
  }, [rings, level, today])
}
