import { BaseDirectory, exists, mkdir, readTextFile, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import { autorizzaCartella } from "./storage";

const FILE = "recents.json";
const MAX_VOCI = 10;

export interface RecentEntry {
  path: string;
  nome: string;
  lastOpenedAt: number;
}

export interface RecentEntryConStato extends RecentEntry {
  esiste: boolean;
}

async function leggiGrezzo(): Promise<RecentEntry[]> {
  const presente = await exists(FILE, { baseDir: BaseDirectory.AppConfig });
  if (!presente) return [];
  try {
    const testo = await readTextFile(FILE, { baseDir: BaseDirectory.AppConfig });
    const parsed = JSON.parse(testo);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is RecentEntry =>
        typeof v === "object" &&
        v !== null &&
        typeof v.path === "string" &&
        typeof v.nome === "string" &&
        typeof v.lastOpenedAt === "number",
    );
  } catch {
    return [];
  }
}

async function scriviGrezzo(voci: RecentEntry[]): Promise<void> {
  await mkdir("", { baseDir: BaseDirectory.AppConfig, recursive: true }).catch(() => {
    // la base directory potrebbe già esistere; non è un errore
  });
  const tmp = `${FILE}.tmp`;
  const json = JSON.stringify(voci, null, 2);
  await writeTextFile(tmp, json, { baseDir: BaseDirectory.AppConfig });
  await rename(tmp, FILE, {
    oldPathBaseDir: BaseDirectory.AppConfig,
    newPathBaseDir: BaseDirectory.AppConfig,
  });
}

export async function listaRecenti(): Promise<RecentEntryConStato[]> {
  const voci = await leggiGrezzo();
  const conStato: RecentEntryConStato[] = [];
  for (const v of voci) {
    let esiste = false;
    try {
      await autorizzaCartella(v.path);
      esiste = await exists(v.path);
    } catch {
      esiste = false;
    }
    conStato.push({ ...v, esiste });
  }
  return conStato.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export async function aggiungiRecente(path: string, nome: string): Promise<void> {
  const ora = Date.now();
  const voci = await leggiGrezzo();
  const senzaDuplicati = voci.filter((v) => v.path !== path);
  senzaDuplicati.unshift({ path, nome, lastOpenedAt: ora });
  const troncate = senzaDuplicati.slice(0, MAX_VOCI);
  await scriviGrezzo(troncate);
}

export async function rimuoviRecente(path: string): Promise<void> {
  const voci = await leggiGrezzo();
  await scriviGrezzo(voci.filter((v) => v.path !== path));
}

export async function aggiornaNomeRecente(path: string, nome: string): Promise<void> {
  const voci = await leggiGrezzo();
  const aggiornate = voci.map((v) => (v.path === path ? { ...v, nome } : v));
  await scriviGrezzo(aggiornate);
}
