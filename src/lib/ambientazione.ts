export const SCHEMA_VERSION = 1 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export interface Personaggio {
  id: string;
}

export interface Oggetto {
  id: string;
}

export interface Ambientazione {
  schemaVersion: SchemaVersion;
  nome: string;
  creataIl: string;
  modificataIl: string;
  mappaPath: string | null;
  personaggi: Personaggio[];
  oggetti: Oggetto[];
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
  return {
    schemaVersion: SCHEMA_VERSION,
    nome: raw.nome,
    creataIl: raw.creataIl,
    modificataIl: raw.modificataIl,
    mappaPath: raw.mappaPath,
    personaggi: raw.personaggi as Personaggio[],
    oggetti: raw.oggetti as Oggetto[],
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
