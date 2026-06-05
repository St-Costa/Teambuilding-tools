import { useState } from "react";
import type { Crop } from "../../lib/ambientazione";
import { risolviAsset } from "../../lib/storage";
import MaschereCircolare from "../components/MaschereCircolare";
import styles from "./EditorRitaglio.module.css";

interface Props {
  nome: string;
  imgPath: string;
  cropIniziale: Crop;
  colore?: string;
  folderPath: string;
  onAnnulla: () => void;
  onConferma: (crop: Crop) => void;
}

const COLORE_NEUTRO = "#888888";

export default function EditorRitaglio({
  nome,
  imgPath,
  cropIniziale,
  colore,
  folderPath,
  onAnnulla,
  onConferma,
}: Props) {
  const [crop, setCrop] = useState<Crop>(cropIniziale);
  const src = risolviAsset(folderPath, imgPath);

  return (
    <div className={styles.backdrop} onClick={onAnnulla}>
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Modifica ritaglio — {nome}</h2>
          <p className={styles.hint}>
            Trascina l'immagine e usa la rotellina (o lo slider) per centrare il soggetto.
          </p>
        </header>

        <MaschereCircolare
          src={src}
          colore={colore ?? COLORE_NEUTRO}
          crop={crop}
          onChange={setCrop}
        />

        <footer className={styles.footer}>
          <button type="button" className={styles.btnSecondario} onClick={onAnnulla}>
            Annulla
          </button>
          <button type="button" className={styles.btnPrimario} onClick={() => onConferma(crop)}>
            Salva modifica
          </button>
        </footer>
      </div>
    </div>
  );
}
