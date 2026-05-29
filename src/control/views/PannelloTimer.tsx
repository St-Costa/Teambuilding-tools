import { useEffect, useRef, useState } from "react";
import { remainingMs, useTimerStore } from "../../state/timerStore";
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

// Campanello (1 minuto residuo): tono di campana con armonica e decay lungo.
function playCampanello() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  const durata = 1.8;
  // fondamentale
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, now);
  g1.gain.setValueAtTime(0, now);
  g1.gain.linearRampToValueAtTime(0.3, now + 0.005);
  g1.gain.exponentialRampToValueAtTime(0.001, now + durata);
  osc1.connect(g1).connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + durata);
  // armonica metallica (ratio campana ~2.756)
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(880 * 2.756, now);
  g2.gain.setValueAtTime(0, now);
  g2.gain.linearRampToValueAtTime(0.13, now + 0.005);
  g2.gain.exponentialRampToValueAtTime(0.001, now + durata * 0.55);
  osc2.connect(g2).connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + durata);
}

// Sveglia (allo scadere): 4 beep rapidi "ti ti ti ti".
const SVEGLIA_BEEP = 4;
const SVEGLIA_GAP = 0.14; // secondi tra l'inizio di ogni beep
const SVEGLIA_DURATA_TOTALE_MS = (SVEGLIA_GAP * SVEGLIA_BEEP + 1) * 1000; // + 1s pausa

function playSveglia() {
  const ctx = ctxOrNull();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let i = 0; i < SVEGLIA_BEEP; i++) {
    const t0 = now + i * SVEGLIA_GAP;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(1100, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.32, t0 + 0.005);
    g.gain.setValueAtTime(0.32, t0 + 0.07);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }
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
