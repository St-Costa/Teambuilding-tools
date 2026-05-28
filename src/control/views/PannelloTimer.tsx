import { useEffect, useRef, useState } from "react";
import { formatMmSs, remainingMs, useTimerStore } from "../../state/timerStore";
import styles from "./PannelloTimer.module.css";

const TICK_MS = 200;

// ───────── audio: 1-min warning + scaduto intermittente ──────────
// Deroga a CLAUDE.md §0 confermata dall'utente in M8.1 (estensione della
// stessa eccezione del tick ruota M6). Audio sintetizzato in Web Audio API,
// niente file. Suonato SOLO dalla regia (autoplay-safe: l'utente ha cliccato
// "Avvia").

let audioCtxCache: AudioContext | null = null;
function ctxOrNull(): AudioContext | null {
  try {
    if (!audioCtxCache) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtxCache = new Ctor();
    }
    if (audioCtxCache.state === "suspended") void audioCtxCache.resume();
    return audioCtxCache;
  } catch {
    return null;
  }
}

function playBeepLungo() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(620, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
  gain.gain.setValueAtTime(0.3, now + 0.48);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.6);
}

function playBeepBreve() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(820, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.32, now + 0.008);
  gain.gain.setValueAtTime(0.32, now + 0.16);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

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

  const ms = remainingMs(
    { stato, durationSec, targetEndAt, pausedRemainingMs },
    Date.now(),
  );

  // markEnded() quando arriva a 0 (regia "autoritativa" — il timerStore
  // accetta solo da running e ignora altrove).
  useEffect(() => {
    if (stato === "running" && ms <= 0) markEnded();
  }, [ms, stato, markEnded]);

  // Beep lungo all'attraversamento del minuto finale, una sola volta per ciclo.
  const oneMinPlayedRef = useRef(false);
  useEffect(() => {
    if (stato !== "running") {
      oneMinPlayedRef.current = false;
      return;
    }
    if (!oneMinPlayedRef.current && ms <= 60_000 && ms > 0) {
      oneMinPlayedRef.current = true;
      playBeepLungo();
    }
  }, [stato, ms]);

  // Allo scadere: beep breve subito + ogni 2 secondi finché stato resta ended.
  useEffect(() => {
    if (stato !== "ended") return;
    playBeepBreve();
    const id = setInterval(playBeepBreve, 2000);
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

  const labelToggle =
    stato === "running"
      ? "Pausa"
      : stato === "paused"
        ? "Riprendi"
        : "Avvia";
  const onToggle =
    stato === "running" ? pause : start; // start() gestisce sia idle che paused

  return (
    <div className={styles.root}>
      <div
        className={`${styles.display} ${stato === "ended" ? styles.displayScaduto : ""} ${stato === "paused" ? styles.displayPausa : ""}`}
        title={`Timer (${stato})`}
      >
        {formatMmSs(ms)}
      </div>
      <button
        type="button"
        className={`${styles.btnToggle} ${stato === "running" ? styles.btnPausa : styles.btnAvvia}`}
        onClick={onToggle}
        disabled={stato === "idle" && durationSec <= 0}
      >
        {labelToggle}
      </button>
      <button
        type="button"
        className={styles.btnReset}
        onClick={reset}
        title="Riporta il timer alla durata configurata"
      >
        Reset
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
