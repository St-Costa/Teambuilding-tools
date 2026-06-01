import { emit as tauriEmit, listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Annotazione, Oggetto, Personaggio } from "./ambientazione";
import type { FettaCalcolata, Modificatore } from "./ruota";

export const EVT = {
  scenaUpdate: "scena:update",
} as const;

export type EventName = (typeof EVT)[keyof typeof EVT];

export type FonteSnap =
  | { tipo: "oggetto"; oggettoId: string; nome: string; imgPath: string; crop: import("./ambientazione").Crop }
  | { tipo: "testo"; testo: string };

export interface PartecipanteSnap {
  personaggioId: string;
  nome: string;
  colore: string;
  imgPath: string;
  crop: import("./ambientazione").Crop;
  modificatore: Modificatore;
  fonte: FonteSnap | null;
}

export interface ConflittoSnapshot {
  fase: "pronto" | "girando" | "risultato";
  partecipanti: PartecipanteSnap[];
  fette: FettaCalcolata[];
  angoloFinale: number;
  vincitoreId: string | null;     // null in fase "pronto"
  durataSpinMs: number;
  triggerCount: number;           // incrementato a ogni gira(), serve a far ripartire CSS transition
}

export interface TimerSnapshot {
  stato: "idle" | "running" | "paused" | "ended";
  durationSec: number;
  targetEndAt: number | null;
  pausedRemainingMs: number;
}

export interface RigaLeaderboardSnap {
  personaggioId: string;
  nome: string;
  colore: string;
  imgPath: string;
  crop: import("./ambientazione").Crop;
  tick: [boolean, boolean, boolean];
  totale: number;
}

export interface LeaderboardSnapshot {
  obiettivi: [string, string, string];
  righe: RigaLeaderboardSnap[];
}

export interface ScenaPayload {
  folderPath: string | null;
  mappaPath: string | null;
  personaggi: Personaggio[];
  oggetti: Oggetto[];
  annotazioni: Annotazione[];
  nome: string | null;
  conflitto: ConflittoSnapshot | null;
  timer: TimerSnapshot;
  leaderboard: LeaderboardSnapshot | null;
}

export type EventPayloads = {
  [EVT.scenaUpdate]: ScenaPayload;
};

export function emit<N extends EventName>(name: N, payload: EventPayloads[N]): Promise<void> {
  return tauriEmit(name, payload);
}

export function listen<N extends EventName>(
  name: N,
  handler: (payload: EventPayloads[N]) => void,
): Promise<UnlistenFn> {
  return tauriListen<EventPayloads[N]>(name, (e) => handler(e.payload));
}
