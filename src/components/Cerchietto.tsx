import type { CSSProperties } from "react";
import type { Crop } from "../lib/ambientazione";
import styles from "./Cerchietto.module.css";

interface Props {
  src: string;
  colore: string;
  crop: Crop;
  dimensione: number;
  spessoreBordo?: number;
  selezionato?: boolean;
  npc?: boolean;
  className?: string;
  alt?: string;
}

export default function Cerchietto({
  src,
  colore,
  crop,
  dimensione,
  spessoreBordo,
  selezionato = false,
  npc = false,
  className,
  alt = "",
}: Props) {
  const bordo = spessoreBordo ?? Math.max(3, Math.round(dimensione * 0.14));
  // Wrapper esterno: non ritaglia (così l'anello SVG dell'NPC può essere
  // disegnato anche sopra l'area del bordo); porta l'alone di selezione.
  const stileRoot: CSSProperties = {
    width: dimensione,
    height: dimensione,
    boxShadow: selezionato ? `0 0 0 3px rgba(255,255,255,0.8), 0 0 0 6px ${colore}` : undefined,
  };
  // Cerchio interno: ritaglia l'immagine; per gli NPC il bordo è trasparente
  // (l'anello visibile è l'SVG tratteggiato), per gli altri è il bordo pieno.
  const stileCerchio: CSSProperties = {
    borderColor: npc ? "transparent" : colore,
    borderWidth: bordo,
  };
  const stileImg: CSSProperties = {
    transform: `translate(${crop.offsetX * 100}%, ${crop.offsetY * 100}%) scale(${crop.zoom})`,
  };

  return (
    <div className={`${styles.root} ${className ?? ""}`} style={stileRoot} aria-label={alt}>
      <div className={styles.cerchio} style={stileCerchio}>
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={stileImg}
          className={styles.img}
          // Asset mancante (file rimosso dal disco): nascondi l'icona "immagine
          // rotta" lasciando il cerchio col bordo colorato come riempimento neutro.
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
          onLoad={(e) => {
            e.currentTarget.style.visibility = "visible";
          }}
        />
      </div>
      {npc && (
        // Anello tratteggiato per gli NPC. Copre l'intero box (incluso il bordo);
        // la frequenza dei trattini è controllata da strokeDasharray, proporzionale
        // alla dimensione → resta fitta a ogni scala (niente effetto salvagente).
        <svg
          className={styles.anelloNpc}
          width={dimensione}
          height={dimensione}
          viewBox={`0 0 ${dimensione} ${dimensione}`}
          aria-hidden="true"
        >
          <circle
            cx={dimensione / 2}
            cy={dimensione / 2}
            r={(dimensione - bordo) / 2}
            fill="none"
            stroke={colore}
            strokeWidth={bordo}
            strokeDasharray={`${Math.max(2, dimensione * 0.2)} ${Math.max(2, dimensione * 0.1)}`}
          />
        </svg>
      )}
    </div>
  );
}
