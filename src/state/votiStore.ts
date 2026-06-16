import { create } from "zustand";
import type { VotiSnapshot, RigaVotiSnap, PersonaggioMiniSnap, PrigionieroSnapshot } from "../lib/events";
import type { Crop } from "../lib/ambientazione";
import { forceEmitScena, registraVotiSnapshotProvider, registraPrigionieroSnapshotProvider, useAmbientazioneStore } from "./ambientazioneStore";
import { playPrigionieroSbarre, playPrigionieroAmbience, stopPrigionieroAmbience } from "../lib/audio";
import { joinPath } from "../lib/path";

const AUDIO_OFFSET_MS = 900; // i primi 900ms dell'mp3 sbarre sono silenzio/intro
const DELAY_DOPO_AMBIENCE_MS = 100; // parte prima il sottofondo, poi l'animazione

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
  // Animazione incarcerazione: chi ha più voti
  prigionieri: PersonaggioMiniSnap[] | null;
  prigionieroTrigger: number;
  apri: () => void;
  chiudi: () => void;
  toggleVoto: (targetId: string, votanteId: string) => void;
  azzeraVoti: () => void;
  avviaPrigioniero: () => void;
  chiudiPrigioniero: () => void;
}

export const useVotiStore = create<VotiState>((set, get) => ({
  fase: "chiusa",
  righe: [],
  votanti: {},
  prigionieri: null,
  prigionieroTrigger: 0,

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
    stopPrigionieroAmbience();
    set({ fase: "chiusa", prigionieri: null });
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

  avviaPrigioniero() {
    const state = get();
    if (state.fase !== "aperta" || state.righe.length === 0) return;
    const maxVoti = Math.max(...state.righe.map((r) => (state.votanti[r.personaggioId] ?? []).length));
    if (maxVoti === 0) return;
    const prigionieri: PersonaggioMiniSnap[] = state.righe
      .filter((r) => (state.votanti[r.personaggioId] ?? []).length === maxVoti)
      .map((r) => ({ personaggioId: r.personaggioId, nome: r.nome, colore: r.colore, imgPath: r.imgPath, crop: r.crop }));

    const amb = useAmbientazioneStore.getState().current;
    const folder = useAmbientazioneStore.getState().folderPath;

    // 1) Prima di tutto: parte il sottofondo ambience.
    if (amb && folder && amb.suonoPrigionieroSirenaPath) {
      playPrigionieroAmbience(joinPath(folder, amb.suonoPrigionieroSirenaPath));
    }

    // 2) Dopo un breve ritardo: l'animazione (emit allo STAGE) e il suono sbarre.
    window.setTimeout(() => {
      if (amb && folder && amb.suonoPrigionieroPath) {
        playPrigionieroSbarre(joinPath(folder, amb.suonoPrigionieroPath), AUDIO_OFFSET_MS);
      }
      set({ prigionieri, prigionieroTrigger: get().prigionieroTrigger + 1 });
      forceEmitScena();
    }, DELAY_DOPO_AMBIENCE_MS);
  },

  chiudiPrigioniero() {
    stopPrigionieroAmbience();
    set({ prigionieri: null });
    forceEmitScena();
  },
}));

registraPrigionieroSnapshotProvider((): PrigionieroSnapshot | null => {
  const s = useVotiStore.getState();
  if (!s.prigionieri) return null;
  return { prigionieri: s.prigionieri, trigger: s.prigionieroTrigger };
});

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
