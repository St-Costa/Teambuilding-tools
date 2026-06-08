import { open } from "@tauri-apps/plugin-dialog";
import { eseguiSalvataggio, useAmbientazioneStore } from "../../state/ambientazioneStore";
import styles from "./PulsanteSottofondo.module.css";

export default function PulsanteImmagineFissa() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const impostaImmagineFissa = useAmbientazioneStore((s) => s.impostaImmagineFissa);
  const immagineFissaVisibile = useAmbientazioneStore((s) => s.immagineFissaVisibile);
  const setImmagineFissaVisibile = useAmbientazioneStore((s) => s.setImmagineFissaVisibile);

  const inEdit = modalita === "edit";
  const immagineFissaPath = current?.immagineFissaPath ?? null;
  const haImmagine = immagineFissaPath !== null;

  if (!current || !folderPath) return null;

  async function caricaImmagine() {
    try {
      const scelto = await open({
        multiple: false,
        filters: [{ name: "Immagini", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (typeof scelto !== "string") return;
      await impostaImmagineFissa(scelto);
      await eseguiSalvataggio();
    } catch {
      // errore silenzioso: l'utente ha annullato o c'è stato un problema
    }
  }

  async function rimuoviImmagine() {
    try {
      setImmagineFissaVisibile(false);
      await impostaImmagineFissa(null);
      await eseguiSalvataggio();
    } catch {
      // errore silenzioso
    }
  }

  if (inEdit) {
    return (
      <div className={styles.root}>
        <button
          type="button"
          className={`${styles.btnPrincipale} ${haImmagine ? styles.configurato : styles.daConfigurare}`}
          onClick={() => void caricaImmagine()}
          title={haImmagine ? "Cambia screensaver" : "Carica immagine screensaver"}
        >
          <span className={styles.icona}>🖼</span>
          <span className={styles.testo}>
            Screensaver
            {haImmagine && (
              <span className={styles.nomeFile}>
                {immagineFissaPath?.split(/[/\\]/).pop()}
              </span>
            )}
          </span>
        </button>
        {haImmagine && (
          <button
            type="button"
            className={styles.btnRimuovi}
            onClick={() => void rimuoviImmagine()}
            title="Rimuovi l'immagine fissa"
            aria-label="Rimuovi immagine fissa"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // Play mode: solo se c'è un'immagine configurata
  if (!haImmagine) return null;
  return (
    <div className={styles.root}>
      <button
        type="button"
        className={`${styles.btnPrincipale} ${immagineFissaVisibile ? styles.inPlay : styles.configurato}`}
        onClick={() => setImmagineFissaVisibile(!immagineFissaVisibile)}
        title={immagineFissaVisibile ? "Nascondi screensaver" : "Mostra screensaver sullo schermo"}
      >
        <span className={styles.icona}>{immagineFissaVisibile ? "✕" : "🖼"}</span>
        <span className={styles.testo}>Screensaver</span>
      </button>
    </div>
  );
}
