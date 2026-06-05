import { create } from "zustand";
import {
  calcolaFette,
  scegliVincitorePesato,
  angoloDiArresto,
  type FettaCalcolata,
  type Modificatore,
} from "../lib/ruota";
import type { ConflittoSnapshot, FonteSnap, PartecipanteSnap } from "../lib/events";
import {
  forceEmitScena,
  registraConflittoSnapshotProvider,
  useAmbientazioneStore,
} from "./ambientazioneStore";

export type Fonte = { tipo: "oggetto"; oggettoId: string } | { tipo: "testo"; testo: string };

export interface PartecipanteConflitto {
  personaggioId: string;
  modificatore: Modificatore;
  fonte: Fonte | null;
}

export type FaseConflitto = "chiuso" | "setup" | "pronto" | "girando" | "risultato";

export const DURATA_SPIN_MS = 5000;

interface ConflittoState {
  fase: FaseConflitto;
  partecipanti: PartecipanteConflitto[];
  // Stato animazione (validi quando fase != "chiuso").
  // angoloCorrente è cumulativo (mai mod 360) per garantire transition sempre forward.
  angoloCorrente: number;
  triggerCount: number;
  vincitoreId: string | null;
  fetteCorrenti: FettaCalcolata[];
  // Snapshot dei partecipanti al momento di gira(): immutabile durante lo spin,
  // così se il regista modifica il manifest la proiezione resta coerente.
  snapshotPartecipanti: PartecipanteSnap[];
  // azioni
  avvia: () => void;
  aggiungiPartecipante: (personaggioId: string) => void;
  rimuoviPartecipante: (personaggioId: string) => void;
  setModificatore: (personaggioId: string, mod: Modificatore, fonte: Fonte | null) => void;
  preparaSpin: () => void;
  tornaSetup: () => void;
  gira: () => void;
  finitoSpin: () => void;
  chiudi: () => void;
}

function fonteToSnap(fonte: Fonte | null): FonteSnap | null {
  if (!fonte) return null;
  const amb = useAmbientazioneStore.getState().current;
  if (fonte.tipo === "testo") return { tipo: "testo", testo: fonte.testo };
  const ogg = amb?.oggetti.find((o) => o.id === fonte.oggettoId);
  if (!ogg) return null;
  return {
    tipo: "oggetto",
    oggettoId: ogg.id,
    nome: ogg.nome,
    imgPath: ogg.imgPath,
    crop: ogg.crop,
  };
}

function snapshotPartecipantiOra(partecipanti: PartecipanteConflitto[]): PartecipanteSnap[] {
  const amb = useAmbientazioneStore.getState().current;
  if (!amb) return [];
  const snap: PartecipanteSnap[] = [];
  for (const p of partecipanti) {
    const personaggio = amb.personaggi.find((x) => x.id === p.personaggioId);
    if (!personaggio) continue;
    snap.push({
      personaggioId: personaggio.id,
      nome: personaggio.nome,
      colore: personaggio.colore,
      imgPath: personaggio.imgPath,
      crop: personaggio.crop,
      modificatore: p.modificatore,
      fonte: fonteToSnap(p.fonte),
    });
  }
  return snap;
}

export const useConflittoStore = create<ConflittoState>((set, get) => ({
  fase: "chiuso",
  partecipanti: [],
  angoloCorrente: 0,
  triggerCount: 0,
  vincitoreId: null,
  fetteCorrenti: [],
  snapshotPartecipanti: [],

  avvia() {
    set({
      fase: "setup",
      partecipanti: [],
      angoloCorrente: 0,
      triggerCount: 0,
      vincitoreId: null,
      fetteCorrenti: [],
      snapshotPartecipanti: [],
    });
    forceEmitScena();
  },

  aggiungiPartecipante(personaggioId) {
    const { partecipanti } = get();
    if (partecipanti.some((p) => p.personaggioId === personaggioId)) return;
    set({
      partecipanti: [...partecipanti, { personaggioId, modificatore: null, fonte: null }],
    });
    forceEmitScena();
  },

  rimuoviPartecipante(personaggioId) {
    set({
      partecipanti: get().partecipanti.filter((p) => p.personaggioId !== personaggioId),
    });
    forceEmitScena();
  },

  setModificatore(personaggioId, mod, fonte) {
    set({
      partecipanti: get().partecipanti.map((p) =>
        p.personaggioId === personaggioId
          ? { ...p, modificatore: mod, fonte: mod === null ? null : fonte }
          : p,
      ),
    });
    forceEmitScena();
  },

  preparaSpin() {
    const state = get();
    if (state.partecipanti.length < 2) return;
    const snapshot = snapshotPartecipantiOra(state.partecipanti);
    const fette = calcolaFette(
      snapshot.map((s) => ({ id: s.personaggioId, modificatore: s.modificatore })),
    );
    set({
      fase: "pronto",
      fetteCorrenti: fette,
      snapshotPartecipanti: snapshot,
      angoloCorrente: 0,
      triggerCount: 0,
      vincitoreId: null,
    });
    forceEmitScena();
  },

  tornaSetup() {
    set({
      fase: "setup",
      fetteCorrenti: [],
      snapshotPartecipanti: [],
      angoloCorrente: 0,
      triggerCount: 0,
      vincitoreId: null,
    });
    forceEmitScena();
  },

  gira() {
    const state = get();
    if (state.partecipanti.length < 2) return;
    const snapshot = snapshotPartecipantiOra(state.partecipanti);
    const fette = calcolaFette(
      snapshot.map((s) => ({ id: s.personaggioId, modificatore: s.modificatore })),
    );
    const idx = scegliVincitorePesato(fette);
    const delta = angoloDiArresto(idx, fette);
    set({
      fase: "girando",
      fetteCorrenti: fette,
      snapshotPartecipanti: snapshot,
      angoloCorrente: state.angoloCorrente + delta,
      triggerCount: state.triggerCount + 1,
      vincitoreId: fette[idx]?.id ?? null,
    });
    forceEmitScena();
  },

  finitoSpin() {
    if (get().fase !== "girando") return;
    set({ fase: "risultato" });
    forceEmitScena();
  },

  chiudi() {
    set({
      fase: "chiuso",
      partecipanti: [],
      vincitoreId: null,
      fetteCorrenti: [],
      snapshotPartecipanti: [],
    });
    forceEmitScena();
  },
}));

// Espone il provider di snapshot all'ambientazioneStore (evita import circolari).
registraConflittoSnapshotProvider((): ConflittoSnapshot | null => {
  const s = useConflittoStore.getState();
  if (s.fase !== "pronto" && s.fase !== "girando" && s.fase !== "risultato") return null;
  if (s.fetteCorrenti.length === 0) return null;
  return {
    fase: s.fase,
    partecipanti: s.snapshotPartecipanti,
    fette: s.fetteCorrenti,
    angoloFinale: s.angoloCorrente,
    vincitoreId: s.vincitoreId,
    durataSpinMs: DURATA_SPIN_MS,
    triggerCount: s.triggerCount,
  };
});

// Cleanup dei partecipanti spariti: durante "setup" tolgo i personaggi che
// non esistono più; durante "girando"/"risultato" lascio stare (snapshot già preso).
useAmbientazioneStore.subscribe((state, prev) => {
  const personaggiOra = state.current?.personaggi ?? [];
  const personaggiPrima = prev.current?.personaggi ?? [];
  if (personaggiOra === personaggiPrima) return;
  const idsOra = new Set(personaggiOra.map((p) => p.id));
  const c = useConflittoStore.getState();
  if (c.fase !== "setup") return;
  const filtered = c.partecipanti.filter((p) => idsOra.has(p.personaggioId));
  if (filtered.length !== c.partecipanti.length) {
    useConflittoStore.setState({ partecipanti: filtered });
    forceEmitScena();
  }
});
