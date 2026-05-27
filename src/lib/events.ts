import { emit as tauriEmit, listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";

export const EVT = {
  ambientazioneLoaded: "ambientazione:loaded",
} as const;

export type EventName = (typeof EVT)[keyof typeof EVT];

export type EventPayloads = {
  [EVT.ambientazioneLoaded]: { nome: string | null };
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
