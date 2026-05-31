import type { LeaderboardSnapshot } from "../lib/events";
import { risolviAsset } from "../lib/storage";
import { useViewport } from "../lib/useViewport";
import Cerchietto from "./Cerchietto";
import ClassificaPodio from "./ClassificaPodio";
import styles from "./ScenaLeaderboard.module.css";

interface Props {
  snapshot: LeaderboardSnapshot;
  folderPath: string;
}

// Cerchietti come frazione del lato minore dello schermo (vmin), non in px
// fissi: scalano col proiettore.
const FRAZIONE_CERCHIETTO = 0.075;
const FRAZIONE_CERCHIETTO_PODIO = 0.11;

export default function ScenaLeaderboard({ snapshot, folderPath }: Props) {
  const { w, h } = useViewport();
  const vmin = Math.min(w, h);
  const dimCerchietto = Math.round(vmin * FRAZIONE_CERCHIETTO);
  const dimCerchiettoPodio = Math.round(vmin * FRAZIONE_CERCHIETTO_PODIO);

  function labelObiettivo(idx: 0 | 1 | 2): string {
    return (snapshot.obiettivi[idx] ?? "").trim() || `Obiettivo ${idx + 1}`;
  }

  return (
    <div className={styles.root}>
      <h1 className={styles.titolo}>Leaderboard</h1>
      <div className={styles.tabella}>
        <div className={`${styles.riga} ${styles.rigaHeader}`}>
          <div className={styles.cellaPersonaggio} />
          {([0, 1, 2] as const).map((idx) => (
            <div
              key={idx}
              className={`${styles.cellaObiettivo} ${idx === 2 ? styles.cellaObiettivoMalus : ""}`}
            >
              {labelObiettivo(idx)}
            </div>
          ))}
          <div className={styles.cellaTotaleHeader}>Tot.</div>
        </div>
        {snapshot.righe.map((r) => (
          <div key={r.personaggioId} className={styles.riga}>
            <div className={styles.cellaPersonaggio}>
              <Cerchietto
                src={risolviAsset(folderPath, r.imgPath)}
                colore={r.colore}
                crop={r.crop}
                dimensione={dimCerchietto}
                alt={r.nome}
              />
              <span className={styles.nome}>{r.nome}</span>
            </div>
            {([0, 1, 2] as const).map((idx) => (
              <div
                key={idx}
                className={`${styles.cellaTick} ${r.tick[idx] ? (idx === 2 ? styles.cellaTickMalusOn : styles.cellaTickOn) : ""}`}
              >
                {r.tick[idx] && (
                  <span
                    className={`${styles.checkmark} ${idx === 2 ? styles.checkmarkMalus : ""}`}
                  >
                    {idx === 2 ? "✗" : "✓"}
                  </span>
                )}
              </div>
            ))}
            <div className={styles.cellaTotale}>
              <span
                className={`${styles.totaleNumero} ${r.totale < 0 ? styles.totaleNegativo : ""}`}
              >
                {r.totale}
              </span>
            </div>
          </div>
        ))}
      </div>
      {snapshot.righe.length > 0 && (
        <div className={styles.podioWrap}>
          <ClassificaPodio
            righe={snapshot.righe}
            folderPath={folderPath}
            dimensioneCerchietto={dimCerchiettoPodio}
          />
        </div>
      )}
    </div>
  );
}
