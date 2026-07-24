import { useId } from 'react'

import { GroundShadow, IllustrationSvg, type IllustrationProps } from './base'

export type { IllustrationProps } from './base'

/* ---------------------------------- Flame ---------------------------------- */

export function FlameIllustration(props: IllustrationProps) {
  const id = useId()
  return (
    <IllustrationSvg {...props}>
      <defs>
        <radialGradient id={`${id}-body`} cx="50%" cy="72%" r="75%">
          <stop offset="0%" stopColor="#FFD9A0" />
          <stop offset="45%" stopColor="#F5A65B" />
          <stop offset="100%" stopColor="#E2703A" />
        </radialGradient>
        <radialGradient id={`${id}-core`} cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="#FFF3D6" />
          <stop offset="100%" stopColor="#FFCE7A" />
        </radialGradient>
      </defs>
      <GroundShadow />
      <path
        d="M50 8c3 14-8 20-14 30-5 9-7 16-4 25 4 12 15 19 18 19s14-7 18-19c3-9 1-16-4-25-4-7-9-11-10-19-6 5-8 8-4-11z"
        fill={`url(#${id}-body)`}
      />
      <path
        d="M50 40c1 8-6 11-8 17-2 5-2 10 1 15 2 5 6 8 7 8s5-3 7-8c3-5 3-10 1-15-2-6-9-9-8-17z"
        fill={`url(#${id}-core)`}
      />
      <ellipse cx="41" cy="34" rx="4" ry="9" fill="#FFFFFF" opacity="0.5" transform="rotate(14 41 34)" />
    </IllustrationSvg>
  )
}

/* ---------------------------------- Apple ---------------------------------- */

export function AppleIllustration(props: IllustrationProps) {
  const id = useId()
  return (
    <IllustrationSvg {...props}>
      <defs>
        <radialGradient id={`${id}-body`} cx="38%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#FF9B8A" />
          <stop offset="55%" stopColor="#EE6352" />
          <stop offset="100%" stopColor="#C63D3B" />
        </radialGradient>
        <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9BD77A" />
          <stop offset="100%" stopColor="#5CA345" />
        </linearGradient>
      </defs>
      <GroundShadow />
      <path
        d="M50 30c8-8 22-8 28 2 7 11 4 30-5 41-6 8-13 11-23 11s-17-3-23-11c-9-11-12-30-5-41 6-10 20-10 28-2z"
        fill={`url(#${id}-body)`}
      />
      <path
        d="M50 30c0-8 3-13 9-16"
        stroke="#7A4A2B"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M52 22c8-8 18-7 22-4-2 8-10 13-22 10 0-2 0-4 0-6z"
        fill={`url(#${id}-leaf)`}
      />
      <ellipse cx="36" cy="45" rx="6" ry="11" fill="#FFFFFF" opacity="0.45" transform="rotate(18 36 45)" />
    </IllustrationSvg>
  )
}

/* --------------------------------- Dumbbell --------------------------------- */

export function DumbbellIllustration(props: IllustrationProps) {
  const id = useId()
  return (
    <IllustrationSvg {...props}>
      <defs>
        <linearGradient id={`${id}-plate`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5A5A66" />
          <stop offset="50%" stopColor="#33333C" />
          <stop offset="100%" stopColor="#1D1D24" />
        </linearGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C6C6CF" />
          <stop offset="100%" stopColor="#8E8E96" />
        </linearGradient>
      </defs>
      <GroundShadow />
      <rect x="22" y="46" width="56" height="9" rx="4.5" fill={`url(#${id}-bar)`} />
      <rect x="10" y="28" width="14" height="45" rx="7" fill={`url(#${id}-plate)`} />
      <rect x="76" y="28" width="14" height="45" rx="7" fill={`url(#${id}-plate)`} />
      <rect x="24" y="34" width="9" height="33" rx="4.5" fill={`url(#${id}-plate)`} />
      <rect x="67" y="34" width="9" height="33" rx="4.5" fill={`url(#${id}-plate)`} />
      <rect x="12.5" y="31" width="4" height="16" rx="2" fill="#FFFFFF" opacity="0.28" />
      <rect x="78.5" y="31" width="4" height="16" rx="2" fill="#FFFFFF" opacity="0.28" />
      <rect x="26" y="47.5" width="20" height="2.6" rx="1.3" fill="#FFFFFF" opacity="0.5" />
    </IllustrationSvg>
  )
}

/* --------------------------------- Droplet --------------------------------- */

export function DropletIllustration(props: IllustrationProps) {
  const id = useId()
  return (
    <IllustrationSvg {...props}>
      <defs>
        <radialGradient id={`${id}-body`} cx="40%" cy="40%" r="80%">
          <stop offset="0%" stopColor="#9CC3FF" />
          <stop offset="55%" stopColor="#5B8DEF" />
          <stop offset="100%" stopColor="#3A63C4" />
        </radialGradient>
      </defs>
      <GroundShadow />
      <path
        d="M50 10c12 18 26 32 26 48 0 15-11 26-26 26S24 73 24 58c0-16 14-30 26-48z"
        fill={`url(#${id}-body)`}
      />
      <path
        d="M38 56c0 9 5 15 12 17"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <ellipse cx="40" cy="38" rx="4.5" ry="8" fill="#FFFFFF" opacity="0.55" transform="rotate(16 40 38)" />
    </IllustrationSvg>
  )
}

/* ----------------------------------- Moon ----------------------------------- */

export function MoonIllustration(props: IllustrationProps) {
  const id = useId()
  return (
    <IllustrationSvg {...props}>
      <defs>
        <radialGradient id={`${id}-body`} cx="40%" cy="35%" r="85%">
          <stop offset="0%" stopColor="#FFF3C9" />
          <stop offset="55%" stopColor="#F5D67B" />
          <stop offset="100%" stopColor="#DBA84A" />
        </radialGradient>
      </defs>
      <GroundShadow />
      <path
        d="M62 12c-19 3-32 19-32 38 0 21 17 36 36 35-9 8-22 11-34 7C15 86 6 69 9 51 12 30 32 13 54 14c3 0 6-1 8-2z"
        fill={`url(#${id}-body)`}
        transform="translate(8 2)"
      />
      <circle cx="44" cy="38" r="5" fill="#DBA84A" opacity="0.5" />
      <circle cx="54" cy="58" r="7" fill="#DBA84A" opacity="0.4" />
      <circle cx="38" cy="62" r="3.5" fill="#DBA84A" opacity="0.5" />
      <ellipse cx="35" cy="34" rx="4" ry="8" fill="#FFFFFF" opacity="0.55" transform="rotate(24 35 34)" />
      <circle cx="80" cy="20" r="2.6" fill="#F5D67B" />
      <circle cx="15" cy="28" r="2" fill="#F5D67B" />
    </IllustrationSvg>
  )
}

/* ---------------------------------- Lungs ---------------------------------- */

export function LungsIllustration(props: IllustrationProps) {
  const id = useId()
  return (
    <IllustrationSvg {...props}>
      <defs>
        <radialGradient id={`${id}-lobe`} cx="40%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#FFB9C4" />
          <stop offset="55%" stopColor="#F2808F" />
          <stop offset="100%" stopColor="#D45A6E" />
        </radialGradient>
        <linearGradient id={`${id}-trachea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCE1E5" />
          <stop offset="100%" stopColor="#F2A9B3" />
        </linearGradient>
      </defs>
      <GroundShadow />
      <path
        d="M43 34c-8-2-17 4-22 14-5 11-6 24-2 30 3 5 10 5 16 2 6-3 10-8 10-15V40c0-3-1-5-2-6z"
        fill={`url(#${id}-lobe)`}
      />
      <path
        d="M57 34c8-2 17 4 22 14 5 11 6 24 2 30-3 5-10 5-16 2-6-3-10-8-10-15V40c0-3 1-5 2-6z"
        fill={`url(#${id}-lobe)`}
      />
      <path
        d="M46 12h8v18c0 5 3 8 8 10M54 12v18c0 5-3 8-8 10"
        stroke={`url(#${id}-trachea)`}
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="31" cy="47" rx="4" ry="8" fill="#FFFFFF" opacity="0.45" transform="rotate(14 31 47)" />
      <ellipse cx="69" cy="47" rx="4" ry="8" fill="#FFFFFF" opacity="0.45" transform="rotate(-14 69 47)" />
    </IllustrationSvg>
  )
}

/* ---------------------------------- Trophy ---------------------------------- */

export function TrophyIllustration(props: IllustrationProps) {
  const id = useId()
  return (
    <IllustrationSvg {...props}>
      <defs>
        <radialGradient id={`${id}-cup`} cx="40%" cy="25%" r="90%">
          <stop offset="0%" stopColor="#FFE9B8" />
          <stop offset="50%" stopColor="#F0BC5E" />
          <stop offset="100%" stopColor="#CE8B2D" />
        </radialGradient>
        <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B97930" />
          <stop offset="100%" stopColor="#8F5A20" />
        </linearGradient>
      </defs>
      <GroundShadow />
      <path
        d="M30 16h40v18c0 15-8 25-20 25S30 49 30 34V16z"
        fill={`url(#${id}-cup)`}
      />
      <path
        d="M30 22h-8c-4 0-6 3-5 7 2 9 8 15 16 17M70 22h8c4 0 6 3 5 7-2 9-8 15-16 17"
        stroke={`url(#${id}-cup)`}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="45" y="58" width="10" height="10" fill={`url(#${id}-base)`} />
      <path d="M36 68h28l3 10H33l3-10z" fill={`url(#${id}-base)`} />
      <rect x="33" y="78" width="34" height="6" rx="3" fill={`url(#${id}-base)`} />
      <ellipse cx="39" cy="27" rx="3.5" ry="8" fill="#FFFFFF" opacity="0.55" transform="rotate(8 39 27)" />
      <path d="M50 26l2.4 5 5.6.7-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.7z" fill="#FFFFFF" opacity="0.85" />
    </IllustrationSvg>
  )
}

/* ---------------------------------- Scale ---------------------------------- */

export function ScaleIllustration(props: IllustrationProps) {
  const id = useId()
  return (
    <IllustrationSvg {...props}>
      <defs>
        <radialGradient id={`${id}-body`} cx="40%" cy="30%" r="90%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#E9E9EF" />
          <stop offset="100%" stopColor="#C9C9D4" />
        </radialGradient>
        <radialGradient id={`${id}-dial`} cx="45%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#FDF2E7" />
          <stop offset="100%" stopColor="#E8A87C" />
        </radialGradient>
      </defs>
      <GroundShadow />
      <rect x="18" y="22" width="64" height="60" rx="16" fill={`url(#${id}-body)`} />
      <path
        d="M34 36a22 22 0 0 1 32 0l-7 8a12 12 0 0 0-18 0z"
        fill={`url(#${id}-dial)`}
      />
      <path d="M50 44l4-7" stroke="#16161A" strokeWidth="3" strokeLinecap="round" />
      <rect x="30" y="58" width="40" height="12" rx="6" fill="#FFFFFF" opacity="0.7" />
      <ellipse cx="30" cy="30" rx="4" ry="7" fill="#FFFFFF" opacity="0.8" transform="rotate(24 30 30)" />
    </IllustrationSvg>
  )
}

/* -------------------------- Mood faces (diary 1–5) -------------------------- */

const MOOD_COLORS: readonly [string, string][] = [
  ['#9CA5B4', '#6B7484'], // 1 — awful (gray-blue)
  ['#9FB8E8', '#5B8DEF'], // 2 — low (blue)
  ['#F5D67B', '#DBA84A'], // 3 — okay (yellow)
  ['#FFC48A', '#E8A87C'], // 4 — good (peach)
  ['#9BD77A', '#5CA345'], // 5 — great (green)
]

/** Gradient sticker face for mood/energy level 1–5. */
export function MoodFace({
  level,
  size = 40,
  className,
  title,
}: IllustrationProps & { level: 1 | 2 | 3 | 4 | 5 }) {
  const id = useId()
  const [light, dark] = MOOD_COLORS[level - 1]
  // Mouth path per level: frown → flat → smile → grin.
  const mouths = [
    'M34 68 Q50 56 66 68', // deep frown
    'M35 66 Q50 60 65 66', // frown
    'M35 64 L65 64', // flat
    'M35 62 Q50 72 65 62', // smile
    'M33 60 Q50 78 67 60', // grin
  ]
  return (
    <IllustrationSvg size={size} className={className} title={title}>
      <defs>
        <radialGradient id={`${id}-face`} cx="38%" cy="32%" r="85%">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="40" fill={`url(#${id}-face)`} />
      <ellipse cx="36" cy="30" rx="6" ry="10" fill="#FFFFFF" opacity="0.4" transform="rotate(20 36 30)" />
      <circle cx="38" cy="44" r="4.5" fill="#16161A" />
      <circle cx="62" cy="44" r="4.5" fill="#16161A" />
      <path
        d={mouths[level - 1]}
        stroke="#16161A"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
    </IllustrationSvg>
  )
}
