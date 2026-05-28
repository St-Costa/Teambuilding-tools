import { create } from "zustand";
import type { LeaderboardSnapshot, RigaLeaderboardSnap } from "../lib/events";
import {
  forceEmitScena,
  registraLeaderboardSnapshotProvider,
  useAmbientazioneStore,
} from "./ambientazioneStore";

export type FaseLeaderboard = "chiusa" | "aperta";

interface RigaSnapInterno {
  personaggioId: string;
  nome: string;
  colore: string;
  imgPath: string;
  crop: import("../lib/ambientazione").Crop;
}

interface LeaderboardState {
  fase: FaseLeaderboard;
  righe: RigaSnapInterno[];                          // snapshot personaggi al momento di apri()
  tick: Record<string, [boolean, boolean, boolean]>;
  apri: () => void;
  chiudi: () => void;
  toggleTick: (personaggioId: string, indice: 0 | 1 | 2) => void;
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  fase: "chiusa",
  righe: [],
  tick: {},

  apri() {
    const amb = useAmbientazioneStore.getState().current;
    if (!amb) return;
    const righe: RigaSnapInterno[] = amb.personaggi.map((p) => ({
      personaggioId: p.id,
      nome: p.nome,
      colore: p.colore,
      imgPath: p.imgPath,
      crop: p.crop,
    }));
    const tick: Record<string, [boolean, boolean, boolean]> = {};
    for (const r of righe) tick[r.personaggioId] = [false, false, false];
    set({ fase: "aperta", righe, tick });
    forceEmitScena();
  },

  chiudi() {
    set({ fase: "chiusa", righe: [], tick: {} });
    forceEmitScena();
  },

  toggleTick(personaggioId, indice) {
    const state = get();
    const corrente = state.tick[personaggioId];
    if (!corrente) return;
    const nuovo: [boolean, boolean, boolean] = [corrente[0], corrente[1], corrente[2]];
    nuovo[indice] = !nuovo[indice];
    set({ tick: { ...state.tick, [personaggioId]: nuovo } });
    forceEmitScena();
  },
}));

registraLeaderboardSnapshotProvider((): LeaderboardSnapshot | null => {
  const s = useLeaderboardStore.getState();
  if (s.fase !== "aperta") return null;
  const obiettivi = useAmbientazioneStore.getState().current?.obiettivi ?? ["", "", ""];
  const righe: RigaLeaderboardSnap[] = s.righe.map((r) => {
    const t = s.tick[r.personaggioId] ?? [false, false, false];
    // Il 3° obiettivo è un MALUS: -1 quando attivo (gli altri due +1 quando attivi).
    const totale = (t[0] ? 1 : 0) + (t[1] ? 1 : 0) - (t[2] ? 1 : 0);
    return {
      personaggioId: r.personaggioId,
      nome: r.nome,
      colore: r.colore,
      imgPath: r.imgPath,
      crop: r.crop,
      tick: t,
      totale,
    };
  });
  return { obiettivi, righe };
});
