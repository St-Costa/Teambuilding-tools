import { create } from "zustand";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { autorizzaCartella } from "../lib/storage";
import { useAmbientazioneStore } from "./ambientazioneStore";

// "Momenti meme": annotazioni divertenti prese durante la partita, da cui poi
// si ricavano meme da inviare via mail ai giocatori. Vivono SOLO nella regia
// (niente sulla proiezione). Alla fine si esportano in un file .md.

export interface MomentoMeme {
  testo: string;
  ora: string; // HH:MM
}

interface MemeState {
  momenti: MomentoMeme[];
  aggiungi: (testo: string) => void;
  rimuovi: (indice: number) => void;
  azzera: () => void;
  /** Markdown completo dei momenti raccolti. */
  markdown: () => string;
  /** Chiede dove salvare ed esporta il .md. Ritorna true se salvato. */
  salvaSuFile: () => Promise<boolean>;
}

function oraCorrente(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function dirnameOf(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx > 0 ? path.slice(0, idx) : path;
}

export const useMemeStore = create<MemeState>((set, get) => ({
  momenti: [],

  aggiungi(testo) {
    const t = testo.trim();
    if (t === "") return;
    set({ momenti: [...get().momenti, { testo: t, ora: oraCorrente() }] });
  },

  rimuovi(indice) {
    set({ momenti: get().momenti.filter((_, i) => i !== indice) });
  },

  azzera() {
    set({ momenti: [] });
  },

  markdown() {
    const nome = useAmbientazioneStore.getState().current?.nome ?? "Partita";
    const righe = get().momenti.map((m) => `- \`${m.ora}\` ${m.testo}`);
    return `# Momenti meme — ${nome}\n\n${righe.join("\n")}\n`;
  },

  async salvaSuFile() {
    const momenti = get().momenti;
    if (momenti.length === 0) return false;
    const nome = useAmbientazioneStore.getState().current?.nome ?? "partita";
    const nomeFile = `momenti-meme-${nome.replace(/[^\w-]+/g, "_")}.md`;
    const path = await save({
      defaultPath: nomeFile,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (typeof path !== "string" || path === "") return false;
    // Autorizza la cartella di destinazione prima di scrivere (scope fs).
    try {
      await autorizzaCartella(dirnameOf(path));
    } catch {
      // se l'autorizzazione fallisce proviamo comunque la scrittura
    }
    await writeTextFile(path, get().markdown());
    return true;
  },
}));
