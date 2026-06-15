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
      <path
        d="M3 8 L7 13 L12 6 L17 13 L21 8 L19.5 18 H4.5 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="12" cy="6" r="1.4" />
      <circle cx="21" cy="8" r="1.4" />
      <rect x="4" y="19" width="16" height="1.6" rx="0.6" />
    </svg>
  );
}

/**
 * Icona "Manette": SVG da handcuffs-free-1-svgrepo-com.svg (SVG Repo, free license).
 * Paths inlineati con fill grigio fisso invece del fill nero originale.
 * viewBox originale "0 0 512 512" preservato.
 */
export function IconaManette({ dimensione = 24, className }: IconaProps) {
  const F = "#C8C8C8";
  return (
    <svg
      width={dimensione}
      height={dimensione}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
      style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,1)) drop-shadow(0 0 18px rgba(0,0,0,0.65))" }}
    >
      <path fill={F} d="M216.367,245.317c-2.203,4.406-5.609,8.172-9.922,10.813c-6.813,4.172-15.063,5.063-22.609,2.453l-5.5-1.891c1.828,1.984,3.563,4.031,5.172,6.188c9.422,12.547,15.125,27.719,16.188,43.516c0.703,10.547-0.625,21.359-4.313,32.031c-5.547,16-15.453,29.031-28.016,38.484c-12.547,9.422-27.703,15.109-43.516,16.188c-1.172,0.063-2.344,0.109-3.516,0.141c2.953,7.797,3.328,16.61,0.391,25.094c-1.547,4.453-3.875,8.422-6.781,11.813c11.938,0.453,23.719-0.891,34.984-3.906c22.016-5.891,42.078-18.047,57.531-35.219c10.297-11.422,18.547-25.109,23.859-40.516c8-23.109,8.422-47.172,2.516-69.172C229.398,268.473,223.82,256.317,216.367,245.317z"/>
      <path fill={F} d="M69.477,246.754c12.547-9.422,27.719-15.141,43.516-16.188c10.547-0.719,21.359,0.609,32.031,4.313l41.984,14.516c4.781,1.656,10.047,1.078,14.359-1.563s7.219-7.063,7.922-12.078l6.391-34.75c1.125-8.016-3.578-15.703-11.219-18.344l-36.953-12.781l-36.969-12.781c-7.641-2.641-16.094,0.5-20.156,7.5l-16.422,31.297l-0.078,0.109c-2,0.422-3.984,0.891-5.953,1.406c-22.031,5.906-42.094,18.047-57.547,35.203c-10.297,11.438-18.531,25.109-23.859,40.516c-8,23.109-8.406,47.188-2.516,69.188c5.906,22.031,18.047,42.094,35.219,57.547c6.25,5.625,13.188,10.61,20.688,14.86c2.578,7.813,8.594,14.375,16.953,17.281c14.234,4.922,29.75-2.625,34.656-16.859c4.922-14.219-2.625-29.735-16.844-34.657c-6.5-2.234-13.266-1.859-19.156,0.547c-8.734-5.406-16.188-12.297-22.172-20.266c-9.422-12.547-15.125-27.719-16.188-43.516c-0.703-10.547,0.625-21.359,4.313-32.031C47.023,269.223,56.93,256.176,69.477,246.754z M145.336,202.411c1.594-4.641,5.813-7.609,10.422-7.844l4.109-11.844l8.266,2.859l-4.094,11.844c3.469,3.031,4.953,7.984,3.375,12.609c-2.125,6.094-8.766,9.344-14.859,7.234C146.461,215.145,143.227,208.504,145.336,202.411z M74.742,402.426c2.109-6.094,8.75-9.328,14.859-7.219c6.094,2.109,9.328,8.766,7.219,14.86c-2.109,6.094-8.75,9.328-14.844,7.219C75.867,415.177,72.633,408.521,74.742,402.426z"/>
      <path fill={F} d="M367.305,431.13c-14.984-5.109-28.156-14.547-37.828-26.907c-9.688-12.359-15.875-27.531-17.094-44.406c-0.797-11.266,0.719-22.063,4.141-32.063c5.109-14.984,14.547-28.156,26.906-37.844c2.109-1.656,4.297-3.188,6.578-4.625l-5.797,0.406c-7.969,0.563-15.703-2.438-21.203-8.234c-3.484-3.672-5.797-8.172-6.781-13c-10.047,8.672-18.578,18.984-25.234,30.5c-11.391,19.734-17.219,43.078-15.484,67.469c1.141,16.266,5.563,31.609,12.547,45.328c10.484,20.579,26.719,37.5,46.453,48.891c10.094,5.828,21.125,10.203,32.766,12.844c-1.906-4.031-3.156-8.453-3.484-13.172c-0.625-8.938,2-17.359,6.891-24.141C369.539,431.849,368.43,431.505,367.305,431.13z"/>
      <path fill={F} d="M511.695,345.661c-1.156-16.266-5.563-31.609-12.547-45.313c-10.484-20.578-26.719-37.516-46.453-48.906c-1.766-1.031-3.578-1.984-5.391-2.906l-0.031-0.141l-7.781-34.484c-2.109-7.797-9.453-13.016-17.531-12.438l-39,2.766l-39,2.766c-8.078,0.578-14.609,6.797-15.594,14.813l-2.828,35.219c-0.609,5.031,1.047,10.063,4.531,13.719s8.406,5.578,13.453,5.219l44.313-3.141c11.266-0.797,22.063,0.719,32.063,4.125c14.984,5.125,28.156,14.563,37.844,26.906c9.672,12.375,15.859,27.531,17.078,44.406c0.781,11.266-0.719,22.078-4.141,32.063c-5.109,14.984-14.547,28.157-26.891,37.844c-7.859,6.141-16.828,10.875-26.672,13.844c-5.078-3.875-11.5-5.984-18.359-5.5c-15.016,1.063-26.328,14.094-25.266,29.109c1.078,15.016,14.094,26.313,29.125,25.25c8.828-0.625,16.344-5.406,20.859-12.281c8.344-2.172,16.328-5.188,23.828-9.016c20.578-10.469,37.5-26.703,48.906-46.453C507.602,393.411,513.445,370.051,511.695,345.661z M385.148,253.864c-6.453,0.469-12.031-4.375-12.484-10.813c-0.344-4.891,2.359-9.281,6.516-11.313l-0.891-12.5l8.734-0.625l0.875,12.5c4.406,1.422,7.703,5.391,8.063,10.281C396.414,247.833,391.57,253.411,385.148,253.864z M401.508,465.349c-6.438,0.469-12.016-4.375-12.484-10.828c-0.453-6.422,4.391-12,10.828-12.469c6.438-0.453,12.016,4.391,12.484,10.828C412.789,459.302,407.945,464.896,401.508,465.349z"/>
      <path fill={F} d="M281.992,71.02c2.141-3.359,3.484-7.188,3.938-11.156l14.063,3.281c-0.828,2.578-1.297,5.281-1.297,7.984c0,5.344,1.672,10.781,5.078,15.391l12.141,16.469c2.516,3.438,5.781,6.078,9.375,7.859s7.531,2.688,11.5,2.688c2.625,0,5.25-0.406,7.813-1.203l5.891,9.688c-2.125,1.578-4.016,3.422-5.578,5.5c-3.484,4.641-5.484,10.359-5.484,16.359c0,2.391,0.328,4.828,0.984,7.219l5.797,21.141c1.656,6.016,5.25,11.063,9.891,14.531c4.641,3.484,10.359,5.484,16.344,5.484c2.391,0,4.828-0.328,7.219-0.984l0,0c6.016-1.641,11.063-5.234,14.547-9.875s5.469-10.359,5.469-16.344c0-2.406-0.328-4.828-0.984-7.234l-5.797-21.141c-1.641-6-5.234-11.047-9.875-14.531c-4.641-3.5-10.359-5.469-16.359-5.469c-0.391,0-0.781,0.016-1.172,0.031l-8.141-13.375c1.031-1.344,1.953-2.75,2.688-4.234c1.766-3.594,2.672-7.531,2.672-11.516c0.016-5.328-1.656-10.766-5.047-15.375l-12.156-16.469c-2.531-3.438-5.781-6.094-9.375-7.859c-3.594-1.781-7.531-2.688-11.516-2.688c-4.938,0-9.953,1.438-14.344,4.359l-28.313-6.609c-2.047-3.172-4.703-5.813-7.766-7.766c-4.156-2.672-9.031-4.125-14.031-4.125c-3.469,0-7.016,0.703-10.359,2.156l-18.766,8.203v-0.016c-4.844,2.125-8.781,5.578-11.438,9.75c-2.672,4.156-4.125,9.016-4.125,14.031c0,2.422,0.359,4.875,1.063,7.266l-13.516,12.875c-2.781-0.906-5.641-1.359-8.453-1.359c-5.234,0.016-10.297,1.516-14.656,4.281s-7.984,6.844-10.219,11.891l-8.906,20.031c-1.594,3.578-2.359,7.344-2.359,11.031c0.016,5.234,1.516,10.313,4.281,14.656c2.766,4.359,6.844,8,11.891,10.234c3.578,1.594,7.344,2.344,11.047,2.344c5.219,0,10.297-1.5,14.641-4.266c4.359-2.766,8-6.844,10.234-11.891l8.906-20.031c1.578-3.578,2.344-7.359,2.344-11.047c0-5.219-1.5-10.297-4.266-14.656c-0.469-0.719-0.969-1.406-1.5-2.078l9.359-8.922c0.656,0.516,1.313,1,2.016,1.438c4.156,2.688,9.016,4.125,14.031,4.125c3.469,0,7-0.688,10.359-2.156l18.766-8.188C275.383,78.645,279.32,75.176,281.992,71.02z M357.367,136.879c1.5-2,3.594-3.5,6.203-4.219c1.047-0.297,2.094-0.422,3.094-0.422c2.547,0,5,0.844,7,2.344c2,1.516,3.5,3.609,4.234,6.234l5.797,21.125c0.281,1.063,0.406,2.078,0.406,3.109c0,2.531-0.844,5-2.344,6.984c-1.5,2-3.609,3.5-6.219,4.219c-1.047,0.281-2.063,0.422-3.094,0.422c-2.531,0-5-0.844-6.984-2.344c-2.016-1.516-3.516-3.609-4.234-6.219l-5.797-21.125l-7.516,2.047l7.516-2.063c-0.281-1.047-0.422-2.078-0.422-3.094C355.008,141.333,355.852,138.879,357.367,136.879z M316.289,77.27c-1.375-1.875-2.016-3.984-2.016-6.141c0-1.594,0.359-3.172,1.078-4.609c0.203-0.406,0.422-0.797,0.688-1.172c1.563-0.656,2.891-1.844,3.734-3.359c1.531-0.813,3.188-1.219,4.844-1.219c1.594,0,3.188,0.359,4.625,1.078c1.422,0.703,2.703,1.734,3.734,3.125l12.141,16.484c1.391,1.875,2.016,3.984,2.016,6.125c0.016,1.609-0.359,3.188-1.063,4.609c-0.703,1.438-1.734,2.719-3.141,3.75c-1.875,1.375-3.984,2.016-6.141,2.031c-1.594,0-3.172-0.375-4.609-1.078c-1.438-0.719-2.703-1.75-3.734-3.141L316.289,77.27l-6.25,4.625L316.289,77.27z M205.195,115.911l-8.906,20.031c-0.969,2.188-2.5,3.891-4.359,5.078s-4.063,1.844-6.281,1.844c-1.578,0-3.172-0.313-4.719-1.016c-2.203-0.969-3.891-2.484-5.094-4.359c-1.188-1.875-1.844-4.063-1.828-6.297c0-1.563,0.313-3.156,1-4.703l8.906-20.031c0.969-2.203,2.5-3.891,4.375-5.094c1.859-1.188,4.063-1.844,6.281-1.828c1.578,0,3.156,0.313,4.719,1c2.188,0.984,3.891,2.5,5.094,4.375c1.172,1.859,1.828,4.063,1.828,6.281C206.211,112.77,205.898,114.364,205.195,115.911z M268.883,62.598c-1.078,1.672-2.594,3.031-4.563,3.891l-18.766,8.188c-1.375,0.594-2.75,0.859-4.141,0.859c-1.984,0-3.953-0.578-5.625-1.656s-3.016-2.594-3.875-4.563c-0.609-1.375-0.875-2.766-0.875-4.141c0-1.984,0.578-3.953,1.656-5.625c1.078-1.656,2.594-3.016,4.563-3.875h0.016l18.75-8.188c1.375-0.594,2.766-0.875,4.141-0.875c1.984,0,3.953,0.594,5.625,1.656c1.656,1.078,3.016,2.594,3.875,4.578c0.609,1.375,0.875,2.75,0.875,4.125C270.539,58.973,269.945,60.926,268.883,62.598z"/>
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

/** Icona "Testo": una T maiuscola, come nei tool di disegno. */
export function IconaTesto({ dimensione = 24, className }: IconaProps) {
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
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="20"
        fill="currentColor"
      >
        T
      </text>
    </svg>
  );
}

/** Icona "Volume": altoparlante con onde sonore. */
export function IconaVolume({ dimensione = 24, className }: IconaProps) {
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
      <path d="M4 9 H7 L11.5 5 V19 L7 15 H4 Z" fill="currentColor" stroke="none" />
      <path d="M15 9 a4 4 0 0 1 0 6" />
      <path d="M17.5 6.5 a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

/** Icona "Immagine": cornice con montagnetta e sole, come nei software documenti. */
export function IconaImmagine({ dimensione = 24, className }: IconaProps) {
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
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 17 L9.5 11.5 L13 15 L16 12 L20 16.5" />
    </svg>
  );
}

/** Icona "Presentazione": schermo su cavalletto con un triangolo "play". */
export function IconaPresentazione({ dimensione = 24, className }: IconaProps) {
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
      <rect x="3" y="3.5" width="18" height="12" rx="1.8" />
      <path d="M12 15.5 L12 18" />
      <path d="M8.5 21 L12 18 L15.5 21" />
      <path d="M10 7 L15 9.5 L10 12 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Icona "Orologio": quadrante con lancette, per il countdown a schermo intero. */
export function IconaOrologio({ dimensione = 24, className }: IconaProps) {
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
      <circle cx="12" cy="12" r="9.5" />
      {/* tacca 12 */}
      <line x1="12" y1="3.5" x2="12" y2="5.5" />
      {/* lancetta minuti (punta a 12) */}
      <line x1="12" y1="12" x2="12" y2="5.5" strokeWidth={STROKE + 0.3} />
      {/* lancetta ore (punta a ~10) */}
      <line x1="12" y1="12" x2="8.1" y2="8.1" strokeWidth={STROKE + 0.3} />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Icona "Voto/prigione": griglia di sbarre verticali con bordo — usata per la schermata voti prigionieri. */
export function IconaVoto({ dimensione = 24, className }: IconaProps) {
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
      <rect x="3" y="3.5" width="18" height="17" rx="2" />
      <line x1="8" y1="3.5" x2="8" y2="20.5" />
      <line x1="12" y1="3.5" x2="12" y2="20.5" />
      <line x1="16" y1="3.5" x2="16" y2="20.5" />
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
