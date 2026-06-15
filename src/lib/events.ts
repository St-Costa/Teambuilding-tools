import { emit as tauriEmit, listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Annotazione, Oggetto, Personaggio } from "./ambientazione";
import type { FettaCalcolata, Modificatore } from "./ruota";

export const EVT = {
  scenaUpdate: "scena:update",
  vittoriaBoom: "vittoria:boom",
} as const;

export type EventName = (typeof EVT)[keyof typeof EVT];

export type FonteSnap =
  | {
      tipo: "oggetto";
      oggettoId: string;
      nome: string;
      imgPath: string;
      crop: import("./ambientazione").Crop;
    }
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
  vincitoreId: string | null; // null in fase "pronto"
  durataSpinMs: number;
  triggerCount: number; // incrementato a ogni gira(), serve a far ripartire CSS transition
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

export interface VincitoreSnap {
  personaggioId: string;
  nome: string; // NON renderizzato (cerchi senza nomi), incluso per completezza
  colore: string;
  imgPath: string;
  crop: import("./ambientazione").Crop;
}

export interface VittoriaSnapshot {
  vincitori: VincitoreSnap[]; // 1+ (pari merito)
  trigger: number; // come ConflittoSnapshot.triggerCount: forza il restart delle animazioni via key
}

// Singolo scoppio di fuoco d'artificio: la REGIA decide il ritmo (suona il
// boom e contemporaneamente emette questo evento), la PROIEZIONE disegna
// l'esplosione → suono e visivo coincidono.
export interface BoomPayload {
  id: number;
  x: number; // posizione orizzontale normalizzata 0..1
  colori: string[]; // tinte delle scintille (colori dei vincitori + oro/bianco)
}

export interface PresentazioneSnapshot {
  paginaCorrente: number; // 1-based
  numPagine: number; // 0 finché il PDF non è stato aperto
}

export interface PersonaggioMiniSnap {
  personaggioId: string;
  nome: string;
  colore: string;
  imgPath: string;
  crop: import("./ambientazione").Crop;
}

// Un "accusato" con la lista di chi lo ha votato.
export interface RigaVotiSnap {
  target: PersonaggioMiniSnap;
  votanti: PersonaggioMiniSnap[];
}

export interface VotiSnapshot {
  righe: RigaVotiSnap[]; // uno per ogni personaggio non-NPC
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
  vittoria: VittoriaSnapshot | null;
  // Presentazione: path sempre presente (la proiezione lo usa per readFile),
  // ma l'overlay si mostra solo quando `presentazione !== null`. La nota NON
  // entra qui: la proiezione mostra solo la pagina, le note restano in regia.
  presentazionePath: string | null;
  presentazione: PresentazioneSnapshot | null;
  immagineFissaPath: string | null;
  immagineFissaVisibile: boolean;
  sfondoCountdownPath: string | null;
  countdownFullscreenVisibile: boolean;
  voti: VotiSnapshot | null;
  sfondoVotiPath: string | null;
}

export type EventPayloads = {
  [EVT.scenaUpdate]: ScenaPayload;
  [EVT.vittoriaBoom]: BoomPayload;
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
