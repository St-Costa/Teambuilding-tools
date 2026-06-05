import type { CSSProperties } from "react";
import type { Annotazione as AnnotazioneType } from "../lib/ambientazione";
import { fontSizeAnnotazione } from "../lib/scena";
import styles from "./Annotazione.module.css";

interface Props {
  annotazione: AnnotazioneType;
  // Lato maggiore della mappa renderizzata (px): la dimensione è una frazione
  // di questo, così simbolo/testo scalano identici in regia e proiezione.
  latoMaggiore: number;
}

// Display puro di una singola annotazione (emoji o etichetta di testo). Nessuna
// logica di interazione qui — drag/resize/selezione stanno in AreaMappa (regia).
export default function Annotazione({ annotazione, latoMaggiore }: Props) {
  const fontSize = fontSizeAnnotazione(annotazione.dimensione, latoMaggiore);
  // Colore del testo NON modificabile: rosso acceso fisso con bordo bianco 2px
  // (vedi .testo nel CSS). I simboli (emoji) non hanno colore proprio.
  const stile: CSSProperties = { fontSize };
  return (
    <span className={annotazione.tipo === "testo" ? styles.testo : styles.simbolo} style={stile}>
      {annotazione.contenuto}
    </span>
  );
}
