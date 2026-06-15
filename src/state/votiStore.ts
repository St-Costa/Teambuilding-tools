import { create } from "zustand";
import type { VotiSnapshot, RigaVotiSnap, PersonaggioMiniSnap } from "../lib/events";
import type { Crop } from "../lib/ambientazione";
import { forceEmitScena, registraVotiSnapshotProvider, useAmbientazioneStore } from "./ambientazioneStore";

export type FaseVoti = "chiusa" | "aperta";

interface PersonaggioSnap {
  personaggioId: string;
  nome: string;
  colore: string;
  imgPath: string;
  crop: Crop;
}

interface VotiState {
  fase: FaseVoti;
  // snapshot dei personaggi al momento di apri()
  righe: PersonaggioSnap[];
  // votanti[targetId] = array di voterId che hanno votato per target
  votanti: Record<string, string[]>;
  apri: () => void;
  chiudi: () => void;
  toggleVoto: (targetId: string, votanteId: string) => void;
  azzeraVoti: () => void;
}

export const useVotiStore = create<VotiState>((set, get) => ({
  fase: "chiusa",
  righe: [],
  votanti: {},

  apri() {
    const amb = useAmbientazioneStore.getState().current;
    if (!amb) return;
    const righe: PersonaggioSnap[] = amb.personaggi
      .filter((p) => !p.npc)
      .map((p) => ({ personaggioId: p.id, nome: p.nome, colore: p.colore, imgPath: p.imgPath, crop: p.crop }));
    // Reset voti ad ogni apertura: ogni sessione di gioco parte da zero.
    const votanti: Record<string, string[]> = {};
    for (const r of righe) votanti[r.personaggioId] = [];
    set({ fase: "aperta", righe, votanti });
    forceEmitScena();
  },

  chiudi() {
    set({ fase: "chiusa" });
    forceEmitScena();
  },

  toggleVoto(targetId, votanteId) {
    const state = get();
    const correnti = state.votanti[targetId] ?? [];
    const giàVotato = correnti.includes(votanteId);
    const nuovi = giàVotato ? correnti.filter((id) => id !== votanteId) : [...correnti, votanteId];
    set({ votanti: { ...state.votanti, [targetId]: nuovi } });
    forceEmitScena();
  },

  azzeraVoti() {
    const state = get();
    const azzerati: Record<string, string[]> = {};
    for (const id of Object.keys(state.votanti)) azzerati[id] = [];
    set({ votanti: azzerati });
    forceEmitScena();
  },
}));

registraVotiSnapshotProvider((): VotiSnapshot | null => {
  const s = useVotiStore.getState();
  if (s.fase !== "aperta") return null;
  const righeMap = new Map(s.righe.map((r) => [r.personaggioId, r]));
  const righe: RigaVotiSnap[] = s.righe.map((r) => {
    const target: PersonaggioMiniSnap = {
      personaggioId: r.personaggioId,
      nome: r.nome,
      colore: r.colore,
      imgPath: r.imgPath,
      crop: r.crop,
    };
    const votantiIds = s.votanti[r.personaggioId] ?? [];
    const votanti: PersonaggioMiniSnap[] = votantiIds
      .map((id) => righeMap.get(id))
      .filter((v): v is PersonaggioSnap => v !== undefined)
      .map((v) => ({ personaggioId: v.personaggioId, nome: v.nome, colore: v.colore, imgPath: v.imgPath, crop: v.crop }));
    return { target, votanti };
  });
  return { righe };
});
