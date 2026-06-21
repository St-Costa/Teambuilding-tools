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
  oggettoInizialeId: string | null;
  // NPC = personaggio non giocante: escluso dalla classifica/leaderboard ma
  // selezionabile nei conflitti (ruota). Sulla mappa ha il bordo tratteggiato.
  npc: boolean;
}

export interface Oggetto {
  id: string;
  nome: string;
  imgPath: string;
  crop: Crop;
}

export type TipoAnnotazione = "simbolo" | "testo";

export interface Annotazione {
  id: string;
  tipo: TipoAnnotazione;
  contenuto: string; // emoji (simbolo) oppure testo digitato (testo)
  posizione: Posizione; // x,y normalizzate 0–1 = CENTRO (come i personaggi)
  dimensione: number; // frazione del lato maggiore mappa → guida il font-size
  colore: string | null; // solo per "testo": colore del testo (null = default)
}

// Range della dimensione (frazione del lato maggiore della mappa) di
// un'annotazione: clamp di sicurezza usato sia in validazione sia nel resize.
export const DIM_ANNOTAZIONE_MIN = 0.01;
export const DIM_ANNOTAZIONE_MAX = 0.5;

export const NUM_SLOT_SOUNDBOARD = 6;

export interface SlotSoundboard {
  id: string;
  emoji: string;
  audioPath: string | null;
}

export interface Ambientazione {
  schemaVersion: SchemaVersion;
  nome: string;
  creataIl: string;
  modificataIl: string;
  mappaPath: string | null;
  personaggi: Personaggio[];
  oggetti: Oggetto[];
  annotazioni: Annotazione[];
  obiettivi: [string, string, string];
  soundboard: SlotSoundboard[];
  sottofondoPath: string | null;
  // Presentazione delle regole: PDF mostrato sulla proiezione a inizio gioco.
  presentazionePath: string | null; // path relativo es. "presentazione/<id>.pdf"
  // Note per pagina (chiave = numero pagina 1-based). Mappa sparsa: esistono solo
  // per le pagine annotate, e il n° pagine non è noto al momento dell'edit del JSON.
  notePresentazione: Record<number, string>;
  // Immagine fissa: copre tutta la proiezione (sotto il timer) quando attivata.
  immagineFissaPath: string | null;
  // Sfondo del countdown a schermo intero.
  sfondoCountdownPath: string | null;
  // Ordine personalizzato dei personaggi nella leaderboard (array di ID).
  // Se vuoto o assente, si usa l'ordine di `personaggi`.
  leaderboardOrdine: string[];
  // Sfondo della schermata voti (prigionieri).
  sfondoVotiPath: string | null;
  // Asset per l'animazione di incarcerazione (dopo la votazione).
  sfondoPrigionieroPath: string | null;
  suonoPrigionieroPath: string | null; // sbarre che cadono
  suonoPrigionieroStingPath: string | null; // sting orchestrale
  suonoPrigionieroSirenaPath: string | null; // sirena loop
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
  const oggettoInizialeId =
    typeof raw.oggettoInizialeId === "string" && raw.oggettoInizialeId !== ""
      ? raw.oggettoInizialeId
      : null;
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
    oggettoInizialeId,
    // npc opzionale: assente negli scenari precedenti → false.
    npc: raw.npc === true,
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

function validaAnnotazione(raw: unknown, idx: number): Annotazione {
  const ctx = `annotazione[${idx}]`;
  if (!isObject(raw)) throw new AmbientazioneCorrotta(`${ctx} non è un oggetto`);
  if (typeof raw.id !== "string" || raw.id === "") {
    throw new AmbientazioneCorrotta(`${ctx}: id mancante`);
  }
  if (raw.tipo !== "simbolo" && raw.tipo !== "testo") {
    throw new AmbientazioneCorrotta(`${ctx}: tipo non valido`);
  }
  if (typeof raw.contenuto !== "string" || raw.contenuto === "") {
    throw new AmbientazioneCorrotta(`${ctx}: contenuto mancante`);
  }
  if (!isNumeroFinito(raw.dimensione)) {
    throw new AmbientazioneCorrotta(`${ctx}: dimensione non numerica`);
  }
  const colore =
    typeof raw.colore === "string" && /^#[0-9A-Fa-f]{6}$/.test(raw.colore)
      ? raw.colore.toUpperCase()
      : null;
  return {
    id: raw.id,
    tipo: raw.tipo,
    contenuto: raw.contenuto,
    posizione: validaPosizione(raw.posizione, ctx),
    dimensione: Math.min(DIM_ANNOTAZIONE_MAX, Math.max(DIM_ANNOTAZIONE_MIN, raw.dimensione)),
    colore,
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
  // annotazioni: array opzionale, assente nelle ambientazioni precedenti → [].
  const annotazioni: Annotazione[] = Array.isArray(raw.annotazioni)
    ? raw.annotazioni.map((a, i) => validaAnnotazione(a, i))
    : [];
  // obiettivi: array opzionale di 3 stringhe, default vuoti per manifest M5-M8.2.
  const obiettiviRaw = Array.isArray(raw.obiettivi) ? raw.obiettivi : [];
  const obiettivi: [string, string, string] = [
    typeof obiettiviRaw[0] === "string" ? obiettiviRaw[0] : "",
    typeof obiettiviRaw[1] === "string" ? obiettiviRaw[1] : "",
    typeof obiettiviRaw[2] === "string" ? obiettiviRaw[2] : "",
  ];
  const soundboard: SlotSoundboard[] = soundboardIniziale();
  if (Array.isArray(raw.soundboard)) {
    for (let i = 0; i < Math.min(NUM_SLOT_SOUNDBOARD, raw.soundboard.length); i++) {
      const s = raw.soundboard[i];
      if (s && typeof s === "object") {
        const obj = s as Record<string, unknown>;
        if (typeof obj.id === "string") soundboard[i].id = obj.id;
        if (typeof obj.emoji === "string" && obj.emoji.length > 0) soundboard[i].emoji = obj.emoji;
        if (typeof obj.audioPath === "string" && obj.audioPath !== "") {
          soundboard[i].audioPath = obj.audioPath;
        }
      }
    }
  }
  // Validazione referenziale: ogni Personaggio.oggettoId deve puntare a un
  // Oggetto esistente. Se non corrisponde (es. perché l'oggetto è stato
  // eliminato fuori-app), lo ripuliamo silenziosamente — meglio guarire che
  // bocciare l'intera ambientazione.
  const idsOggetti = new Set(oggetti.map((o) => o.id));
  for (const p of personaggi) {
    if (p.oggettoId && !idsOggetti.has(p.oggettoId)) p.oggettoId = null;
  }
  const sottofondoPath =
    typeof raw.sottofondoPath === "string" && raw.sottofondoPath.length > 0
      ? raw.sottofondoPath
      : null;
  // presentazione: campi opzionali, assenti nelle ambientazioni precedenti.
  const presentazionePath =
    typeof raw.presentazionePath === "string" && raw.presentazionePath.length > 0
      ? raw.presentazionePath
      : null;
  const notePresentazione = validaNotePresentazione(raw.notePresentazione);
  const immagineFissaPath =
    typeof raw.immagineFissaPath === "string" && raw.immagineFissaPath.length > 0
      ? raw.immagineFissaPath
      : null;
  const sfondoCountdownPath =
    typeof raw.sfondoCountdownPath === "string" && raw.sfondoCountdownPath.length > 0
      ? raw.sfondoCountdownPath
      : null;
  const leaderboardOrdine: string[] = Array.isArray(raw.leaderboardOrdine)
    ? ((raw.leaderboardOrdine as unknown[]).filter((v) => typeof v === "string") as string[])
    : [];
  const sfondoVotiPath =
    typeof raw.sfondoVotiPath === "string" && raw.sfondoVotiPath.length > 0
      ? raw.sfondoVotiPath
      : null;
  const sfondoPrigionieroPath =
    typeof raw.sfondoPrigionieroPath === "string" && raw.sfondoPrigionieroPath.length > 0
      ? raw.sfondoPrigionieroPath
      : null;
  const suonoPrigionieroPath =
    typeof raw.suonoPrigionieroPath === "string" && raw.suonoPrigionieroPath.length > 0
      ? raw.suonoPrigionieroPath
      : null;
  const suonoPrigionieroStingPath =
    typeof raw.suonoPrigionieroStingPath === "string" && raw.suonoPrigionieroStingPath.length > 0
      ? raw.suonoPrigionieroStingPath
      : null;
  const suonoPrigionieroSirenaPath =
    typeof raw.suonoPrigionieroSirenaPath === "string" && raw.suonoPrigionieroSirenaPath.length > 0
      ? raw.suonoPrigionieroSirenaPath
      : null;
  return {
    schemaVersion: SCHEMA_VERSION,
    nome: raw.nome,
    creataIl: raw.creataIl,
    modificataIl: raw.modificataIl,
    mappaPath: raw.mappaPath,
    personaggi,
    oggetti,
    annotazioni,
    obiettivi,
    soundboard,
    sottofondoPath,
    presentazionePath,
    notePresentazione,
    immagineFissaPath,
    sfondoCountdownPath,
    leaderboardOrdine,
    sfondoVotiPath,
    sfondoPrigionieroPath,
    suonoPrigionieroPath,
    suonoPrigionieroStingPath,
    suonoPrigionieroSirenaPath,
  };
}

// Le note presentazione in JSON hanno chiavi stringa (es. "1","2"): accettiamo
// solo chiavi intere >= 1 con valore stringa non vuota, scartando il resto.
function validaNotePresentazione(raw: unknown): Record<number, string> {
  const out: Record<number, string> = {};
  if (!isObject(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && typeof v === "string" && v !== "") {
      out[n] = v;
    }
  }
  return out;
}

function soundboardIniziale(): SlotSoundboard[] {
  const out: SlotSoundboard[] = [];
  for (let i = 0; i < NUM_SLOT_SOUNDBOARD; i++) {
    out.push({ id: `slot-${i}`, emoji: "🔘", audioPath: null });
  }
  return out;
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
    annotazioni: [],
    obiettivi: ["", "", ""],
    soundboard: soundboardIniziale(),
    sottofondoPath: null,
    presentazionePath: null,
    notePresentazione: {},
    immagineFissaPath: null,
    sfondoCountdownPath: null,
    leaderboardOrdine: [],
    sfondoVotiPath: null,
    sfondoPrigionieroPath: null,
    suonoPrigionieroPath: null,
    suonoPrigionieroStingPath: null,
    suonoPrigionieroSirenaPath: null,
  };
}

const NOME_INVALIDO = /[/\\:*?"<>|]/;

export function validaNome(nome: string): string | null {
  const trimmed = nome.trim();
  if (trimmed === "") return "Il nome non può essere vuoto.";
  if (NOME_INVALIDO.test(trimmed)) return 'Il nome non può contenere: / \\ : * ? " < > |';
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

export function oggettoDi(personaggio: Personaggio, oggetti: Oggetto[]): Oggetto | null {
  if (!personaggio.oggettoId) return null;
  return oggetti.find((o) => o.id === personaggio.oggettoId) ?? null;
}

export function cropIniziale(): Crop {
  return { zoom: 1, offsetX: 0, offsetY: 0 };
}
