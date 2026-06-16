import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { useVotiStore } from "../../state/votiStore";
import { useLeaderboardStore } from "../../state/leaderboardStore";
import { risolviAsset } from "../../lib/storage";
import Cerchietto from "../../components/Cerchietto";
import { IconaManette } from "../../components/Icone";
import styles from "./PannelloVoti.module.css";

interface Props {
  onChiudi: () => void;
}

const DIM_TARGET = 72;
const DIM_VOTANTE = 60;

export default function PannelloVoti({ onChiudi }: Props) {
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const righe = useVotiStore((s) => s.righe);
  const votanti = useVotiStore((s) => s.votanti);
  const toggleVoto = useVotiStore((s) => s.toggleVoto);
  const azzeraVoti = useVotiStore((s) => s.azzeraVoti);
  const chiudi = useVotiStore((s) => s.chiudi);
  const avviaPrigioniero = useVotiStore((s) => s.avviaPrigioniero);
  const prigionieri = useVotiStore((s) => s.prigionieri);

  const maxVoti = righe.length > 0
    ? Math.max(...righe.map((r) => (votanti[r.personaggioId] ?? []).length))
    : 0;
  const haVoti = maxVoti > 0;
  const animazioneAttiva = prigionieri !== null && prigionieri.length > 0;

  if (!folderPath) return null;

  function handleChiudi() {
    chiudi();
    onChiudi();
  }

  // Chiude l'animazione e porta subito alla leaderboard, con i prigionieri
  // già segnati nel malus (−1).
  function handleChiudiAnimazione() {
    const idsPrigionieri = (prigionieri ?? []).map((p) => p.personaggioId);
    useLeaderboardStore.getState().apriConMalus(idsPrigionieri);
    chiudi(); // ferma ambience, resetta prigionieri, chiude i voti
    onChiudi();
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modale}>
        <header className={styles.header}>
          <h2>Voti — prigionieri</h2>
          <div className={styles.headerAzioni}>
            <button
              type="button"
              className={styles.btnAzzeraVoti}
              onClick={() => {
                if (confirm("Azzerare tutti i voti?")) azzeraVoti();
              }}
            >
              Azzera voti
            </button>
            <button type="button" className={styles.btnChiudi} onClick={handleChiudi}>
              Chiudi
            </button>
          </div>
        </header>

        <section className={styles.sezione}>
          {righe.length === 0 ? (
            <p className={styles.vuoto}>Nessun personaggio nell'ambientazione.</p>
          ) : (
            <div className={styles.griglia}>
              {righe.map((target) => {
                const votantiTarget = votanti[target.personaggioId] ?? [];
                return (
                  <div key={target.personaggioId} className={styles.riga}>
                    {/* Accusato (senza nome — riconoscibile dal cerchietto) */}
                    <div className={styles.colonnaTarget}>
                      <Cerchietto
                        src={risolviAsset(folderPath, target.imgPath)}
                        colore={target.colore}
                        crop={target.crop}
                        dimensione={DIM_TARGET}
                        alt={target.nome}
                      />
                    </div>

                    {/*
                      Griglia N colonne fisse: stessa posizione = stesso personaggio.
                      La cella del target stesso è vuota.
                    */}
                    <div
                      className={styles.colonnaVotanti}
                      style={{ gridTemplateColumns: `repeat(${righe.length}, ${DIM_VOTANTE + 12}px)` }}
                    >
                      {righe.map((v) => {
                        if (v.personaggioId === target.personaggioId) {
                          return <div key={v.personaggioId} className={styles.cellVuota} />;
                        }
                        const acceso = votantiTarget.includes(v.personaggioId);
                        return (
                          <button
                            key={v.personaggioId}
                            type="button"
                            className={`${styles.btnVotante} ${acceso ? styles.acceso : styles.spento}`}
                            onClick={() => toggleVoto(target.personaggioId, v.personaggioId)}
                            title={`${acceso ? "Rimuovi voto di" : "Aggiungi voto di"} ${v.nome} per ${target.nome}`}
                            aria-label={`${v.nome} vota per ${target.nome}`}
                            aria-pressed={acceso}
                          >
                            <Cerchietto
                              src={risolviAsset(folderPath, v.imgPath)}
                              colore={v.colore}
                              crop={v.crop}
                              dimensione={DIM_VOTANTE}
                              alt={v.nome}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className={styles.footer}>
          {animazioneAttiva ? (
            <button
              type="button"
              className={styles.btnChiudiAnimazione}
              onClick={handleChiudiAnimazione}
            >
              Chiudi e vai alla leaderboard
            </button>
          ) : (
            <button
              type="button"
              className={styles.btnIncarcerai}
              disabled={!haVoti}
              title={haVoti ? "Mostra l'animazione di incarcerazione sulla proiezione" : "Assegna almeno un voto prima di incarcerare"}
              onClick={avviaPrigioniero}
            >
              <IconaManette dimensione={18} />
              Incarcerai
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
