/**
 * Canonical mascot artwork — "Pip" the sprout, from /design/mascot-*.svg.
 *
 * Each entry is the *inner content* of an `<svg viewBox="0 0 200 200">`
 * element (the <Mascot/> component supplies the svg element and accessible
 * label). To restyle the character, regenerate from the SVGs in /design/.
 */
import type { ReactElement } from 'react'

export type MascotPose = 'happy' | 'cheer' | 'sleep' | 'think'

/** Shared body: sprout + blob + belly + feet (byte-identical across poses). */
function Body() {
  return (
    <g>
      {/* sprout */}
      <path d="M97 60 C 90 42 74 32 56 34 C 58 52 74 62 94 60 Z" fill="#2e6b04" />
      <path d="M103 58 C 106 36 124 22 146 26 C 144 48 126 60 105 60 Z" fill="#46a302" />
      <rect x="96" y="48" width="8" height="26" rx="4" fill="#2e6b04" />
      {/* body */}
      <ellipse cx="100" cy="124" rx="62" ry="56" fill="#58cc02" />
      <ellipse cx="100" cy="152" rx="34" ry="22" fill="#ddf6c2" />
      {/* feet */}
      <ellipse cx="78" cy="180" rx="13" ry="8" fill="#2e6b04" />
      <ellipse cx="122" cy="180" rx="13" ry="8" fill="#2e6b04" />
    </g>
  )
}

function Cheeks() {
  return (
    <g>
      <ellipse cx="61" cy="118" rx="9" ry="6" fill="#ffd18f" />
      <ellipse cx="139" cy="118" rx="9" ry="6" fill="#ffd18f" />
    </g>
  )
}

export const mascotPoses: Record<MascotPose, ReactElement> = {
  happy: (
    <>
      <Body />
      {/* arms (relaxed) */}
      <ellipse cx="44" cy="138" rx="9" ry="17" fill="#46a302" transform="rotate(24 44 138)" />
      <ellipse cx="156" cy="138" rx="9" ry="17" fill="#46a302" transform="rotate(-24 156 138)" />
      {/* face */}
      <circle cx="80" cy="104" r="9" fill="#23221c" />
      <circle cx="120" cy="104" r="9" fill="#23221c" />
      <circle cx="83" cy="101" r="3" fill="#ffffff" />
      <circle cx="123" cy="101" r="3" fill="#ffffff" />
      <Cheeks />
      <path
        d="M88 118 Q100 130 112 118"
        fill="none"
        stroke="#23221c"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </>
  ),

  cheer: (
    <>
      {/* sparkles */}
      <path d="M30 36 L35 48 L47 52 L35 56 L30 68 L25 56 L13 52 L25 48 Z" fill="#ff9600" />
      <path d="M170 32 L175 44 L187 48 L175 52 L170 64 L165 52 L153 48 L165 44 Z" fill="#ff9600" />
      <Body />
      {/* arms (raised) */}
      <ellipse cx="44" cy="92" rx="9" ry="17" fill="#46a302" transform="rotate(-40 44 92)" />
      <ellipse cx="156" cy="92" rx="9" ry="17" fill="#46a302" transform="rotate(40 156 92)" />
      {/* face: happy closed eyes + open mouth */}
      <path
        d="M70 106 Q80 96 90 106"
        fill="none"
        stroke="#23221c"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M110 106 Q120 96 130 106"
        fill="none"
        stroke="#23221c"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Cheeks />
      <path d="M84 116 Q100 138 116 116 Z" fill="#23221c" />
    </>
  ),

  sleep: (
    <>
      {/* zzz */}
      <path
        d="M18 68 h10 l-10 10 h10"
        fill="none"
        stroke="#a9a69a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 46 h12 l-12 12 h12"
        fill="none"
        stroke="#a9a69a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M38 18 h13 l-13 13 h13"
        fill="none"
        stroke="#a9a69a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Body />
      {/* arms (relaxed) */}
      <ellipse cx="44" cy="138" rx="9" ry="17" fill="#46a302" transform="rotate(24 44 138)" />
      <ellipse cx="156" cy="138" rx="9" ry="17" fill="#46a302" transform="rotate(-24 156 138)" />
      {/* face: closed eyes + tiny open mouth */}
      <path
        d="M71 102 Q80 110 89 102"
        fill="none"
        stroke="#23221c"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M111 102 Q120 110 129 102"
        fill="none"
        stroke="#23221c"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Cheeks />
      <ellipse cx="100" cy="124" rx="5" ry="6" fill="#23221c" />
    </>
  ),

  think: (
    <>
      {/* thought dots */}
      <circle cx="150" cy="86" r="4" fill="#d6d4ca" />
      <circle cx="161" cy="68" r="6" fill="#d6d4ca" />
      <circle cx="174" cy="48" r="9" fill="#d6d4ca" />
      <Body />
      {/* arms (left relaxed, right to chin) */}
      <ellipse cx="44" cy="138" rx="9" ry="17" fill="#46a302" transform="rotate(24 44 138)" />
      <ellipse cx="124" cy="132" rx="8" ry="15" fill="#46a302" transform="rotate(-55 124 132)" />
      {/* face: raised brow, eyes, pondering mouth */}
      <path
        d="M110 84 Q121 79 131 85"
        fill="none"
        stroke="#23221c"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="84" cy="101" r="8" fill="#23221c" />
      <circle cx="124" cy="101" r="8" fill="#23221c" />
      <circle cx="87" cy="98" r="2.5" fill="#ffffff" />
      <circle cx="127" cy="98" r="2.5" fill="#ffffff" />
      <Cheeks />
      <path d="M91 123 L109 119" fill="none" stroke="#23221c" strokeWidth="6" strokeLinecap="round" />
    </>
  ),
}
