// Registro dei "snapshot provider" degli altri store (conflitto, timer,
// leaderboard, vittoria, presentazione).
//
// Perché esiste: la ScenaPayload emessa verso la proiezione aggrega lo stato di
// più store. Se `ambientazioneStore` importasse direttamente quegli store si
// creerebbe un import circolare (ognuno di essi importa `forceEmitScena` da
// `ambientazioneStore`). Soluzione: ciascuno store si REGISTRA qui al proprio
// boot fornendo una funzione che restituisce il suo snapshot corrente, e
// `ambientazioneStore` li legge tramite `leggiSnapshot()` senza conoscerli.
//
// Questo modulo era inline in `ambientazioneStore.ts`; estratto per separare il
// wiring cross-store dalla logica dello store. Comportamento invariato.

import type {
  ConflittoSnapshot,
  TimerSnapshot,
  LeaderboardSnapshot,
  VittoriaSnapshot,
  PresentazioneSnapshot,
  VotiSnapshot,
} from "../lib/events";

type ConflittoSnapshotFn = () => ConflittoSnapshot | null;
let conflittoSnapshotProvider: ConflittoSnapshotFn | null = null;
export function registraConflittoSnapshotProvider(fn: ConflittoSnapshotFn | null): void {
  conflittoSnapshotProvider = fn;
}

type TimerSnapshotFn = () => TimerSnapshot;
let timerSnapshotProvider: TimerSnapshotFn | null = null;
export function registraTimerSnapshotProvider(fn: TimerSnapshotFn | null): void {
  timerSnapshotProvider = fn;
}

type LeaderboardSnapshotFn = () => LeaderboardSnapshot | null;
let leaderboardSnapshotProvider: LeaderboardSnapshotFn | null = null;
export function registraLeaderboardSnapshotProvider(fn: LeaderboardSnapshotFn | null): void {
  leaderboardSnapshotProvider = fn;
}

type VittoriaSnapshotFn = () => VittoriaSnapshot | null;
let vittoriaSnapshotProvider: VittoriaSnapshotFn | null = null;
export function registraVittoriaSnapshotProvider(fn: VittoriaSnapshotFn | null): void {
  vittoriaSnapshotProvider = fn;
}

type PresentazioneSnapshotFn = () => PresentazioneSnapshot | null;
let presentazioneSnapshotProvider: PresentazioneSnapshotFn | null = null;
export function registraPresentazioneSnapshotProvider(fn: PresentazioneSnapshotFn | null): void {
  presentazioneSnapshotProvider = fn;
}

type VotiSnapshotFn = () => VotiSnapshot | null;
let votiSnapshotProvider: VotiSnapshotFn | null = null;
export function registraVotiSnapshotProvider(fn: VotiSnapshotFn | null): void {
  votiSnapshotProvider = fn;
}

// Timer di default usato finché il timerStore non si è registrato (e come
// fallback difensivo): identico al default storico inline in payloadCorrente.
const TIMER_DEFAULT: TimerSnapshot = {
  stato: "idle",
  durationSec: 300,
  targetEndAt: null,
  pausedRemainingMs: 0,
};

export interface SnapshotAggregato {
  conflitto: ConflittoSnapshot | null;
  timer: TimerSnapshot;
  leaderboard: LeaderboardSnapshot | null;
  vittoria: VittoriaSnapshot | null;
  presentazione: PresentazioneSnapshot | null;
  voti: VotiSnapshot | null;
}

/** Snapshot corrente di tutti gli store registrati, per la ScenaPayload. */
export function leggiSnapshot(): SnapshotAggregato {
  return {
    conflitto: conflittoSnapshotProvider?.() ?? null,
    timer: timerSnapshotProvider?.() ?? TIMER_DEFAULT,
    leaderboard: leaderboardSnapshotProvider?.() ?? null,
    vittoria: vittoriaSnapshotProvider?.() ?? null,
    presentazione: presentazioneSnapshotProvider?.() ?? null,
    voti: votiSnapshotProvider?.() ?? null,
  };
}
