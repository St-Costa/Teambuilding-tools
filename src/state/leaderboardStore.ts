import { create } from "zustand";
import type { LeaderboardSnapshot, RigaLeaderboardSnap } from "../lib/events";
import {
  forceEmitScena,
  registraLeaderboardSnapshotProvider,
  useAmbientazioneStore,
} from "./ambientazioneStore";

function applicaOrdine<T extends { personaggioId: string }>(
  righe: T[],
  ordine: string[],
): T[] {
  if (ordine.length === 0) return righe;
  const map = new Map(righe.map((r) => [r.personaggioId, r]));
  const ordinati: T[] = [];
  for (const id of ordine) {
    const r = map.get(id);
    if (r) { ordinati.push(r); map.delete(id); }
  }
  // Eventuali personaggi aggiunti dopo l'ultimo salvataggio dell'ordine
  for (const r of map.values()) ordinati.push(r);
  return ordinati;
}

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
  righe: RigaSnapInterno[]; // snapshot personaggi al momento di apri()
  tick: Record<string, [boolean, boolean, boolean]>;
  apri: () => void;
  chiudi: () => void;
  toggleTick: (personaggioId: string, indice: 0 | 1 | 2) => void;
  riordina: (fromIdx: number, toIdx: number) => void;
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  fase: "chiusa",
  righe: [],
  tick: {},

  apri() {
    const amb = useAmbientazioneStore.getState().current;
    if (!amb) return;
    // Gli NPC sono esclusi dalla classifica (ma restano nei conflitti/ruota).
    const base: RigaSnapInterno[] = amb.personaggi
      .filter((p) => !p.npc)
      .map((p) => ({
        personaggioId: p.id,
        nome: p.nome,
        colore: p.colore,
        imgPath: p.imgPath,
        crop: p.crop,
      }));
    const righe = applicaOrdine(base, amb.leaderboardOrdine ?? []);
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

  riordina(fromIdx, toIdx) {
    const state = get();
    if (fromIdx === toIdx) return;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= state.righe.length || toIdx >= state.righe.length) return;
    const nuove = [...state.righe];
    const [rimossa] = nuove.splice(fromIdx, 1);
    nuove.splice(toIdx, 0, rimossa);
    set({ righe: nuove });
    // Persisti il nuovo ordine nell'ambientazione (autosave).
    useAmbientazioneStore.getState().setLeaderboardOrdine(nuove.map((r) => r.personaggioId));
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
