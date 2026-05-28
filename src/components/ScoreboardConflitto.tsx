import type { ConflittoSnapshot } from "../lib/events";
import { risolviAsset } from "../lib/storage";
import Cerchietto from "./Cerchietto";
import styles from "./ScoreboardConflitto.module.css";

interface Props {
  snapshot: ConflittoSnapshot;
  folderPath: string;
  dimensioneFaccia?: number;
}

export default function ScoreboardConflitto({
  snapshot,
  folderPath,
  dimensioneFaccia = 110,
}: Props) {
  const { partecipanti, fette, vincitoreId, fase } = snapshot;
  const fettaPerId = new Map(fette.map((f) => [f.id, f]));

  return (
    <div className={styles.root}>
      {partecipanti.map((p) => {
        const f = fettaPerId.get(p.personaggioId);
        if (!f) return null;
        const perc = (f.totaleFrazione * 100).toFixed(1);
        const vincitore = vincitoreId === p.personaggioId && fase === "risultato";
        return (
          <div
            key={p.personaggioId}
            className={`${styles.card} ${vincitore ? styles.cardVincitore : ""}`}
            style={vincitore ? { borderColor: p.colore } : undefined}
          >
            <Cerchietto
              src={risolviAsset(folderPath, p.imgPath)}
              colore={p.colore}
              crop={p.crop}
              dimensione={dimensioneFaccia}
              alt={p.nome}
            />
            <div className={styles.testo}>
              <span className={styles.nome}>{p.nome}</span>
              <span className={styles.percent} style={{ color: p.colore }}>
                {perc}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
