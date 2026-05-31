import { useEffect, useRef, useState } from "react";
import { remainingMs, useTimerStore } from "../../state/timerStore";
import { forceEmitScena } from "../../state/ambientazioneStore";
import {
  playCampanello,
  playInizioTimer,
  playSveglia,
  SVEGLIA_DURATA_TOTALE_MS,
} from "../../lib/audio";
import styles from "./PannelloTimer.module.css";

const TICK_MS = 200;
// Cadenza con cui la regia (finestra a fuoco, non throttlata) ri-emette lo
// stato verso la proiezione mentre il timer scorre. La proiezione spesso NON ha
// il focus → WebKitGTK ne rallenta rAF/timer locali; questa spinta a ~4/sec è
// il vero motore dell'aggiornamento ed elimina lo scatto del conteggio. Payload
// piccolo, costo trascurabile.
const RIEMISSIONE_MS = 250;

// ───────── audio: via + 1-min warning + scaduto intermittente ──────────
// Deroga a CLAUDE.md §0 confermata dall'utente. Suoni sintetizzati in
// lib/audio.ts (niente file). Suonati SOLO dalla regia, dove l'utente ha
// interagito e il contesto audio è sbloccato.

export default function PannelloTimer() {
  const stato = useTimerStore((s) => s.stato);
  const durationSec = useTimerStore((s) => s.durationSec);
  const targetEndAt = useTimerStore((s) => s.targetEndAt);
  const pausedRemainingMs = useTimerStore((s) => s.pausedRemainingMs);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const reset = useTimerStore((s) => s.reset);
  const setDuration = useTimerStore((s) => s.setDuration);
  const markEnded = useTimerStore((s) => s.markEnded);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (stato !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [stato]);

  // Rete di sicurezza per la fluidità del timer in proiezione: la regia (a
  // fuoco) ri-emette lo stato 1 volta/sec mentre scorre, così la proiezione si
  // ridisegna anche se i suoi timer locali vengono throttlati dal sistema.
  useEffect(() => {
    if (stato !== "running") return;
    const id = setInterval(forceEmitScena, RIEMISSIONE_MS);
    return () => clearInterval(id);
  }, [stato]);

  // "Via!" all'avvio del conteggio: suona quando si entra in running (sia da
  // idle sia riprendendo da pausa), così tutti capiscono che il tempo scorre.
  const statoPrecRef = useRef(stato);
  useEffect(() => {
    if (stato === "running" && statoPrecRef.current !== "running") {
      playInizioTimer();
    }
    statoPrecRef.current = stato;
  }, [stato]);

  const ms = remainingMs(
    { stato, durationSec, targetEndAt, pausedRemainingMs },
    Date.now(),
  );

  // markEnded() quando arriva a 0 (regia "autoritativa" — il timerStore
  // accetta solo da running e ignora altrove).
  useEffect(() => {
    if (stato === "running" && ms <= 0) markEnded();
  }, [ms, stato, markEnded]);

  // Campanello al primo passaggio sotto il minuto residuo (una volta per ciclo).
  const oneMinPlayedRef = useRef(false);
  useEffect(() => {
    if (stato !== "running") {
      oneMinPlayedRef.current = false;
      return;
    }
    if (!oneMinPlayedRef.current && ms <= 60_000 && ms > 0) {
      oneMinPlayedRef.current = true;
      playCampanello();
    }
  }, [stato, ms]);

  // Allo scadere: sveglia "ti ti ti ti" subito + ripete fino al reset.
  useEffect(() => {
    if (stato !== "ended") return;
    playSveglia();
    const id = setInterval(playSveglia, SVEGLIA_DURATA_TOTALE_MS);
    return () => clearInterval(id);
  }, [stato]);

  const modificabile = stato === "idle" || stato === "ended";
  const minIniz = Math.floor(durationSec / 60);
  const secIniz = durationSec % 60;

  function handleMinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const m = Math.max(0, Math.min(99, Number(e.target.value) || 0));
    setDuration(m * 60 + secIniz);
  }
  function handleSecChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sec = Math.max(0, Math.min(59, Number(e.target.value) || 0));
    setDuration(minIniz * 60 + sec);
  }

  const iconaToggle =
    stato === "running" ? "❚❚" : "▶";
  const titleToggle =
    stato === "running"
      ? "Pausa"
      : stato === "paused"
        ? "Riprendi"
        : "Avvia";
  const onToggle =
    stato === "running" ? pause : start; // start() gestisce sia idle che paused

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={`${styles.btnToggle} ${stato === "running" ? styles.btnPausa : styles.btnAvvia}`}
        onClick={onToggle}
        disabled={stato === "idle" && durationSec <= 0}
        title={titleToggle}
        aria-label={titleToggle}
      >
        {iconaToggle}
      </button>
      <button
        type="button"
        className={styles.btnReset}
        onClick={reset}
        title="Reset (riporta alla durata configurata)"
        aria-label="Reset"
      >
        ■
      </button>
      <div
        className={styles.gruppoDurata}
        title={modificabile ? "Imposta durata" : "Reset per cambiare durata"}
      >
        <input
          type="number"
          className={styles.inputDurata}
          min={0}
          max={99}
          step={1}
          value={minIniz}
          onChange={handleMinChange}
          disabled={!modificabile}
        />
        <span className={styles.duePunti}>:</span>
        <input
          type="number"
          className={styles.inputDurata}
          min={0}
          max={59}
          step={1}
          value={secIniz}
          onChange={handleSecChange}
          disabled={!modificabile}
        />
      </div>
    </div>
  );
}
