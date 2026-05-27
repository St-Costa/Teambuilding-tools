import { create } from "zustand";
import type { Ambientazione } from "../lib/ambientazione";
import {
  apriAmbientazione,
  creaAmbientazione,
  salvaAmbientazione,
} from "../lib/storage";
import { aggiungiRecente, aggiornaNomeRecente } from "../lib/recents";
import { EVT, emit } from "../lib/events";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface AmbientazioneState {
  current: Ambientazione | null;
  folderPath: string | null;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  lastError: string | null;
  apri: (folderPath: string) => Promise<void>;
  creaNuova: (folderParent: string, nome: string) => Promise<void>;
  chiudi: () => void;
  modifica: (fn: (draft: Ambientazione) => void) => void;
  markSaving: () => void;
  markSaved: (a: Ambientazione) => void;
  markError: (msg: string) => void;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

async function notificaProiezione(nome: string | null): Promise<void> {
  try {
    await emit(EVT.ambientazioneLoaded, { nome });
  } catch {
    // se la proiezione non è ancora pronta non blocchiamo
  }
}

export const useAmbientazioneStore = create<AmbientazioneState>((set, get) => ({
  current: null,
  folderPath: null,
  saveStatus: "idle",
  lastSavedAt: null,
  lastError: null,

  async apri(folderPath) {
    const a = await apriAmbientazione(folderPath);
    set({
      current: a,
      folderPath,
      saveStatus: "saved",
      lastSavedAt: Date.now(),
      lastError: null,
    });
    await aggiungiRecente(folderPath, a.nome);
    await notificaProiezione(a.nome);
  },

  async creaNuova(folderParent, nome) {
    const sep = folderParent.includes("\\") && !folderParent.includes("/") ? "\\" : "/";
    const folderPath = `${folderParent.replace(/[\/\\]+$/, "")}${sep}${nome}`;
    const a = await creaAmbientazione(folderPath, nome);
    set({
      current: a,
      folderPath,
      saveStatus: "saved",
      lastSavedAt: Date.now(),
      lastError: null,
    });
    await aggiungiRecente(folderPath, nome);
    await notificaProiezione(nome);
  },

  chiudi() {
    set({
      current: null,
      folderPath: null,
      saveStatus: "idle",
      lastSavedAt: null,
      lastError: null,
    });
    void notificaProiezione(null);
  },

  modifica(fn) {
    const cur = get().current;
    if (!cur) return;
    const next = clone(cur);
    fn(next);
    set({ current: next, saveStatus: "dirty", lastError: null });
  },

  markSaving() {
    set({ saveStatus: "saving" });
  },

  markSaved(a) {
    set({
      current: a,
      saveStatus: "saved",
      lastSavedAt: Date.now(),
      lastError: null,
    });
  },

  markError(msg) {
    set({ saveStatus: "error", lastError: msg });
  },
}));

export async function eseguiSalvataggio(): Promise<void> {
  const { current, folderPath, markSaving, markSaved, markError } = useAmbientazioneStore.getState();
  if (!current || !folderPath) return;
  markSaving();
  try {
    const aggiornata = await salvaAmbientazione(folderPath, current);
    markSaved(aggiornata);
    if (aggiornata.nome) {
      await aggiornaNomeRecente(folderPath, aggiornata.nome);
      await notificaProiezione(aggiornata.nome);
    }
  } catch (e) {
    markError(e instanceof Error ? e.message : String(e));
  }
}
