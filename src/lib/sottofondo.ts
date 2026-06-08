import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { joinPath } from "./path";

// Controller del sottofondo musicale. Come il tick della ruota, il sottofondo
// gira nel backend Rust (rodio) invece che nel webview: WebKitGTK + GStreamer
// causava crash del WebProcess. invoke() è fire-and-forget per i comandi di
// controllo; solo avvia() attende la risposta per intercettare errori di formato.

// True quando la vittoria ha messo in pausa il sottofondo: serve a riprenderlo
// solo se era effettivamente in riproduzione al momento della pausa.
let sospesoPerVittoria = false;

interface SottofondoState {
  inRiproduzione: boolean;
  caricamento: boolean;
  errore: string | null;
  volume: number;
  setVolume: (v: number) => void;
  avvia: (folderPath: string, sottofondoPath: string) => Promise<void>;
  ferma: () => void;
  /** Pausa per la durata della vittoria (se stava suonando). */
  pausaPerVittoria: () => void;
  /** Riprende dopo la vittoria (solo se l'avevamo messo noi in pausa). */
  riprendiDaVittoria: () => void;
}

export const useSottofondoStore = create<SottofondoState>((set, get) => ({
  inRiproduzione: false,
  caricamento: false,
  errore: null,
  volume: 0.7,

  setVolume(v) {
    set({ volume: v });
    void invoke("imposta_volume_sottofondo", { volume: v }).catch(() => undefined);
  },

  async avvia(folderPath, sottofondoPath) {
    if (get().caricamento || get().inRiproduzione) return;
    set({ errore: null, caricamento: true });
    try {
      await invoke("avvia_sottofondo", {
        path: joinPath(folderPath, sottofondoPath),
        volume: get().volume,
      });
      set({ inRiproduzione: true });
    } catch (e) {
      set({
        errore: e instanceof Error ? e.message : String(e),
        inRiproduzione: false,
      });
    } finally {
      set({ caricamento: false });
    }
  },

  ferma() {
    void invoke("ferma_sottofondo").catch(() => undefined);
    set({ inRiproduzione: false, errore: null });
  },

  pausaPerVittoria() {
    if (get().inRiproduzione) {
      sospesoPerVittoria = true;
      void invoke("pausa_sottofondo").catch(() => undefined);
    }
  },

  riprendiDaVittoria() {
    if (sospesoPerVittoria) {
      sospesoPerVittoria = false;
      void invoke("riprendi_sottofondo").catch(() => undefined);
    }
  },
}));

/** Da chiamare quando cambia il file/cartella del sottofondo: ferma la riproduzione. */
export function resetSottofondoCache(): void {
  useSottofondoStore.getState().ferma();
}
