import { create } from "zustand";
import {
  forceEmitScena,
  registraTimerSnapshotProvider,
  useAmbientazioneStore,
} from "./ambientazioneStore";
import type { TimerSnapshot } from "../lib/events";

export type StatoTimer = "idle" | "running" | "paused" | "ended";

export const DURATA_DEFAULT_SEC = 300;

interface TimerState {
  durationSec: number;
  stato: StatoTimer;
  targetEndAt: number | null;
  pausedRemainingMs: number;
  setDuration: (sec: number) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  markEnded: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  durationSec: DURATA_DEFAULT_SEC,
  stato: "idle",
  targetEndAt: null,
  pausedRemainingMs: 0,

  setDuration(sec) {
    const s = get();
    // modificabile solo in idle/ended (la UI dovrebbe già impedire altrimenti)
    if (s.stato !== "idle" && s.stato !== "ended") return;
    set({
      durationSec: Math.max(0, Math.floor(sec)),
      stato: "idle",
      targetEndAt: null,
      pausedRemainingMs: 0,
    });
    forceEmitScena();
  },

  start() {
    const s = get();
    if (s.stato === "paused") {
      get().resume();
      return;
    }
    if (s.durationSec <= 0) return;
    set({
      stato: "running",
      targetEndAt: Date.now() + s.durationSec * 1000,
      pausedRemainingMs: 0,
    });
    forceEmitScena();
  },

  pause() {
    const s = get();
    if (s.stato !== "running" || s.targetEndAt === null) return;
    const remaining = Math.max(0, s.targetEndAt - Date.now());
    set({
      stato: "paused",
      targetEndAt: null,
      pausedRemainingMs: remaining,
    });
    useAmbientazioneStore.getState().setImmagineFissaVisibile(false);
    forceEmitScena();
  },

  resume() {
    const s = get();
    if (s.stato !== "paused") return;
    set({
      stato: "running",
      targetEndAt: Date.now() + s.pausedRemainingMs,
      pausedRemainingMs: 0,
    });
    forceEmitScena();
  },

  reset() {
    set({
      stato: "idle",
      targetEndAt: null,
      pausedRemainingMs: 0,
    });
    useAmbientazioneStore.getState().setImmagineFissaVisibile(false);
    forceEmitScena();
  },

  markEnded() {
    const s = get();
    if (s.stato !== "running") return;
    set({
      stato: "ended",
      targetEndAt: null,
      pausedRemainingMs: 0,
    });
    forceEmitScena();
  },
}));

// Provider per ambientazioneStore.payloadCorrente: incluso sempre.
registraTimerSnapshotProvider((): TimerSnapshot => {
  const s = useTimerStore.getState();
  return {
    stato: s.stato,
    durationSec: s.durationSec,
    targetEndAt: s.targetEndAt,
    pausedRemainingMs: s.pausedRemainingMs,
  };
});

/** ms residui calcolati al momento. Funzione pura su snapshot. */
export function remainingMs(snap: TimerSnapshot, now: number = Date.now()): number {
  switch (snap.stato) {
    case "idle":
      return snap.durationSec * 1000;
    case "running":
      return Math.max(0, (snap.targetEndAt ?? 0) - now);
    case "paused":
      return snap.pausedRemainingMs;
    case "ended":
      return 0;
  }
}

/** Formatta ms come "mm:ss" (00:00 minimo). */
export function formatMmSs(ms: number): string {
  const totaleSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totaleSec / 60);
  const s = totaleSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
