import { useState } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { risolviAsset } from "../../lib/storage";
import { oggettoDi } from "../../lib/ambientazione";
import Cerchietto from "../../components/Cerchietto";
import Quadratino from "../../components/Quadratino";
import styles from "./PannelloGioco.module.css";

export default function PannelloGioco() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const assegnaOggetto = useAmbientazioneStore((s) => s.assegnaOggettoAPersonaggio);

  const [popoverPer, setPopoverPer] = useState<string | null>(null);

  if (!current || !folderPath) return null;

  const oggetti = current.oggetti;

  function handleAssegna(personaggioId: string, oggettoId: string | null) {
    setPopoverPer(null);
    assegnaOggetto(personaggioId, oggettoId);
  }

  return (
    <aside className={styles.root}>
      {current.personaggi.map((p) => {
        const oggetto = oggettoDi(p, oggetti);
        const popoverAperto = popoverPer === p.id;
        return (
          <div key={p.id} className={styles.riga}>
            <div className={styles.cerchiettoBox}>
              <Cerchietto
                src={risolviAsset(folderPath, p.imgPath)}
                colore={p.colore}
                crop={p.crop}
                dimensione={92}
                alt={p.nome}
              />
              <span className={styles.nome}>{p.nome}</span>
            </div>
            <div className={styles.slotOggettoWrap}>
              <button
                type="button"
                className={`${styles.slotOggetto} ${oggetto ? "" : styles.slotVuoto}`}
                onClick={() => setPopoverPer(popoverAperto ? null : p.id)}
                title={oggetto ? `${oggetto.nome} — clic per cambiare` : "Assegna oggetto"}
              >
                {oggetto ? (
                  <Quadratino
                    src={risolviAsset(folderPath, oggetto.imgPath)}
                    crop={oggetto.crop}
                    dimensione={62}
                    coloreBordo={p.colore}
                    alt={oggetto.nome}
                  />
                ) : (
                  <span className={styles.slotPiu}>+</span>
                )}
              </button>
              {popoverAperto && (
                <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
                  {oggetti.length === 0 ? (
                    <p className={styles.popoverVuoto}>Nessun oggetto disponibile.</p>
                  ) : (
                    <>
                      {oggetto && (
                        <button
                          type="button"
                          className={styles.popoverItem}
                          onClick={() => handleAssegna(p.id, null)}
                          title="Rimuovi oggetto dal personaggio"
                        >
                          <span className={styles.iconaRimuovi} aria-hidden="true">
                            ⊘
                          </span>
                          <span className={styles.popoverNome}>Rimuovi oggetto</span>
                        </button>
                      )}
                      {oggetti.map((o) => {
                        const assegnatoA = current!.personaggi.find(
                          (x) => x.id !== p.id && x.oggettoId === o.id,
                        );
                        const scelto = o.id === p.oggettoId;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            className={`${styles.popoverItem} ${scelto ? styles.popoverItemScelto : ""}`}
                            onClick={() => handleAssegna(p.id, o.id)}
                            title={assegnatoA ? `Attualmente di ${assegnatoA.nome}` : o.nome}
                          >
                            <Quadratino
                              src={risolviAsset(folderPath, o.imgPath)}
                              crop={o.crop}
                              dimensione={32}
                              alt={o.nome}
                            />
                            <span className={styles.popoverNome}>
                              {o.nome}
                              {assegnatoA && (
                                <span className={styles.popoverAssegnato}>
                                  (di {assegnatoA.nome})
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
