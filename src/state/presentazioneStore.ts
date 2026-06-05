import { create } from "zustand";
import type { PresentazioneSnapshot } from "../lib/events";
import {
  forceEmitScena,
  registraPresentazioneSnapshotProvider,
  useAmbientazioneStore,
} from "./ambientazioneStore";

export type FasePresentazione = "chiusa" | "attiva";

interface PresentazioneState {
  fase: FasePresentazione;
  paginaCorrente: number; // 1-based
  numPagine: number; // 0 finché il PDF non è stato aperto e contato
  // Avvia la presentazione sulla proiezione. No-op se l'ambientazione non ha
  // un PDF caricato. numPagine parte da 0 e viene aggiornato da setNumPagine()
  // quando la regia (o la proiezione) ha aperto il documento.
  avvia: () => void;
  setNumPagine: (n: number) => void;
  vaiAvanti: () => void;
  vaiIndietro: () => void;
  vaiAPagina: (n: number) => void;
  chiudi: () => void;
}

function clampPagina(n: number, numPagine: number): number {
  const min = 1;
  // Finché numPagine è 0 (PDF non ancora contato) non applichiamo il tetto.
  const max = numPagine > 0 ? numPagine : Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export const usePresentazioneStore = create<PresentazioneState>((set, get) => ({
  fase: "chiusa",
  paginaCorrente: 1,
  numPagine: 0,

  avvia() {
    const amb = useAmbientazioneStore.getState().current;
    if (!amb || !amb.presentazionePath) return;
    set({ fase: "attiva", paginaCorrente: 1 });
    forceEmitScena();
  },

  setNumPagine(n) {
    const num = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    set({ numPagine: num, paginaCorrente: clampPagina(get().paginaCorrente, num) });
    forceEmitScena();
  },

  vaiAvanti() {
    const { paginaCorrente, numPagine } = get();
    set({ paginaCorrente: clampPagina(paginaCorrente + 1, numPagine) });
    forceEmitScena();
  },

  vaiIndietro() {
    const { paginaCorrente, numPagine } = get();
    set({ paginaCorrente: clampPagina(paginaCorrente - 1, numPagine) });
    forceEmitScena();
  },

  vaiAPagina(n) {
    set({ paginaCorrente: clampPagina(n, get().numPagine) });
    forceEmitScena();
  },

  chiudi() {
    set({ fase: "chiusa", paginaCorrente: 1, numPagine: 0 });
    forceEmitScena();
  },
}));

registraPresentazioneSnapshotProvider((): PresentazioneSnapshot | null => {
  const s = usePresentazioneStore.getState();
  if (s.fase !== "attiva") return null;
  return { paginaCorrente: s.paginaCorrente, numPagine: s.numPagine };
});
