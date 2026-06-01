import { create } from "zustand";
import { readFile } from "@tauri-apps/plugin-fs";

// Controller del sottofondo musicale (finestra REGIA). Estratto da
// PulsanteSottofondo in uno store condiviso così che anche l'animazione di
// vittoria possa metterlo in pausa e riprenderlo (ducking) senza che il
// pulsante esponga il suo HTMLAudioElement interno.
//
// L'elemento audio e la cache del blob vivono a livello di modulo (imperativi);
// lo store espone solo lo stato reattivo per la UI.

function joinPath(a: string, b: string): string {
  const sep = a.includes("\\") && !a.includes("/") ? "\\" : "/";
  return `${a.replace(/[\/\\]+$/, "")}${sep}${b}`;
}

function mimeDaPath(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  switch (m?.[1]) {
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "ogg": return "audio/ogg";
    case "m4a": case "aac": return "audio/aac";
    case "flac": return "audio/flac";
    default: return "audio/mpeg";
  }
}

let audio: HTMLAudioElement | null = null;
let blobCache: { key: string; url: string } | null = null;
// True quando il sottofondo è stato messo in pausa dalla vittoria: serve a
// riprenderlo solo se era effettivamente in riproduzione.
let sospesoPerVittoria = false;

interface SottofondoState {
  inRiproduzione: boolean;
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
  errore: null,
  volume: 0.7,

  setVolume(v) {
    set({ volume: v });
    if (audio) audio.volume = v;
  },

  async avvia(folderPath, sottofondoPath) {
    set({ errore: null });
    try {
      const key = `${folderPath}::${sottofondoPath}`;
      let url = blobCache?.key === key ? blobCache.url : null;
      if (!url) {
        if (blobCache) URL.revokeObjectURL(blobCache.url);
        const bytes = await readFile(joinPath(folderPath, sottofondoPath));
        const blob = new Blob([new Uint8Array(bytes)], { type: mimeDaPath(sottofondoPath) });
        url = URL.createObjectURL(blob);
        blobCache = { key, url };
      }
      const el = new Audio(url);
      el.loop = true;
      el.volume = get().volume;
      el.onerror = () => {
        const code = el.error?.code;
        const msg =
          code === 4
            ? "Formato audio non supportato (manca un codec). Prova un .wav."
            : `Errore audio (codice ${code ?? "?"})`;
        set({ errore: msg, inRiproduzione: false });
      };
      el.onended = () => set({ inRiproduzione: false });
      audio = el;
      sospesoPerVittoria = false;
      await el.play();
      set({ inRiproduzione: true });
    } catch (e) {
      set({
        errore: `Impossibile riprodurre: ${e instanceof Error ? e.message : String(e)}`,
        inRiproduzione: false,
      });
    }
  },

  ferma() {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio = null;
    }
    sospesoPerVittoria = false;
    set({ inRiproduzione: false });
  },

  pausaPerVittoria() {
    if (audio && get().inRiproduzione && !audio.paused) {
      audio.pause();
      sospesoPerVittoria = true;
    }
  },

  riprendiDaVittoria() {
    if (audio && sospesoPerVittoria) {
      void audio.play().catch(() => undefined);
      sospesoPerVittoria = false;
    }
  },
}));

/** Da chiamare quando cambia il file/cartella del sottofondo: ferma e invalida la cache. */
export function resetSottofondoCache(): void {
  useSottofondoStore.getState().ferma();
  if (blobCache) {
    URL.revokeObjectURL(blobCache.url);
    blobCache = null;
  }
}
