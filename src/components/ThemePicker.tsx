import { THEMES, setMode, setTheme, useMode, useTheme, type Mode } from '../lib/theme'
import Art from './Art'

/** Three big preview tiles. Classic shows the live warm gradient; the others show their wallpaper + a few cut-outs. */
export default function ThemePicker({ bare = false }: { bare?: boolean }) {
  const active = useTheme()
  const { mode } = useMode()
  const MODES: { id: Mode; label: string; icon: string; hint: string }[] = [
    { id: 'auto', label: 'Auto', icon: 'monitor', hint: active.darkByDefault ? `${active.name} looks best dark` : 'Follows Windows' },
    { id: 'light', label: 'Light', icon: 'sun', hint: '' },
    { id: 'dark', label: 'Dark', icon: 'moon', hint: '' },
  ]
  return (
    <section className={bare ? 'space-y-3' : 'panel p-5 space-y-3'}>
      {!bare && <div>
        <h2 className="font-semibold">Theme</h2>
        <p className="muted text-sm">Classic for focus, or something more fun. Changes the wallpaper, accent colour and little details on cards.</p>
      </div>}
      <div className={`grid gap-3 ${bare ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {THEMES.map(t => {
          const on = t.id === active.id
          const d = Object.values(t.decos)
          return (
            <button key={t.id} onClick={() => setTheme(t.id)} aria-pressed={on}
              className={`relative text-left rounded-2xl overflow-hidden border-2 transition ${on ? 'border-[var(--accent)] shadow-lg' : 'border-transparent hover:border-[var(--line)]'}`}>
              <div className={`h-28 bg-cover bg-center relative ${t.id === 'classic' ? 'welcome-sunset' : ''}`}
                style={t.preview ? { backgroundImage: `url(${t.preview})` } : undefined}>
                {t.id === 'classic' && <div className="absolute inset-4 rounded-xl bg-[var(--glass)] backdrop-blur" />}
                {d.slice(0, 3).map((x, i) => (
                  <img key={x.src} src={x.src} alt="" className="absolute w-14 h-14 drop-shadow-lg"
                    style={{ right: 8 + i * 34, bottom: i % 2 ? 26 : 6, rotate: `${(i - 1) * 14}deg` }} />
                ))}
              </div>
              <div className="p-3 bg-[var(--glass)]">
                <div className="font-semibold flex items-center gap-1.5">{t.name}{on && <Art name="check" size={18} />}</div>
                <div className="text-xs muted">{t.tagline}</div>
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span className="text-sm font-medium">Appearance</span>
        <div className="inline-flex rounded-full p-1 bg-[var(--line)]" role="radiogroup" aria-label="Light or dark mode">
          {MODES.map(m => {
            const on = m.id === mode
            return (
              <button key={m.id} role="radio" aria-checked={on} onClick={() => setMode(m.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm transition ${on ? 'bg-[var(--glass)] shadow font-semibold' : 'muted hover:text-[var(--text)]'}`}>
                <Art name={m.icon} size={18} />{m.label}
              </button>
            )
          })}
        </div>
        {mode === 'auto' && <span className="text-xs muted">{MODES[0].hint}</span>}
      </div>
    </section>
  )
}
