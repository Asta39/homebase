import { HABIT_ICONS, iconFor } from '../lib/habits'

/** Generated 3D habit art (public/habits). `name` is a habit icon key, stage-N, gem, or any legacy value. */
export default function HabitIcon({ name, size = 24, className = '', habitName }: { name: string; size?: number; className?: string; habitName?: string }) {
  const key = name.startsWith('stage-') || name === 'gem' ? name : iconFor(name, habitName)
  return <img src={`${import.meta.env.BASE_URL}habits/${key}.png`} width={size} height={size} alt="" draggable={false}
    className={`object-contain select-none shrink-0 ${className}`} style={{ width: size, height: size }} />
}

export { HABIT_ICONS }
