import { useEffect, useId, useRef, useState } from "react";
import type { FettaCalcolata } from "../lib/ruota";
import type { ConflittoSnapshot, FonteSnap, PartecipanteSnap } from "../lib/events";
import { risolviAsset } from "../lib/storage";
import { playTick } from "../lib/audio";
import Cerchietto from "./Cerchietto";
import { IconaCorona } from "./Icone";
import styles from "./Ruota.module.css";

interface Props {
  snapshot: ConflittoSnapshot;
  folderPath: string;
  dimensione: number;
  animata?: boolean;
  // Se true, fa scattare il tick (audio nativo, vedi lib/audio.ts) a ogni
  // attraversamento di confine durante lo spin. Solo la regia lo attiva; la
  // proiezione resta muta per evitare doppioni. Deroga a CLAUDE.md §0.
  suonaTick?: boolean;
  onSpinFine?: () => void;
}

const VIEW = 100;
const CX = 50;
const CY = 50;
const R = 47;                  // raggio ruota
const R_FACCIA = 30;            // raggio sulla quale stanno i centri delle facce
const DIM_FACCIA = 18;          // diametro cerchio faccia
const DIM_BONUS = 12;           // diametro quadratino bonus
const R_BONUS_OGGETTO = 36;     // raggio dove sta l'icona oggetto

function polar(centro: number, raggio: number, gradi: number): { x: number; y: number } {
  const rad = (gradi - 90) * (Math.PI / 180);
  return {
    x: centro + raggio * Math.cos(rad),
    y: centro + raggio * Math.sin(rad),
  };
}

function arcPath(startDeg: number, endDeg: number, raggio: number, centroX: number, centroY: number): string {
  if (endDeg - startDeg >= 360 - 1e-6) {
    const m = polar(centroX, raggio, 0);
    const o = polar(centroY, raggio, 180);
    return `M ${centroX} ${centroY} L ${m.x} ${m.y} A ${raggio} ${raggio} 0 1 1 ${o.x} ${o.y} A ${raggio} ${raggio} 0 1 1 ${m.x} ${m.y} Z`;
  }
  const start = polar(centroX, raggio, startDeg);
  const end = polar(centroY, raggio, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${centroX} ${centroY} L ${start.x} ${start.y} A ${raggio} ${raggio} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export default function Ruota({
  snapshot,
  folderPath,
  dimensione,
  animata = true,
  suonaTick = false,
  onSpinFine,
}: Props) {
  const idBase = useId().replace(/:/g, "_");
  const { fette, partecipanti, fase, angoloFinale, durataSpinMs, vincitoreId, triggerCount } =
    snapshot;

  const partecipantePerId = new Map(partecipanti.map((p) => [p.personaggioId, p]));

  // Vincitore da incoronare (solo a risultato): dati per il pannello a destra.
  const vincitoreSnap =
    fase === "risultato" && vincitoreId ? partecipantePerId.get(vincitoreId) ?? null : null;

  const [visibleAngolo, setVisibleAngolo] = useState(0);
  const [wobbleCount, setWobbleCount] = useState(0);
  const gRef = useRef<SVGGElement | null>(null);

  // Confini delle sotto-regioni: ogni fetta ha 1 o 2 regioni (base, +bonus
  // se ha modificatore). Il tick scatta a ogni attraversamento, inclusi
  // i confini interni base→bonus.
  const regioniAngoli: number[] = (() => {
    const out: number[] = [];
    for (const f of fette) {
      out.push(f.startAngolo);
      if (f.bonusFrazione > 0) out.push(f.startAngolo + f.baseFrazione * 360);
    }
    return out;
  })();

  // rAF loop durante lo spin: legge la rotazione interpolata via
  // getComputedStyle.transform, rileva l'attraversamento di un confine di
  // (sotto-)fetta e fa scattare 1) il WOBBLE della freccia (su entrambe le
  // finestre), 2) il TICK audio nativo (solo regia, suonaTick = true). Il tick
  // è agganciato all'attraversamento REALE a schermo → coincide col passaggio.
  useEffect(() => {
    if (!animata || fase !== "girando") return;
    const el = gRef.current;
    if (!el) return;
    let prevIdx = -1;
    let rafId = 0;
    function step() {
      const computed = window.getComputedStyle(el!).transform;
      let angolo = 0;
      if (computed && computed.startsWith("matrix")) {
        const nums = computed.match(/-?[\d.]+/g);
        if (nums && nums.length >= 4) {
          const a = parseFloat(nums[0]);
          const b = parseFloat(nums[1]);
          angolo = (Math.atan2(b, a) * 180) / Math.PI;
        }
      }
      const angoloNorm = ((angolo % 360) + 360) % 360;
      const angoloRel = (360 - angoloNorm) % 360;
      // currIdx = indice della regione in cui cade angoloRel. Le regioni sono
      // contigue, ordinate per startAngolo crescente.
      let currIdx = regioniAngoli.length - 1;
      for (let i = 0; i < regioniAngoli.length - 1; i++) {
        if (angoloRel < regioniAngoli[i + 1]) {
          currIdx = i;
          break;
        }
      }
      if (prevIdx !== -1 && currIdx !== prevIdx) {
        if (suonaTick) playTick();
        setWobbleCount((c) => c + 1);
      }
      prevIdx = currIdx;
      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [suonaTick, animata, fase, triggerCount, regioniAngoli.length]);

  useEffect(() => {
    if (!animata) {
      setVisibleAngolo(angoloFinale);
      return;
    }
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        setVisibleAngolo(angoloFinale);
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [angoloFinale, triggerCount, animata]);

  return (
    <div
      className={styles.contenitore}
      style={{ width: dimensione, height: dimensione }}
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className={styles.svg}>
        <defs>
          {/* Una clipPath per ogni fetta, in coordinate utente: cerchio per
              la faccia, quadrato arrotondato per l'eventuale oggetto bonus.
              In coordinate utente le clip ruotano con il gruppo che le contiene
              (sono dentro l'<g> rotante), quindi rimangono allineate ai loro
              elementi durante lo spin. */}
          {fette.map((f) => {
            const p = partecipantePerId.get(f.id);
            if (!p) return null;
            const baseEnd = f.startAngolo + f.baseFrazione * 360;
            const midBase = (f.startAngolo + baseEnd) / 2;
            const facciaPos = polar(CX, R_FACCIA, midBase);
            const midBonus = (baseEnd + f.fineAngolo) / 2;
            const oggettoPos = polar(CX, R_BONUS_OGGETTO, midBonus);
            return (
              <g key={f.id}>
                <clipPath id={`${idBase}-fc-${f.id}`}>
                  <circle cx={facciaPos.x} cy={facciaPos.y} r={DIM_FACCIA / 2} />
                </clipPath>
                {f.bonusFrazione > 0 && p.fonte?.tipo === "oggetto" && (
                  <clipPath id={`${idBase}-ob-${f.id}`}>
                    <rect
                      x={oggettoPos.x - DIM_BONUS / 2}
                      y={oggettoPos.y - DIM_BONUS / 2}
                      width={DIM_BONUS}
                      height={DIM_BONUS}
                      rx={DIM_BONUS * 0.22}
                      ry={DIM_BONUS * 0.22}
                    />
                  </clipPath>
                )}
              </g>
            );
          })}
        </defs>

        <circle cx={CX} cy={CY} r={R + 0.5} fill="#fff" />

        <g
          ref={gRef}
          className={animata ? styles.ruotante : undefined}
          style={
            animata
              ? {
                  transform: `rotate(${visibleAngolo}deg)`,
                  transformOrigin: `${CX}px ${CY}px`,
                  transition:
                    fase === "girando"
                      ? `transform ${durataSpinMs}ms cubic-bezier(0.17, 0.67, 0.32, 1)`
                      : "none",
                }
              : undefined
          }
          data-trigger={triggerCount}
          onTransitionEnd={(e) => {
            if (e.propertyName === "transform") onSpinFine?.();
          }}
        >
          {fette.map((f) => renderFetta(f, partecipantePerId, folderPath, vincitoreId, fase, idBase))}
        </g>

        {/* freccia "premium": slim teardrop con gradient + soft drop shadow.
            Forma: punta in alto leggermente arrotondata che si stringe a
            cuneo verso il basso fino al cerchio della ruota. */}
        <defs>
          <linearGradient id={`${idBase}-ptr-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#eaeaea" />
            <stop offset="100%" stopColor="#a8a8a8" />
          </linearGradient>
          <filter id={`${idBase}-ptr-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" />
            <feOffset dx="0" dy="0.4" result="offsetBlur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.55" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* g wrapper con key={wobbleCount}: ad ogni tick la chiave cambia →
            React rimonta il g → l'animazione CSS riparte da capo. transform
            SVG attribute (più affidabile su WebKitGTK di transform CSS). */}
        <g key={wobbleCount} className={styles.puntaWobble}>
          <path
            d={`M ${CX} 1.5 C ${CX + 1.6} 2.6 ${CX + 1.8} 5 ${CX + 1.4} 8 L ${CX} 12 L ${CX - 1.4} 8 C ${CX - 1.8} 5 ${CX - 1.6} 2.6 ${CX} 1.5 Z`}
            fill={`url(#${idBase}-ptr-grad)`}
            stroke="#5a5a5a"
            strokeWidth={0.18}
            filter={`url(#${idBase}-ptr-shadow)`}
          />
        </g>
      </svg>

      {/* Incoronazione del vincitore: a destra della ruota, la coroncina entra
          dall'alto e il cerchietto del vincitore dall'basso. */}
      {vincitoreSnap && (
        <div className={styles.rivelaVincitore} style={{ left: `${dimensione}px` }}>
          <div className={styles.coronaWrap} style={{ color: "#ffcc33" }}>
            <IconaCorona dimensione={Math.round(dimensione * 0.2)} />
          </div>
          <div className={styles.cerchioWrap}>
            <Cerchietto
              src={risolviAsset(folderPath, vincitoreSnap.imgPath)}
              colore={vincitoreSnap.colore}
              crop={vincitoreSnap.crop}
              dimensione={Math.round(dimensione * 0.28)}
              alt={vincitoreSnap.nome}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function renderFetta(
  f: FettaCalcolata,
  partecipantePerId: Map<string, PartecipanteSnap>,
  folderPath: string,
  vincitoreId: string | null,
  fase: "pronto" | "girando" | "risultato",
  idBase: string,
) {
  const p = partecipantePerId.get(f.id);
  if (!p) return null;

  const haBonus = f.bonusFrazione > 0;
  const vincitore = vincitoreId === f.id && fase === "risultato";

  const colore = p.colore;

  // La fetta TOTALE (base + eventuale bonus) come UN SOLO path → il bonus
  // appare come "estensione" della base, non come fetta a sé. Una linea
  // bianca SOTTILE e semi-trasparente al confine base/bonus segnala dove
  // inizia il bonus senza spezzare visivamente la fetta.
  const baseEnd = f.startAngolo + f.baseFrazione * 360;
  const sepFine = polar(CX, R, baseEnd);
  // A risultato: la fetta vincente resta in evidenza (glow), le altre si
  // scuriscono. La transizione CSS rende il cambio una piccola animazione.
  const haRisultato = fase === "risultato" && !!vincitoreId;
  const classeFetta = haRisultato
    ? vincitore
      ? styles.vincitore
      : styles.altraFetta
    : styles.fetta;
  return (
    <g key={f.id} className={classeFetta}>
      <path
        d={arcPath(f.startAngolo, f.fineAngolo, R, CX, CY)}
        fill={colore}
        stroke="#fff"
        strokeWidth={0.6}
      />
      {haBonus && (
        <line
          x1={CX}
          y1={CY}
          x2={sepFine.x}
          y2={sepFine.y}
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={0.35}
        />
      )}
      {renderFaccia(f, p, idBase, folderPath)}
      {haBonus && p.fonte && renderBonus(f, p.fonte, idBase, folderPath)}
    </g>
  );
}

function renderFaccia(
  f: FettaCalcolata,
  p: PartecipanteSnap,
  idBase: string,
  folderPath: string,
) {
  const baseEnd = f.startAngolo + f.baseFrazione * 360;
  const midAngolo = (f.startAngolo + baseEnd) / 2;
  const { x, y } = polar(CX, R_FACCIA, midAngolo);
  // SVG puro: clipPath cerchio inscritto + image col crop applicato come transform.
  const dim = DIM_FACCIA;
  const fx = x - dim / 2;
  const fy = y - dim / 2;
  // Per applicare il crop (zoom + offset) all'immagine già contenuta nel bbox,
  // costruiamo una transform che scala attorno al centro (x, y) e poi trasla.
  // translate(x*(1-z) + ox*dim, y*(1-z) + oy*dim) scale(z)
  const z = p.crop.zoom;
  const tx = x * (1 - z) + p.crop.offsetX * dim;
  const ty = y * (1 - z) + p.crop.offsetY * dim;

  return (
    <g key={`${f.id}-face`}>
      <circle cx={x} cy={y} r={dim / 2} fill="#ddd" />
      <g clipPath={`url(#${idBase}-fc-${f.id})`}>
        <image
          href={risolviAsset(folderPath, p.imgPath)}
          x={fx}
          y={fy}
          width={dim}
          height={dim}
          preserveAspectRatio="xMidYMid meet"
          transform={`translate(${tx} ${ty}) scale(${z})`}
        />
      </g>
      <circle cx={x} cy={y} r={dim / 2} fill="none" stroke={p.colore} strokeWidth={1.4} />
    </g>
  );
}

function renderBonus(
  f: FettaCalcolata,
  fonte: FonteSnap,
  idBase: string,
  folderPath: string,
) {
  const baseEnd = f.startAngolo + f.baseFrazione * 360;
  const midAngolo = (baseEnd + f.fineAngolo) / 2;

  if (fonte.tipo === "oggetto") {
    const { x, y } = polar(CX, R_BONUS_OGGETTO, midAngolo);
    const dim = DIM_BONUS;
    const fx = x - dim / 2;
    const fy = y - dim / 2;
    const z = fonte.crop.zoom;
    const tx = x * (1 - z) + fonte.crop.offsetX * dim;
    const ty = y * (1 - z) + fonte.crop.offsetY * dim;
    return (
      <g key={`${f.id}-bonus`}>
        <rect
          x={fx}
          y={fy}
          width={dim}
          height={dim}
          rx={dim * 0.22}
          ry={dim * 0.22}
          fill="#fff"
        />
        <g clipPath={`url(#${idBase}-ob-${f.id})`}>
          <image
            href={risolviAsset(folderPath, fonte.imgPath)}
            x={fx}
            y={fy}
            width={dim}
            height={dim}
            preserveAspectRatio="xMidYMid meet"
            transform={`translate(${tx} ${ty}) scale(${z})`}
          />
        </g>
        <rect
          x={fx}
          y={fy}
          width={dim}
          height={dim}
          rx={dim * 0.22}
          ry={dim * 0.22}
          fill="none"
          stroke="#1d1d1f"
          strokeWidth={0.7}
        />
      </g>
    );
  }

  // testo radiale: posizionato lungo il raggio dal centro verso l'esterno.
  // Inizia a raggio R_INIZIO (vicino al centro, dopo l'eventuale faccia) e
  // si estende fino a R_FINE (vicino al bordo della ruota). Font calcolato
  // per riempire la lunghezza disponibile.
  const R_INIZIO = 12;  // partenza vicino al centro
  const R_FINE = R - 3;
  const lunghezzaDisp = R_FINE - R_INIZIO;
  const testoCorto = fonte.testo.length > 28 ? fonte.testo.slice(0, 27) + "…" : fonte.testo;
  const flip = midAngolo > 180;
  // Posizione del centro del testo: a metà tra R_INIZIO e R_FINE.
  const rMid = (R_INIZIO + R_FINE) / 2;
  const { x, y } = polar(CX, rMid, midAngolo);
  const rotazione = midAngolo - 90 + (flip ? 180 : 0);
  // Font size adattivo: occupa la lunghezza disponibile.
  // Approssimazione: char width ≈ 0.55 * fontSize.
  const charWidth = 0.55;
  const fontSizeBase = lunghezzaDisp / Math.max(1, testoCorto.length * charWidth);
  const fontSize = Math.max(2.5, Math.min(9, fontSizeBase));
  return (
    <g key={`${f.id}-bonus`} transform={`translate(${x} ${y}) rotate(${rotazione})`}>
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fill="#1d1d1f"
        style={{ fontFamily: "system-ui, sans-serif", fontWeight: 700 }}
        textLength={lunghezzaDisp}
        lengthAdjust="spacingAndGlyphs"
      >
        {testoCorto}
      </text>
    </g>
  );
}
