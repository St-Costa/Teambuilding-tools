import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import IndicatoreSalvataggio from "../components/IndicatoreSalvataggio";
import styles from "./AmbientazioneAperta.module.css";

export default function AmbientazioneAperta() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const saveStatus = useAmbientazioneStore((s) => s.saveStatus);
  const modifica = useAmbientazioneStore((s) => s.modifica);
  const chiudi = useAmbientazioneStore((s) => s.chiudi);

  if (!current) return null;

  function handleChiudi() {
    if (saveStatus !== "saved") {
      const ok = confirm("Ci sono modifiche non ancora salvate. Vuoi davvero chiudere?");
      if (!ok) return;
    }
    chiudi();
  }

  function handleRinomina() {
    if (!current) return;
    const nuovo = prompt("Nuovo nome dell'ambientazione:", current.nome);
    if (nuovo === null) return;
    const trimmed = nuovo.trim();
    if (trimmed === "" || trimmed === current.nome) return;
    modifica((draft) => {
      draft.nome = trimmed;
    });
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerSinistra}>
          <h1 className={styles.nome}>{current.nome}</h1>
          <p className={styles.path} title={folderPath ?? ""}>{folderPath}</p>
        </div>
        <div className={styles.headerDestra}>
          <IndicatoreSalvataggio />
          <button className={styles.btnChiudi} onClick={handleChiudi}>
            Chiudi ambientazione
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <p className={styles.placeholder}>
          Qui andranno mappa, personaggi e oggetti. Sono in lavorazione nelle
          milestone successive.
        </p>
        <button className={styles.btnTest} onClick={handleRinomina} title="Pulsante temporaneo per verificare l'autosave end-to-end">
          Rinomina (test M3)
        </button>
      </main>
    </div>
  );
}
