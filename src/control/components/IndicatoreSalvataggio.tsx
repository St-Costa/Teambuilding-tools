import { useEffect, useState } from "react";
import { eseguiSalvataggio, useAmbientazioneStore } from "../../state/ambientazioneStore";
import styles from "./IndicatoreSalvataggio.module.css";

function tempoRelativo(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 5) return "ora";
  if (diffSec < 60) return `${diffSec}s fa`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m fa`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h fa`;
  return `${Math.floor(h / 24)}g fa`;
}

export default function IndicatoreSalvataggio() {
  const saveStatus = useAmbientazioneStore((s) => s.saveStatus);
  const lastSavedAt = useAmbientazioneStore((s) => s.lastSavedAt);
  const lastError = useAmbientazioneStore((s) => s.lastError);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [saveStatus]);

  if (saveStatus === "idle") return null;

  if (saveStatus === "error") {
    return (
      <div className={`${styles.root} ${styles.errore}`}>
        <span className={styles.dot} aria-hidden="true" />
        <span>Errore di salvataggio{lastError ? `: ${lastError}` : ""}</span>
        <button onClick={() => void eseguiSalvataggio()} className={styles.retry}>
          Riprova
        </button>
      </div>
    );
  }

  if (saveStatus === "saving") {
    return (
      <div className={`${styles.root} ${styles.saving}`}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>Salvataggio in corso…</span>
      </div>
    );
  }

  if (saveStatus === "dirty") {
    return (
      <div className={`${styles.root} ${styles.dirty}`}>
        <span className={styles.dot} aria-hidden="true" />
        <span>Modifiche in attesa di salvataggio…</span>
      </div>
    );
  }

  return (
    <div className={`${styles.root} ${styles.saved}`}>
      <span className={styles.check} aria-hidden="true">✓</span>
      <span>Salvato {lastSavedAt ? tempoRelativo(lastSavedAt) : ""}</span>
    </div>
  );
}
