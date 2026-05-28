import { create } from "zustand";
import type { Ambientazione, Crop, Oggetto, Personaggio, Posizione } from "../lib/ambientazione";
import {
  apriAmbientazione,
  copiaImmagineInCartella,
  creaAmbientazione,
  salvaAmbientazione,
} from "../lib/storage";
import { aggiungiRecente, aggiornaNomeRecente } from "../lib/recents";
import { EVT, emit, type ScenaPayload } from "../lib/events";
import { clamp01, nuovoId } from "../lib/scena";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

interface AmbientazioneState {
  current: Ambientazione | null;
  folderPath: string | null;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  lastError: string | null;
  selezionatoId: string | null;
  apri: (folderPath: string) => Promise<void>;
  creaNuova: (folderParent: string, nome: string) => Promise<void>;
  chiudi: () => void;
  modifica: (fn: (draft: Ambientazione) => void) => void;
  impostaMappa: (sourceAbsPath: string) => Promise<void>;
  rimuoviMappa: () => void;
  aggiungiPersonaggio: (input: {
    sourceImgPath: string;
    nome: string;
    colore: string;
    crop: Crop;
  }) => Promise<string>;
  spostaPersonaggio: (id: string, pos: Posizione) => void;
  rinominaPersonaggio: (id: string, nome: string) => void;
  cambiaColorePersonaggio: (id: string, hex: string) => void;
  modificaCropPersonaggio: (id: string, crop: Crop) => void;
  eliminaPersonaggio: (id: string) => void;
  selezionaPersonaggio: (id: string | null) => void;
  aggiungiOggetto: (input: {
    sourceImgPath: string;
    nome: string;
    crop: Crop;
  }) => Promise<string>;
  rinominaOggetto: (id: string, nome: string) => void;
  modificaCropOggetto: (id: string, crop: Crop) => void;
  eliminaOggetto: (id: string) => void;
  assegnaOggettoAPersonaggio: (personaggioId: string, oggettoId: string | null) => void;
  markSaving: () => void;
  markSaved: (a: Ambientazione) => void;
  markError: (msg: string) => void;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

let pendingEmit = false;
let lastPayload: ScenaPayload | null = null;

function emitThrottled(payload: ScenaPayload): void {
  lastPayload = payload;
  if (pendingEmit) return;
  pendingEmit = true;
  requestAnimationFrame(() => {
    pendingEmit = false;
    const p = lastPayload;
    lastPayload = null;
    if (p) void emit(EVT.scenaUpdate, p).catch(() => undefined);
  });
}

function payloadCorrente(state: AmbientazioneState): ScenaPayload {
  return {
    folderPath: state.folderPath,
    mappaPath: state.current?.mappaPath ?? null,
    personaggi: state.current?.personaggi ?? [],
    oggetti: state.current?.oggetti ?? [],
    nome: state.current?.nome ?? null,
    conflitto: conflittoSnapshotProvider?.() ?? null,
    timer: timerSnapshotProvider?.() ?? {
      stato: "idle",
      durationSec: 300,
      targetEndAt: null,
      pausedRemainingMs: 0,
    },
  };
}

// Wiring leggero verso conflittoStore/timerStore senza creare un import
// circolare: i due store si registrano qui al boot e forniscono snapshot.
type ConflittoSnapshotFn = () => import("../lib/events").ConflittoSnapshot | null;
let conflittoSnapshotProvider: ConflittoSnapshotFn | null = null;
export function registraConflittoSnapshotProvider(fn: ConflittoSnapshotFn | null): void {
  conflittoSnapshotProvider = fn;
}

type TimerSnapshotFn = () => import("../lib/events").TimerSnapshot;
let timerSnapshotProvider: TimerSnapshotFn | null = null;
export function registraTimerSnapshotProvider(fn: TimerSnapshotFn | null): void {
  timerSnapshotProvider = fn;
}

export function forceEmitScena(): void {
  emitThrottled(payloadCorrente(useAmbientazioneStore.getState()));
}

function notificaProiezione(state: AmbientazioneState): void {
  emitThrottled(payloadCorrente(state));
}

export const useAmbientazioneStore = create<AmbientazioneState>((set, get) => ({
  current: null,
  folderPath: null,
  saveStatus: "idle",
  lastSavedAt: null,
  lastError: null,
  selezionatoId: null,

  async apri(folderPath) {
    const a = await apriAmbientazione(folderPath);
    set({
      current: a,
      folderPath,
      saveStatus: "saved",
      lastSavedAt: Date.now(),
      lastError: null,
      selezionatoId: null,
    });
    await aggiungiRecente(folderPath, a.nome);
    notificaProiezione(get());
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
      selezionatoId: null,
    });
    await aggiungiRecente(folderPath, nome);
    notificaProiezione(get());
  },

  chiudi() {
    set({
      current: null,
      folderPath: null,
      saveStatus: "idle",
      lastSavedAt: null,
      lastError: null,
      selezionatoId: null,
    });
    notificaProiezione(get());
  },

  modifica(fn) {
    const cur = get().current;
    if (!cur) return;
    const next = clone(cur);
    fn(next);
    set({ current: next, saveStatus: "dirty", lastError: null });
    notificaProiezione(get());
  },

  async impostaMappa(sourceAbsPath) {
    const { folderPath } = get();
    if (!folderPath) throw new Error("Nessuna ambientazione aperta");
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(folderPath, sourceAbsPath, "", `mappa-${id}`);
    get().modifica((draft) => {
      draft.mappaPath = relativo;
    });
  },

  rimuoviMappa() {
    get().modifica((draft) => {
      draft.mappaPath = null;
    });
  },

  async aggiungiPersonaggio({ sourceImgPath, nome, colore, crop }) {
    const { folderPath } = get();
    if (!folderPath) throw new Error("Nessuna ambientazione aperta");
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(folderPath, sourceImgPath, "personaggi", id);
    const personaggio: Personaggio = {
      id,
      nome: nome.trim(),
      colore: colore.toUpperCase(),
      imgPath: relativo,
      crop,
      posizione: { x: 0.1, y: 0.1 },
      oggettoId: null,
    };
    get().modifica((draft) => {
      draft.personaggi.push(personaggio);
    });
    return id;
  },

  spostaPersonaggio(id, pos) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) {
        p.posizione = { x: clamp01(pos.x), y: clamp01(pos.y) };
      }
    });
  },

  rinominaPersonaggio(id, nome) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.nome = nome.trim();
    });
  },

  cambiaColorePersonaggio(id, hex) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.colore = hex.toUpperCase();
    });
  },

  modificaCropPersonaggio(id, crop) {
    get().modifica((draft) => {
      const p = draft.personaggi.find((x) => x.id === id);
      if (p) p.crop = crop;
    });
  },

  eliminaPersonaggio(id) {
    get().modifica((draft) => {
      draft.personaggi = draft.personaggi.filter((x) => x.id !== id);
    });
    if (get().selezionatoId === id) set({ selezionatoId: null });
  },

  selezionaPersonaggio(id) {
    set({ selezionatoId: id });
  },

  async aggiungiOggetto({ sourceImgPath, nome, crop }) {
    const { folderPath } = get();
    if (!folderPath) throw new Error("Nessuna ambientazione aperta");
    const id = nuovoId();
    const relativo = await copiaImmagineInCartella(folderPath, sourceImgPath, "oggetti", id);
    const oggetto: Oggetto = {
      id,
      nome: nome.trim(),
      imgPath: relativo,
      crop,
    };
    get().modifica((draft) => {
      draft.oggetti.push(oggetto);
    });
    return id;
  },

  rinominaOggetto(id, nome) {
    get().modifica((draft) => {
      const o = draft.oggetti.find((x) => x.id === id);
      if (o) o.nome = nome.trim();
    });
  },

  modificaCropOggetto(id, crop) {
    get().modifica((draft) => {
      const o = draft.oggetti.find((x) => x.id === id);
      if (o) o.crop = crop;
    });
  },

  eliminaOggetto(id) {
    get().modifica((draft) => {
      draft.oggetti = draft.oggetti.filter((x) => x.id !== id);
      // Detach automatico dai personaggi che lo avevano.
      for (const p of draft.personaggi) {
        if (p.oggettoId === id) p.oggettoId = null;
      }
    });
  },

  assegnaOggettoAPersonaggio(personaggioId, oggettoId) {
    get().modifica((draft) => {
      // Vincolo 1-a-1: l'oggetto può essere su un solo personaggio.
      // Se viene riassegnato, libera l'eventuale precedente proprietario.
      if (oggettoId !== null) {
        for (const p of draft.personaggi) {
          if (p.id !== personaggioId && p.oggettoId === oggettoId) {
            p.oggettoId = null;
          }
        }
      }
      const target = draft.personaggi.find((x) => x.id === personaggioId);
      if (target) target.oggettoId = oggettoId;
    });
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
    }
  } catch (e) {
    markError(e instanceof Error ? e.message : String(e));
  }
}
