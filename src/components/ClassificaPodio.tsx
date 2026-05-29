import type { RigaLeaderboardSnap } from "../lib/events";
import { risolviAsset } from "../lib/storage";
import Cerchietto from "./Cerchietto";
import { IconaCorona } from "./Icone";
import styles from "./ClassificaPodio.module.css";

interface Props {
  righe: RigaLeaderboardSnap[];
  folderPath: string;
  dimensioneCerchietto: number;
}

export default function ClassificaPodio({ righe, folderPath, dimensioneCerchietto }: Props) {
  if (righe.length === 0) return null;

  // Ordinata per punteggio decrescente (stable sort: parità mantiene l'ordine
  // d'inserimento → tie-break per ordine di creazione del personaggio).
  const ordinate = [...righe].sort((a, b) => b.totale - a.totale);
  const maxTotale = ordinate[0].totale;

  const dim = dimensioneCerchietto;
  const fontNome = Math.round(dim * 0.2);
  const fontPunteggio = Math.round(dim * 0.42);
  const fontCorona = Math.round(dim * 0.55);

  return (
    <div className={styles.root}>
      {ordinate.map((r) => {
        const vincitore = r.totale === maxTotale;
        return (
          <div
            key={r.personaggioId}
            className={`${styles.entry} ${vincitore ? styles.entryVincitore : ""}`}
          >
            <div
              className={styles.cerchiettoWrap}
              style={{ width: dim, height: dim }}
            >
              {vincitore && (
                <div className={styles.corona} style={{ color: "#ffcc33" }} aria-hidden="true">
                  <IconaCorona dimensione={fontCorona} />
                </div>
              )}
              <div className={`${styles.alone} ${vincitore ? styles.aloneVincitore : ""}`}>
                <Cerchietto
                  src={risolviAsset(folderPath, r.imgPath)}
                  colore={r.colore}
                  crop={r.crop}
                  dimensione={dim}
                  alt={r.nome}
                />
              </div>
            </div>
            <div className={styles.nome} style={{ fontSize: fontNome }}>
              {r.nome}
            </div>
            <div
              className={`${styles.punteggio} ${r.totale < 0 ? styles.punteggioNegativo : ""}`}
              style={{ fontSize: fontPunteggio }}
            >
              {r.totale}
            </div>
          </div>
        );
      })}
    </div>
  );
}
