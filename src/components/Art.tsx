/** Generated 3D game art used inline in the UI (never emoji). */
export const ART = {
  flame: 'achievements/wildfire', gem: 'habits/gem', freeze: 'habits/freeze',
  level: 'achievements/sage', quests: 'achievements/quests', check: 'achievements/habits', perfect: 'achievements/perfectweek',
} as const
export type ArtName = keyof typeof ART
export const artUrl = (name: ArtName | string) => `${import.meta.env.BASE_URL}${(ART as Record<string, string>)[name] ?? name}.png`

export default function Art({ name, size = 18, className = '' }: { name: ArtName | string; size?: number; className?: string }) {
  return <img src={artUrl(name)} alt="" aria-hidden draggable={false}
    className={`inline-block object-contain shrink-0 select-none ${className}`} style={{ width: size, height: size }} />
}
