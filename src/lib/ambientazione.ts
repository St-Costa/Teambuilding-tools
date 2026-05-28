export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export interface Crop {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export interface Posizione {
  x: number;
  y: number;
}

export interface Personaggio {
  id: string;
  nome: string;
  colore: string;
  imgPath: string;
  crop: Crop;
  posizione: Posizione;
  posizioneIniziale: Posizione | null;
  oggettoId: string | null;
}

export interface Oggetto {
  id: string;
  nome: string;
  imgPath: string;
  crop: Crop;
}

export interface Ambientazione {
  schemaVersion: SchemaVersion;
  nome: string;
  creataIl: string;
  modificataIl: string;
  mappaPath: string | null;
  personaggi: Personaggio[];
  oggetti: Oggetto[];
  obiettivi: [string, string, string];
}

export class AmbientazioneCorrotta extends Error {
  constructor(public readonly dettaglio: string) {
    super(`L'ambientazione è corrotta: ${dettaglio}`);
    this.name = "AmbientazioneCorrotta";
  }
}

export class CartellaNonValida extends Error {
  constructor(public readonly path: string) {
    super(`La cartella non è un'ambientazione valida: ${path}`);
    this.name = "CartellaNonValida";
  }
}

export class IOError extends Error {
  constructor(public readonly causa: string) {
    super(`Errore di accesso al file system: ${causa}`);
    this.name = "IOError";
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function isNumeroFinito(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function validaCrop(raw: unknown, ctx: string): Crop {
  if (!isObject(raw)) throw new AmbientazioneCorrotta(`${ctx}: crop non è un oggetto`);
  if (!isNumeroFinito(raw.zoom) || !isNumeroFinito(raw.offsetX) || !isNumeroFinito(raw.offsetY)) {
    throw new AmbientazioneCorrotta(`${ctx}: crop ha campi non numerici`);
  }
  return { zoom: raw.zoom, offsetX: raw.offsetX, offsetY: raw.offsetY };
}

function validaPosizione(raw: unknown, ctx: string): Posizione {
  if (!isObject(raw)) throw new AmbientazioneCorrotta(`${ctx}: posizione non è un oggetto`);
  if (!isNumeroFinito(raw.x) || !isNumeroFinito(raw.y)) {
    throw new AmbientazioneCorrotta(`${ctx}: posizione ha coordinate non numeriche`);
  }
  return { x: clamp01(raw.x), y: clamp01(raw.y) };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function validaPersonaggio(raw: unknown, idx: number): Personaggio {
  const ctx = `personaggio[${idx}]`;
  if (!isObject(raw)) throw new AmbientazioneCorrotta(`${ctx} non è un oggetto`);
  if (typeof raw.id !== "string" || raw.id === "") {
    throw new AmbientazioneCorrotta(`${ctx}: id mancante`);
  }
  if (typeof raw.nome !== "string" || raw.nome.trim() === "") {
    throw new AmbientazioneCorrotta(`${ctx}: nome mancante o vuoto`);
  }
  if (typeof raw.colore !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(raw.colore)) {
    throw new AmbientazioneCorrotta(`${ctx}: colore non è un esadecimale valido`);
  }
  if (typeof raw.imgPath !== "string" || raw.imgPath === "") {
    throw new AmbientazioneCorrotta(`${ctx}: imgPath mancante`);
  }
  const oggettoId =
    typeof raw.oggettoId === "string" && raw.oggettoId !== "" ? raw.oggettoId : null;
  // posizioneIniziale opzionale: assente in manifest M5/M6 → null.
  let posizioneIniziale: Posizione | null = null;
  if (raw.posizioneIniziale !== undefined && raw.posizioneIniziale !== null) {
    posizioneIniziale = validaPosizione(raw.posizioneIniziale, `${ctx}.posizioneIniziale`);
  }
  return {
    id: raw.id,
    nome: raw.nome,
    colore: raw.colore.toUpperCase(),
    imgPath: raw.imgPath,
    crop: validaCrop(raw.crop, ctx),
    posizione: validaPosizione(raw.posizione, ctx),
    posizioneIniziale,
    oggettoId,
  };
}

function validaOggetto(raw: unknown, idx: number): Oggetto {
  const ctx = `oggetto[${idx}]`;
  if (!isObject(raw)) throw new AmbientazioneCorrotta(`${ctx} non è un oggetto`);
  if (typeof raw.id !== "string" || raw.id === "") {
    throw new AmbientazioneCorrotta(`${ctx}: id mancante`);
  }
  if (typeof raw.nome !== "string" || raw.nome.trim() === "") {
    throw new AmbientazioneCorrotta(`${ctx}: nome mancante o vuoto`);
  }
  if (typeof raw.imgPath !== "string" || raw.imgPath === "") {
    throw new AmbientazioneCorrotta(`${ctx}: imgPath mancante`);
  }
  return {
    id: raw.id,
    nome: raw.nome,
    imgPath: raw.imgPath,
    crop: validaCrop(raw.crop, ctx),
  };
}

export function validaAmbientazione(raw: unknown): Ambientazione {
  if (!isObject(raw)) {
    throw new AmbientazioneCorrotta("il manifest non è un oggetto JSON");
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw new AmbientazioneCorrotta(
      `versione schema non supportata (attesa ${SCHEMA_VERSION}, trovata ${String(raw.schemaVersion)})`,
    );
  }
  if (typeof raw.nome !== "string" || raw.nome.trim() === "") {
    throw new AmbientazioneCorrotta("il nome è mancante o vuoto");
  }
  if (typeof raw.creataIl !== "string" || typeof raw.modificataIl !== "string") {
    throw new AmbientazioneCorrotta("i timestamp di creazione/modifica sono mancanti");
  }
  if (!isStringOrNull(raw.mappaPath)) {
    throw new AmbientazioneCorrotta("mappaPath non è una stringa o null");
  }
  if (!Array.isArray(raw.personaggi) || !Array.isArray(raw.oggetti)) {
    throw new AmbientazioneCorrotta("personaggi/oggetti non sono array");
  }
  const personaggi = raw.personaggi.map((p, i) => validaPersonaggio(p, i));
  const oggetti = raw.oggetti.map((o, i) => validaOggetto(o, i));
  // obiettivi: array opzionale di 3 stringhe, default vuoti per manifest M5-M8.2.
  const obiettiviRaw = Array.isArray(raw.obiettivi) ? raw.obiettivi : [];
  const obiettivi: [string, string, string] = [
    typeof obiettiviRaw[0] === "string" ? obiettiviRaw[0] : "",
    typeof obiettiviRaw[1] === "string" ? obiettiviRaw[1] : "",
    typeof obiettiviRaw[2] === "string" ? obiettiviRaw[2] : "",
  ];
  // Validazione referenziale: ogni Personaggio.oggettoId deve puntare a un
  // Oggetto esistente. Se non corrisponde (es. perché l'oggetto è stato
  // eliminato fuori-app), lo ripuliamo silenziosamente — meglio guarire che
  // bocciare l'intera ambientazione.
  const idsOggetti = new Set(oggetti.map((o) => o.id));
  for (const p of personaggi) {
    if (p.oggettoId && !idsOggetti.has(p.oggettoId)) p.oggettoId = null;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    nome: raw.nome,
    creataIl: raw.creataIl,
    modificataIl: raw.modificataIl,
    mappaPath: raw.mappaPath,
    personaggi,
    oggetti,
    obiettivi,
  };
}

export function nuovoManifest(nome: string): Ambientazione {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    nome,
    creataIl: now,
    modificataIl: now,
    mappaPath: null,
    personaggi: [],
    oggetti: [],
    obiettivi: ["", "", ""],
  };
}

const NOME_INVALIDO = /[\/\\:*?"<>|]/;

export function validaNome(nome: string): string | null {
  const trimmed = nome.trim();
  if (trimmed === "") return "Il nome non può essere vuoto.";
  if (NOME_INVALIDO.test(trimmed)) return "Il nome non può contenere: / \\ : * ? \" < > |";
  if (trimmed.length > 100) return "Il nome è troppo lungo (massimo 100 caratteri).";
  return null;
}

export function validaNomePersonaggio(
  nome: string,
  personaggiEsistenti: Personaggio[],
  esclusoId?: string,
): string | null {
  const trimmed = nome.trim();
  if (trimmed === "") return "Il nome non può essere vuoto.";
  if (trimmed.length > 50) return "Il nome è troppo lungo (massimo 50 caratteri).";
  const collisione = personaggiEsistenti.some(
    (p) => p.id !== esclusoId && p.nome.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (collisione) return "Esiste già un personaggio con questo nome.";
  return null;
}

export function validaNomeOggetto(
  nome: string,
  oggettiEsistenti: Oggetto[],
  esclusoId?: string,
): string | null {
  const trimmed = nome.trim();
  if (trimmed === "") return "Il nome non può essere vuoto.";
  if (trimmed.length > 50) return "Il nome è troppo lungo (massimo 50 caratteri).";
  const collisione = oggettiEsistenti.some(
    (o) => o.id !== esclusoId && o.nome.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (collisione) return "Esiste già un oggetto con questo nome.";
  return null;
}

export function oggettoDi(
  personaggio: Personaggio,
  oggetti: Oggetto[],
): Oggetto | null {
  if (!personaggio.oggettoId) return null;
  return oggetti.find((o) => o.id === personaggio.oggettoId) ?? null;
}

export function cropIniziale(): Crop {
  return { zoom: 1, offsetX: 0, offsetY: 0 };
}
