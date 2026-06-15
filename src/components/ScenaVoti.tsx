import type { VotiSnapshot } from "../lib/events";
import { risolviAsset } from "../lib/storage";
import Cerchietto from "./Cerchietto";
import { IconaManette } from "./Icone";
import { useViewport } from "../lib/useViewport";
import styles from "./ScenaVoti.module.css";

interface Props {
  snapshot: VotiSnapshot;
  folderPath: string;
  sfondoSrc: string | null;
}

export default function ScenaVoti({ snapshot, folderPath, sfondoSrc }: Props) {
  const { w, h } = useViewport();

  const numChars = snapshot.righe.length || 1;

  // Gap tra colonne: pochi pixel dinamici; il padding interno è ridotto per compensare.
  const gapPx = Math.max(8, Math.floor(w * 0.008));
  // colWidth esclude i gap così il totale resta dentro il 90% della larghezza
  const colWidth = Math.floor((w * 0.90 - (numChars - 1) * gapPx) / numChars);
  // Cerchietto principale: 0.87 di colWidth dimezza lo spazio tra cerchio e bordo rettangolo.
  // Limite h*0.30 evita overflow verticale con pochi personaggi.
  const dimTarget = Math.min(Math.floor(colWidth * 0.87), Math.floor(h * 0.30));
  // Cerchietti votanti
  const dimVotante = Math.max(Math.floor(dimTarget * 0.42), 20);
  const voterAreaH = dimVotante * 2 + 8;
  // Manette
  const manetteSize = Math.max(Math.floor(dimTarget * 0.52), 40);
  const manetteGap = 8;

  // Font base aumentato (0.25 vs 0.19) perché il padding ridotto "libera" spazio al testo
  const nameFontSizeBase = Math.max(Math.floor(dimTarget * 0.25), 11);
  const nameFontSizeMax = Math.floor((colWidth * 0.88) / 0.60);

  // Font size uguale per tutti: prende il minimo adattivo tra tutti i nomi
  const nomeFontSize = snapshot.righe.reduce((minSz, r) => {
    const fitted = Math.max(
      Math.min(nameFontSizeBase, Math.floor(nameFontSizeMax / r.target.nome.length)),
      8
    );
    return Math.min(minSz, fitted);
  }, nameFontSizeBase);

  const nomeH = Math.ceil(nameFontSizeBase * 1.2);

  const maxVoti = Math.max(...snapshot.righe.map((r) => r.votanti.length), 0);

  return (
    <div className={styles.root}>
      {sfondoSrc && (
        <img src={sfondoSrc} className={styles.sfondo} alt="" aria-hidden="true" />
      )}
      <div className={styles.contenuto}>
        <div className={styles.rigaPersonaggi} style={{ gap: gapPx }}>
          {snapshot.righe.map((r) => {
            const isTop = maxVoti > 0 && r.votanti.length === maxVoti;

            return (
              <div
                key={r.target.personaggioId}
                className={`${styles.colonnaPersonaggio} ${isTop ? styles.colonnaTop : ""}`}
                style={{ width: colWidth, minWidth: colWidth, boxSizing: "border-box" }}
              >
                {/* Manette: sempre nel DOM a dimensione fissa, invisible se non top */}
                <span
                  className={styles.manette}
                  style={{ visibility: isTop ? "visible" : "hidden", height: manetteSize + manetteGap }}
                >
                  <IconaManette dimensione={manetteSize} />
                </span>

                <Cerchietto
                  src={risolviAsset(folderPath, r.target.imgPath)}
                  colore={r.target.colore}
                  crop={r.target.crop}
                  dimensione={dimTarget}
                  alt={r.target.nome}
                />

                {/* Nome: font uguale per tutti i personaggi, adattato al nome più lungo */}
                <span
                  className={styles.nomeTarget}
                  style={{ fontSize: nomeFontSize, lineHeight: 1.2, height: nomeH }}
                >
                  {r.target.nome}
                </span>

                {/* Area votanti: altezza fissa, griglia 2 colonne */}
                <div
                  className={styles.rigaVotanti}
                  style={{ height: voterAreaH, gridTemplateColumns: `repeat(2, ${dimVotante}px)` }}
                >
                  {r.votanti.map((v) => (
                    <Cerchietto
                      key={v.personaggioId}
                      src={risolviAsset(folderPath, v.imgPath)}
                      colore={v.colore}
                      crop={v.crop}
                      dimensione={dimVotante}
                      alt={v.nome}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
