import { create } from "zustand";
import type { VincitoreSnap, VittoriaSnapshot } from "../lib/events";
import { forceEmitScena, registraVittoriaSnapshotProvider } from "./ambientazioneStore";

interface VittoriaState {
  attiva: boolean;
  vincitori: VincitoreSnap[];
  // Monotono: incrementato a ogni avvia(), serve a far ripartire da zero le
  // animazioni CSS sulla proiezione (key={trigger}) anche se il componente
  // non viene smontato tra un avvio e l'altro.
  trigger: number;
  avvia: (vincitori: VincitoreSnap[]) => void;
  termina: () => void;
}

export const useVittoriaStore = create<VittoriaState>((set, get) => ({
  attiva: false,
  vincitori: [],
  trigger: 0,

  avvia(vincitori) {
    set({ attiva: true, vincitori, trigger: get().trigger + 1 });
    forceEmitScena();
  },

  termina() {
    // trigger resta invariato (monotono): non lo azzeriamo.
    set({ attiva: false, vincitori: [] });
    forceEmitScena();
  },
}));

registraVittoriaSnapshotProvider((): VittoriaSnapshot | null => {
  const s = useVittoriaStore.getState();
  if (!s.attiva) return null;
  return { vincitori: s.vincitori, trigger: s.trigger };
});
