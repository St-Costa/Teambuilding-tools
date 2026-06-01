export function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Dimensione del cerchietto come FRAZIONE del lato maggiore della mappa
// renderizzata (non un valore in px): usata IDENTICA in regia (AreaMappa) e in
// proiezione (Scena) così i cerchietti hanno la stessa dimensione relativa alla
// mappa su entrambi gli schermi, e scalano con la risoluzione. Alza/abbassa
// questo valore per cerchietti più grandi/piccoli ovunque.
export const FRAZIONE_CERCHIETTO = 0.072;
export const RAPPORTO_QUADRATINO = 0.8; // quadratino-oggetto = 80% del cerchietto
// Piccolo "rientro" diagonale del quadratino verso il centro (proporzionale al
// cerchietto; equivaleva a -10px sul vecchio cerchietto da ~116px).
export const RIENTRO_QUADRATINO = 0.086;

// Annotazioni sulla mappa (simboli emoji + etichette di testo). La dimensione
// è una frazione del lato maggiore della mappa renderizzata, come
// FRAZIONE_CERCHIETTO, così scala identica in regia e proiezione.
export const EMOJI_ANNOTAZIONI = [
  "🚫", // inaccessibile
  "⛔", // stop
  "⚠️", // pericolo
  "❌", // distrutto / eliminato
  "✅", // ok
  "⬆️", // freccia su
  "➡️", // freccia destra
  "⬇️", // freccia giù
  "⬅️", // freccia sinistra
  "🔥", // fuoco
  "💀", // letale
  "🚩", // punto di interesse
  "⭐", // obiettivo
  "🔒", // bloccato
  "❓", // mistero
  "🐺", // lupo
  "🪨", // carbone / roccia (non esiste un'emoji dedicata al carbone)
] as const;

export const DIM_ANNOTAZIONE_SIMBOLO_DEFAULT = 0.06;
export const DIM_ANNOTAZIONE_TESTO_DEFAULT = 0.045;

/** Font-size in px di un'annotazione dato il lato maggiore della mappa. */
export function fontSizeAnnotazione(dimensione: number, latoMaggiore: number): number {
  return Math.round(dimensione * latoMaggiore);
}

/** Diametro del cerchietto dato il rettangolo della mappa renderizzata. */
export function dimensioneCerchietto(rett: RettangoloContenuto): number {
  return Math.round(Math.max(rett.larghezza, rett.altezza) * FRAZIONE_CERCHIETTO);
}

export interface RettangoloContenuto {
  larghezza: number;
  altezza: number;
  offsetX: number;
  offsetY: number;
}

export function rettangoloContain(
  contenutoLarghezza: number,
  contenutoAltezza: number,
  contenitoreLarghezza: number,
  contenitoreAltezza: number,
): RettangoloContenuto {
  if (
    contenutoLarghezza <= 0 ||
    contenutoAltezza <= 0 ||
    contenitoreLarghezza <= 0 ||
    contenitoreAltezza <= 0
  ) {
    return { larghezza: 0, altezza: 0, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(
    contenitoreLarghezza / contenutoLarghezza,
    contenitoreAltezza / contenutoAltezza,
  );
  const larghezza = contenutoLarghezza * scale;
  const altezza = contenutoAltezza * scale;
  const offsetX = (contenitoreLarghezza - larghezza) / 2;
  const offsetY = (contenitoreAltezza - altezza) / 2;
  return { larghezza, altezza, offsetX, offsetY };
}
