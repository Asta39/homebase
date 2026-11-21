import { ThinkingOrb } from 'thinking-orbs'

export type OrbState = 'working' | 'searching' | 'solving' | 'listening' | 'connecting' | 'weaving' | 'composing' | 'breathing' | 'shaping'

/**
 * One consistent "AI is working" indicator (libraries.dev thinking-orbs).
 * Pick the verb that matches the job: searching notes, solving/marking, composing text, connecting ideas…
 * onAccent: inside a blue button → light dots.
 */
export default function Thinking({ label, state = 'working', size = 20, onAccent = false, className = '' }:
  { label?: string; state?: OrbState; size?: 20 | 64; onAccent?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 align-middle ${className}`} role="status">
      <ThinkingOrb state={state} size={size} theme={onAccent ? 'dark' : 'auto'} aria-label={label ?? 'Working'} />
      {label && <span>{label}</span>}
    </span>
  )
}
