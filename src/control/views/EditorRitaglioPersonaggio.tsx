import { useState } from "react";
import type { Crop, Personaggio } from "../../lib/ambientazione";
import { risolviAsset } from "../../lib/storage";
import MaschereCircolare from "../components/MaschereCircolare";
import styles from "./EditorRitaglioPersonaggio.module.css";

interface Props {
  personaggio: Personaggio;
  folderPath: string;
  onAnnulla: () => void;
  onConferma: (crop: Crop) => void;
}

export default function EditorRitaglioPersonaggio({
  personaggio,
  folderPath,
  onAnnulla,
  onConferma,
}: Props) {
  const [crop, setCrop] = useState<Crop>(personaggio.crop);
  const src = risolviAsset(folderPath, personaggio.imgPath);

  return (
    <div className={styles.backdrop} onClick={onAnnulla}>
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Modifica ritaglio — {personaggio.nome}</h2>
          <p className={styles.hint}>
            Trascina l'immagine e usa la rotellina (o lo slider) per centrare la faccia.
          </p>
        </header>

        <MaschereCircolare
          src={src}
          colore={personaggio.colore}
          crop={crop}
          onChange={setCrop}
        />

        <footer className={styles.footer}>
          <button type="button" className={styles.btnSecondario} onClick={onAnnulla}>
            Annulla
          </button>
          <button
            type="button"
            className={styles.btnPrimario}
            onClick={() => onConferma(crop)}
          >
            Salva modifica
          </button>
        </footer>
      </div>
    </div>
  );
}
