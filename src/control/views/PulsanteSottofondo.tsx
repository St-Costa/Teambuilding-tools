import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { eseguiSalvataggio, useAmbientazioneStore } from "../../state/ambientazioneStore";
import styles from "./PulsanteSottofondo.module.css";

function joinPath(a: string, b: string): string {
  const sep = a.includes("\\") && !a.includes("/") ? "\\" : "/";
  return `${a.replace(/[\/\\]+$/, "")}${sep}${b}`;
}

function mimeDaPath(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  switch (m?.[1]) {
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "ogg": return "audio/ogg";
    case "m4a": case "aac": return "audio/aac";
    case "flac": return "audio/flac";
    default: return "audio/mpeg";
  }
}

export default function PulsanteSottofondo() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const setSottofondo = useAmbientazioneStore((s) => s.setSottofondo);

  const inEdit = modalita === "edit";
  const sottofondoPath = current?.sottofondoPath ?? null;
  const haSottofondo = sottofondoPath !== null;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<{ key: string; url: string } | null>(null);
  const [inRiproduzione, setInRiproduzione] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Ferma audio quando il sottofondo cambia path o si esce dall'ambientazione.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current.url);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Se il path cambia, ferma e invalida cache
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setInRiproduzione(false);
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current.url);
      blobUrlRef.current = null;
    }
  }, [sottofondoPath, folderPath]);

  if (!current || !folderPath) return null;

  async function avviaRiproduzione() {
    if (!folderPath || !sottofondoPath) return;
    setErrore(null);
    try {
      const key = `${folderPath}::${sottofondoPath}`;
      let url = blobUrlRef.current?.key === key ? blobUrlRef.current.url : null;
      if (!url) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current.url);
        const bytes = await readFile(joinPath(folderPath, sottofondoPath));
        const blob = new Blob([new Uint8Array(bytes)], { type: mimeDaPath(sottofondoPath) });
        url = URL.createObjectURL(blob);
        blobUrlRef.current = { key, url };
      }
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = 0.7;
      audio.onerror = () => {
        const code = audio.error?.code;
        const msg =
          code === 4
            ? "Formato audio non supportato (manca un codec). Prova un .wav."
            : `Errore audio (codice ${code ?? "?"})`;
        setErrore(msg);
        setInRiproduzione(false);
      };
      audio.onended = () => setInRiproduzione(false);
      audioRef.current = audio;
      await audio.play();
      setInRiproduzione(true);
    } catch (e) {
      setErrore(`Impossibile riprodurre: ${e instanceof Error ? e.message : String(e)}`);
      setInRiproduzione(false);
    }
  }

  function fermaRiproduzione() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setInRiproduzione(false);
  }

  async function caricaMp3() {
    setErrore(null);
    try {
      const scelto = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "aac"] }],
      });
      if (typeof scelto !== "string") return;
      // Se sta suonando, fermalo (il path cambierà e l'useEffect lo farebbe comunque)
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setInRiproduzione(false);
      }
      await setSottofondo(scelto);
      await eseguiSalvataggio();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    }
  }

  async function rimuoviMp3() {
    setErrore(null);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setInRiproduzione(false);
      }
      await setSottofondo(null);
      await eseguiSalvataggio();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
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
              onClick={() => setErrore(null)}
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
        onClick={() => (inRiproduzione ? fermaRiproduzione() : void avviaRiproduzione())}
        title={inRiproduzione ? "Ferma sottofondo" : "Avvia sottofondo"}
      >
        <span className={styles.icona}>{inRiproduzione ? "■" : "▶"}</span>
        <span className={styles.testo}>Sottofondo</span>
      </button>
      {errore && (
        <div className={styles.toastErrore} role="alert">
          {errore}
          <button
            type="button"
            className={styles.toastChiudi}
            onClick={() => setErrore(null)}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
