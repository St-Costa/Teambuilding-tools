import { emit as tauriEmit, listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Oggetto, Personaggio } from "./ambientazione";
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

export interface ScenaPayload {
  folderPath: string | null;
  mappaPath: string | null;
  personaggi: Personaggio[];
  oggetti: Oggetto[];
  nome: string | null;
  conflitto: ConflittoSnapshot | null;
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
