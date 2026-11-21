import { useTheme } from '../lib/theme'

/**
 * Backdrop behind the whole app.
 * Classic: the warm orange sunset glow (light: peach & terracotta, dark: rust embers).
 * Themes: their image wallpaper under a soft scrim so the glass cards stay readable.
 */
export default function Wallpaper() {
  const theme = useTheme()
  if (theme.wall) return <div className="wall wall-image" style={{ backgroundImage: `url(${theme.wall})` }} aria-hidden />
  return <div className="wall wall-evening" aria-hidden />
}
