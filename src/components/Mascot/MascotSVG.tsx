export interface MascotProps {
  /** Bartlängen-Level (50–100). Höherer Wert = längerer Bart. Default: 50 (kurz). */
  bartLength?: number
  /** Klick-basiertes Bartwachstum. Default: 0. */
  clickCount?: number
  onClick?: React.MouseEventHandler<SVGSVGElement>
  /** CSS-Klasse(n) des SVG-Elements. Default: "beard-svg". */
  className?: string
}

/** Maskottchen als SVG; der Bart wächst abhängig von bartLength und clickCount nach unten. */
export function MascotSVG({ bartLength = 50, clickCount = 0, onClick, className = 'beard-svg' }: MascotProps) {
  const bartGrowth = (bartLength - 50) / 50
  const rebirthHeight = bartGrowth * 100
  const clickHeight = Math.min(50, clickCount * 0.3)
  const beardHeight = 20 + rebirthHeight + clickHeight

  return (
    <svg
      viewBox="0 0 200 350"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      onClick={onClick}
      style={{ transition: 'all 0.2s ease' }}
    >
      {/* Gesicht */}
      <rect x="40" y="40" width="120" height="100" rx="16" fill="#d4a373" />

      {/* Mütze */}
      <g>
        <rect x="30" y="44" width="140" height="14" rx="6" fill="var(--accent)" />
        <path d="M40 44 L160 44 L160 24 Q 100 0 40 24 Z" fill="var(--accent)" />
        <circle cx="100" cy="5" r="6" fill="#5c38cc" />
        {/* Rebirth-Abzeichen — wird per JS sichtbar geschaltet */}
        <g style={{ display: 'none' }}>
          <circle cx="150" cy="24" r="16" fill="#FFD700" stroke="#FFA500" strokeWidth="3" />
          <text x="150" y="32" fontSize="20" fontWeight="bold" fill="#000" textAnchor="middle" fontFamily="Arial">♻</text>
        </g>
      </g>

      {/* Augen */}
      <g stroke="#111" strokeWidth="3" fill="none">
        <rect x="56" y="76" width="30" height="20" rx="4" />
        <rect x="114" y="76" width="30" height="20" rx="4" />
        <path d="M86 86 h28" />
      </g>
      <circle cx="70" cy="86" r="3" fill="#000" />
      <circle cx="130" cy="86" r="3" fill="#000" />

      {/* Dynamischer Bart — wächst nach unten */}
      <g style={{ transition: 'all 0.2s ease' }}>
        <path
          d={`M40 130 L160 130 L160 ${130 + beardHeight * 2} Q 100 ${130 + beardHeight * 2 + 10} 40 ${130 + beardHeight * 2} Z`}
          fill="#3d2b1f"
          style={{ transition: 'all 0.2s ease' }}
        />
        <path
          d={`M40 130 L160 130 L160 ${130 + beardHeight * 2} Q 100 ${130 + beardHeight * 2 + 10} 40 ${130 + beardHeight * 2} Z`}
          fill="none"
          stroke="#22160f"
          strokeWidth="1.8"
          strokeDasharray="4 8"
          opacity="0.85"
          style={{ transition: 'all 0.2s ease' }}
        />
      </g>
    </svg>
  )
}
