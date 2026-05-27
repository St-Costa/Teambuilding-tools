import { emit as tauriEmit, listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Personaggio } from "./ambientazione";

export const EVT = {
  scenaUpdate: "scena:update",
} as const;

export type EventName = (typeof EVT)[keyof typeof EVT];

export interface ScenaPayload {
  folderPath: string | null;
  mappaPath: string | null;
  personaggi: Personaggio[];
  nome: string | null;
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
