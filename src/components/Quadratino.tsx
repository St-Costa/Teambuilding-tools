import type { CSSProperties } from "react";
import type { Crop } from "../lib/ambientazione";
import styles from "./Quadratino.module.css";

interface Props {
  src: string;
  crop: Crop;
  dimensione: number;
  coloreBordo?: string;
  spessoreBordo?: number;
  selezionato?: boolean;
  className?: string;
  alt?: string;
}

const COLORE_BORDO_DEFAULT = "#3a3a3c";

export default function Quadratino({
  src,
  crop,
  dimensione,
  coloreBordo,
  spessoreBordo,
  selezionato = false,
  className,
  alt = "",
}: Props) {
  const colore = coloreBordo ?? COLORE_BORDO_DEFAULT;
  const bordo = spessoreBordo ?? Math.max(3, Math.round(dimensione * 0.14));
  const stileContenitore: CSSProperties = {
    width: dimensione,
    height: dimensione,
    borderColor: colore,
    borderWidth: bordo,
    boxShadow: selezionato ? `0 0 0 3px rgba(255,255,255,0.8), 0 0 0 6px ${colore}` : undefined,
  };
  const stileImg: CSSProperties = {
    transform: `translate(${crop.offsetX * 100}%, ${crop.offsetY * 100}%) scale(${crop.zoom})`,
  };
  return (
    <div className={`${styles.root} ${className ?? ""}`} style={stileContenitore} aria-label={alt}>
      <img src={src} alt={alt} draggable={false} style={stileImg} className={styles.img} />
    </div>
  );
}
