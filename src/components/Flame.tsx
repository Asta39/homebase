/** The generated 3D streak flame (same art as the Wildfire achievement). */
export default function Flame({ size = 18, className = '' }: { size?: number; className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}achievements/wildfire.png`} alt="" aria-hidden draggable={false}
    className={`inline-block object-contain shrink-0 select-none ${className}`} style={{ width: size, height: size }} />
}
