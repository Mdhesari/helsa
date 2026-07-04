import { mascotPoses, type MascotPose } from './mascot-poses'

interface MascotProps {
  pose?: MascotPose
  /** Rendered width/height in px. */
  size?: number
  className?: string
}

/**
 * The Helsa mascot. Artwork lives in `mascot-poses.tsx` (placeholder for the
 * design team's final SVGs, viewBox 0 0 200 200 per pose).
 */
export function Mascot({ pose = 'happy', size = 96, className }: MascotProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={`Helsa mascot (${pose})`}
      className={className}
    >
      {mascotPoses[pose]}
    </svg>
  )
}
