/* Icone SVG inline custom — uno stile coerente "outline" con currentColor. */

interface IconaProps {
  dimensione?: number;
  className?: string;
}

const STROKE = 1.7;

export function IconaMonitor({ dimensione = 24, className }: IconaProps) {
  return (
    <svg
      width={dimensione}
      height={dimensione}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="3.5" width="19" height="13" rx="1.8" />
      <line x1="8" y1="20.5" x2="16" y2="20.5" />
      <line x1="12" y1="16.5" x2="12" y2="20.5" />
    </svg>
  );
}

export function IconaCasa({ dimensione = 24, className }: IconaProps) {
  return (
    <svg
      width={dimensione}
      height={dimensione}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 11 L12 3 L21 11 V20 a1 1 0 0 1 -1 1 h-4 v-7 h-6 v7 h-4 a1 1 0 0 1 -1 -1 Z" />
    </svg>
  );
}

export function IconaTrofeo({ dimensione = 24, className }: IconaProps) {
  return (
    <svg
      width={dimensione}
      height={dimensione}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 4 H18 V8 a6 6 0 0 1 -12 0 Z" />
      <path d="M6 6 H3 a1 1 0 0 0 -1 1 V9 a3 3 0 0 0 3 3 H6" />
      <path d="M18 6 H21 a1 1 0 0 1 1 1 V9 a3 3 0 0 1 -3 3 H18" />
      <path d="M12 14 V17" />
      <path d="M9 21 H15" />
      <path d="M10 17 H14 L14.4 21 H9.6 Z" />
    </svg>
  );
}

export function IconaCorona({ dimensione = 24, className }: IconaProps) {
  return (
    <svg
      width={dimensione}
      height={dimensione}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 8 L7 13 L12 6 L17 13 L21 8 L19.5 18 H4.5 Z" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="12" cy="6" r="1.4" />
      <circle cx="21" cy="8" r="1.4" />
      <rect x="4" y="19" width="16" height="1.6" rx="0.6" />
    </svg>
  );
}

export function IconaVS({ dimensione = 24, className }: IconaProps) {
  return (
    <svg
      width={dimensione}
      height={dimensione}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <text
        x="12"
        y="13.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="12"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        VS
      </text>
    </svg>
  );
}

/**
 * Icona "ruota della fortuna": cerchio diviso in 6 spicchi + perno centrale
 * + freccia indicatrice in alto. (Non più usata, mantenuta per riferimento.)
 */
export function IconaRuotaFortuna({ dimensione = 24, className }: IconaProps) {
  // Centro ruota e raggio. Lascio spazio in alto per la freccia.
  const cx = 12;
  const cy = 13;
  const r = 7.5;
  // 6 spicchi → linea ogni 60°. Disegno 3 diametri (60°, 120°, 180°/orizzontale).
  // Più semplice: 3 segmenti che si incrociano al centro a 0°, 60°, 120°.
  const diametri = [0, 60, 120].map((angDeg) => {
    const ang = (angDeg * Math.PI) / 180;
    const dx = Math.cos(ang) * r;
    const dy = Math.sin(ang) * r;
    return { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
  });
  return (
    <svg
      width={dimensione}
      height={dimensione}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* freccia indicatrice */}
      <path d="M12 1.5 L9.6 4.3 L14.4 4.3 Z" fill="currentColor" stroke="none" />
      {/* cerchio esterno ruota */}
      <circle cx={cx} cy={cy} r={r} />
      {/* diametri (6 spicchi) */}
      {diametri.map((d, i) => (
        <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
      ))}
      {/* perno centrale */}
      <circle cx={cx} cy={cy} r={1} fill="currentColor" stroke="none" />
    </svg>
  );
}
