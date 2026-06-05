import {
  copyFile,
  exists,
  mkdir,
  readFile,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  Ambientazione,
  AmbientazioneCorrotta,
  CartellaNonValida,
  IOError,
  nuovoManifest,
  validaAmbientazione,
} from "./ambientazione";

const MANIFEST = "ambientazione.json";
const MANIFEST_TMP = "ambientazione.json.tmp";

function joinPath(folder: string, ...parts: string[]): string {
  const sep = folder.includes("\\") && !folder.includes("/") ? "\\" : "/";
  const trimmed = folder.replace(/[\/\\]+$/, "");
  return [trimmed, ...parts].join(sep);
}

async function wrapIO<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw new IOError(`${op}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function autorizzaCartella(folderPath: string): Promise<void> {
  try {
    await invoke<void>("allow_ambientazione_folder", { path: folderPath });
  } catch (e) {
    throw new IOError(`autorizzazione cartella: ${String(e)}`);
  }
}

export async function creaAmbientazione(
  folderPath: string,
  nome: string,
): Promise<Ambientazione> {
  await autorizzaCartella(folderPath);

  await wrapIO("creazione cartella", async () => {
    await mkdir(folderPath, { recursive: true });
    await mkdir(joinPath(folderPath, "personaggi"), { recursive: true });
    await mkdir(joinPath(folderPath, "oggetti"), { recursive: true });
  });

  const manifest = nuovoManifest(nome);
  await scriviManifest(folderPath, manifest);
  return manifest;
}

export async function apriAmbientazione(folderPath: string): Promise<Ambientazione> {
  await autorizzaCartella(folderPath);

  const manifestPath = joinPath(folderPath, MANIFEST);
  const presente = await wrapIO("verifica manifest", () => exists(manifestPath));
  if (!presente) throw new CartellaNonValida(folderPath);

  const testo = await wrapIO("lettura manifest", () => readTextFile(manifestPath));
  let raw: unknown;
  try {
    raw = JSON.parse(testo);
  } catch {
    throw new AmbientazioneCorrotta("il manifest non è JSON valido");
  }
  return validaAmbientazione(raw);
}

export async function salvaAmbientazione(
  folderPath: string,
  ambientazione: Ambientazione,
): Promise<Ambientazione> {
  const aggiornata: Ambientazione = {
    ...ambientazione,
    modificataIl: new Date().toISOString(),
  };
  await scriviManifest(folderPath, aggiornata);
  return aggiornata;
}

async function scriviManifest(
  folderPath: string,
  ambientazione: Ambientazione,
): Promise<void> {
  const finalePath = joinPath(folderPath, MANIFEST);
  const tmpPath = joinPath(folderPath, MANIFEST_TMP);
  const json = JSON.stringify(ambientazione, null, 2);

  await wrapIO("scrittura manifest", async () => {
    await writeTextFile(tmpPath, json);
    await rename(tmpPath, finalePath);
  });
}

export async function cartellaEsiste(folderPath: string): Promise<boolean> {
  try {
    await autorizzaCartella(folderPath);
    return await exists(folderPath);
  } catch {
    return false;
  }
}

const ESTENSIONI_IMMAGINE = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);

function estensioneDi(path: string): string {
  const ultimo = path.split(/[\/\\]/).pop() ?? "";
  const dot = ultimo.lastIndexOf(".");
  if (dot === -1 || dot === ultimo.length - 1) return "png";
  return ultimo.slice(dot + 1).toLowerCase();
}

export async function copiaImmagineInCartella(
  folderPath: string,
  sourceAbsPath: string,
  subdir: "personaggi" | "oggetti" | "",
  baseId: string,
): Promise<string> {
  const ext = estensioneDi(sourceAbsPath);
  const safeExt = ESTENSIONI_IMMAGINE.has(ext) ? ext : "png";
  const relativo = subdir === "" ? `${baseId}.${safeExt}` : `${subdir}/${baseId}.${safeExt}`;
  const dest = joinPath(folderPath, relativo);

  await wrapIO("copia immagine", () => copyFile(sourceAbsPath, dest));
  return relativo;
}

export function risolviAsset(folderPath: string, relativePath: string): string {
  return convertFileSrc(joinPath(folderPath, relativePath));
}

const ESTENSIONI_AUDIO = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);

export async function copiaAudioInCartella(
  folderPath: string,
  sourceAbsPath: string,
  subdir: "audio",
  baseId: string,
): Promise<string> {
  const ext = estensioneDi(sourceAbsPath);
  const safeExt = ESTENSIONI_AUDIO.has(ext) ? ext : "mp3";
  const relativo = `${subdir}/${baseId}.${safeExt}`;
  const dest = joinPath(folderPath, relativo);

  // assicura che la sottocartella esista
  await wrapIO("creazione cartella audio", () =>
    mkdir(joinPath(folderPath, subdir), { recursive: true }),
  );
  await wrapIO("copia audio", () => copyFile(sourceAbsPath, dest));
  return relativo;
}

const ESTENSIONI_PRESENTAZIONE = new Set(["pdf"]);

export async function copiaPresentazioneInCartella(
  folderPath: string,
  sourceAbsPath: string,
  baseId: string,
): Promise<string> {
  const ext = estensioneDi(sourceAbsPath);
  const safeExt = ESTENSIONI_PRESENTAZIONE.has(ext) ? ext : "pdf";
  const relativo = `presentazione/${baseId}.${safeExt}`;
  const dest = joinPath(folderPath, relativo);

  await wrapIO("creazione cartella presentazione", () =>
    mkdir(joinPath(folderPath, "presentazione"), { recursive: true }),
  );
  await wrapIO("copia presentazione", () => copyFile(sourceAbsPath, dest));
  return relativo;
}

// Legge i byte del PDF (richiede il permesso fs:allow-read-file). Li passiamo a
// pdf.js come { data } invece di usare l'asset URL: più robusto su WebKitGTK
// (niente range-request sul custom protocol) e identico sulle tre piattaforme.
export async function leggiBytesPresentazione(
  folderPath: string,
  relativePath: string,
): Promise<Uint8Array> {
  return wrapIO("lettura presentazione", () =>
    readFile(joinPath(folderPath, relativePath)),
  );
}

export async function eliminaAmbientazione(folderPath: string): Promise<void> {
  await autorizzaCartella(folderPath);
  await wrapIO("eliminazione cartella ambientazione", () =>
    remove(folderPath, { recursive: true }),
  );
}
