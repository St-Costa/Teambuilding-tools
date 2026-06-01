import { useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { eseguiSalvataggio, useAmbientazioneStore } from "../../state/ambientazioneStore";
import { resetSottofondoCache, useSottofondoStore } from "../../lib/sottofondo";
import styles from "./PulsanteSottofondo.module.css";

export default function PulsanteSottofondo() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const setSottofondo = useAmbientazioneStore((s) => s.setSottofondo);

  const inEdit = modalita === "edit";
  const sottofondoPath = current?.sottofondoPath ?? null;
  const haSottofondo = sottofondoPath !== null;

  const inRiproduzione = useSottofondoStore((s) => s.inRiproduzione);
  const errore = useSottofondoStore((s) => s.errore);
  const volume = useSottofondoStore((s) => s.volume);
  const setVolume = useSottofondoStore((s) => s.setVolume);
  const avvia = useSottofondoStore((s) => s.avvia);
  const ferma = useSottofondoStore((s) => s.ferma);

  // Se cambia file/cartella (o si esce dall'ambientazione), ferma e invalida cache.
  useEffect(() => {
    resetSottofondoCache();
  }, [sottofondoPath, folderPath]);

  // Ferma alla dismissione del componente.
  useEffect(() => {
    return () => resetSottofondoCache();
  }, []);

  if (!current || !folderPath) return null;

  async function caricaMp3() {
    try {
      const scelto = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "aac"] }],
      });
      if (typeof scelto !== "string") return;
      ferma();
      await setSottofondo(scelto);
      await eseguiSalvataggio();
    } catch (e) {
      useSottofondoStore.setState({ errore: e instanceof Error ? e.message : String(e) });
    }
  }

  async function rimuoviMp3() {
    try {
      ferma();
      await setSottofondo(null);
      await eseguiSalvataggio();
    } catch (e) {
      useSottofondoStore.setState({ errore: e instanceof Error ? e.message : String(e) });
    }
  }

  // --- RENDER ---
  if (inEdit) {
    return (
      <div className={styles.root}>
        <button
          type="button"
          className={`${styles.btnPrincipale} ${haSottofondo ? styles.configurato : styles.daConfigurare}`}
          onClick={() => void caricaMp3()}
          title={haSottofondo ? "Cambia file di sottofondo" : "Scegli un MP3 di sottofondo"}
        >
          <span className={styles.icona}>{haSottofondo ? "♪" : "+"}</span>
          <span className={styles.testo}>
            Sottofondo
            {haSottofondo && (
              <span className={styles.nomeFile}>
                {sottofondoPath?.split(/[/\\]/).pop()}
              </span>
            )}
          </span>
        </button>
        {haSottofondo && (
          <button
            type="button"
            className={styles.btnRimuovi}
            onClick={() => void rimuoviMp3()}
            title="Rimuovi il sottofondo"
            aria-label="Rimuovi sottofondo"
          >
            ×
          </button>
        )}
        {errore && (
          <div className={styles.toastErrore} role="alert">
            {errore}
            <button
              type="button"
              className={styles.toastChiudi}
              onClick={() => useSottofondoStore.setState({ errore: null })}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
        )}
      </div>
    );
  }

  // Play mode
  if (!haSottofondo) return null;
  return (
    <div className={styles.root}>
      <button
        type="button"
        className={`${styles.btnPrincipale} ${inRiproduzione ? styles.inPlay : styles.configurato}`}
        onClick={() => (inRiproduzione ? ferma() : void avvia(folderPath, sottofondoPath))}
        title={inRiproduzione ? "Ferma sottofondo" : "Avvia sottofondo"}
      >
        <span className={styles.icona}>{inRiproduzione ? "■" : "▶"}</span>
        <span className={styles.testo}>Sottofondo</span>
      </button>
      <span className={styles.iconaVol} aria-hidden="true">🔊</span>
      <input
        type="range"
        className={styles.volume}
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => setVolume(Number(e.target.value))}
        title={`Volume sottofondo: ${Math.round(volume * 100)}%`}
        aria-label="Volume sottofondo"
      />
      {errore && (
        <div className={styles.toastErrore} role="alert">
          {errore}
          <button
            type="button"
            className={styles.toastChiudi}
            onClick={() => useSottofondoStore.setState({ errore: null })}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
