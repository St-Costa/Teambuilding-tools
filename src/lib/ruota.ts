// Matematica della ruota della fortuna (CLAUDE.md §5).
//
// Le funzioni sono pure: nessun side-effect, niente DOM. Testabili dalla
// console di devtools importandole direttamente.
//
// CONVENZIONI ANGOLARI:
// - 0° = top della ruota (12 o'clock).
// - Senso ORARIO (positive = clockwise), coerente con CSS rotate.
// - Gli angoli `startAngolo/fineAngolo` sono cumulativi dal top, in gradi.
//
// REGOLA MODIFICATORI (critica, conferma utente):
// - baseFrazione_i = 1/N (eguale ripartizione).
// - Incremento ASSOLUTO: +1 → +0.20 (20 punti percentuali), +2 → +0.40.
//   NB: NON è "+20% della base" come scritto nello spec — l'utente ha precisato
//   in M6 che la fetta è +20% in punti assoluti, non in proporzione alla base.
// - rawTotale_i = baseFrazione_i + incremento_i.
// - S = Σ rawTotale_i.
// - totaleFrazione_i = rawTotale_i / S; base/bonusFrazione rinormalizzati con
//   lo stesso fattore S — proporzioni interne preservate.

export type Modificatore = null | "+1" | "+2";

export interface PartecipanteInput {
  id: string;
  modificatore: Modificatore;
}

export interface FettaCalcolata {
  id: string;
  baseFrazione: number; // 0..1
  bonusFrazione: number; // 0..1 (0 se nessun modificatore)
  totaleFrazione: number; // = baseFrazione + bonusFrazione
  startAngolo: number; // gradi, cumulativo
  fineAngolo: number;
}

function incrementoFrazione(mod: Modificatore): number {
  if (mod === "+1") return 0.2;
  if (mod === "+2") return 0.4;
  return 0;
}

export function calcolaFette(input: PartecipanteInput[]): FettaCalcolata[] {
  const N = input.length;
  if (N === 0) return [];

  const baseEgualed = 1 / N;
  const grezzi = input.map((p) => {
    // Incremento assoluto: +0.20 o +0.40, indipendente dal numero di partecipanti.
    const inc = incrementoFrazione(p.modificatore);
    return {
      id: p.id,
      baseGrezzo: baseEgualed,
      bonusGrezzo: inc,
      totaleGrezzo: baseEgualed + inc,
    };
  });

  const S = grezzi.reduce((acc, g) => acc + g.totaleGrezzo, 0);
  if (S <= 0) return [];

  let angoloCorrente = 0;
  return grezzi.map((g) => {
    const baseFrazione = g.baseGrezzo / S;
    const bonusFrazione = g.bonusGrezzo / S;
    const totaleFrazione = g.totaleGrezzo / S;
    const startAngolo = angoloCorrente;
    const fineAngolo = startAngolo + totaleFrazione * 360;
    angoloCorrente = fineAngolo;
    return {
      id: g.id,
      baseFrazione,
      bonusFrazione,
      totaleFrazione,
      startAngolo,
      fineAngolo,
    };
  });
}

export function scegliVincitorePesato(
  fette: FettaCalcolata[],
  rand: () => number = Math.random,
): number {
  if (fette.length === 0) return -1;
  let r = rand();
  for (let i = 0; i < fette.length; i++) {
    r -= fette[i].totaleFrazione;
    if (r < 0) return i;
  }
  return fette.length - 1; // fallback float drift
}

// Calcola un angolo target da assegnare a `transform: rotate(Xdeg)` per
// far fermare la ruota con la freccia (al top) dentro la fetta vincente.
//
// La freccia è fissa al top (angolo screen = 0). Per posizionarla dentro la
// fetta i, dopo la rotazione θ il top deve cadere nella fetta. Pre-rotazione
// la fetta occupa [start_i, fine_i); dopo rotazione θ (in senso orario) la
// fetta occupa [start_i + θ, fine_i + θ). Top = 0 sta dentro la fetta se
// θ ≡ -start_i - offset (mod 360) con offset ∈ [0, width_i).
//
// Aggiungiamo K full-turn extra per visualizzare la rotazione.
export function angoloDiArresto(
  vincitoreIdx: number,
  fette: FettaCalcolata[],
  opts?: { giriPieni?: number; rand?: () => number; margineFetta?: number },
): number {
  const { giriPieni = 6, rand = Math.random, margineFetta = 0.1 } = opts ?? {};
  if (vincitoreIdx < 0 || vincitoreIdx >= fette.length) return giriPieni * 360;
  const f = fette[vincitoreIdx];
  const width = f.fineAngolo - f.startAngolo;
  // offset uniforme dentro [margine, 1-margine] della fetta, evita estremi
  const offsetFrac = margineFetta + rand() * (1 - 2 * margineFetta);
  const offset = width * offsetFrac;
  // angolo target normalizzato (0..360) tale che (target + start + offset) ≡ 0 (mod 360)
  const baseTarget = (((-f.startAngolo - offset) % 360) + 360) % 360;
  return giriPieni * 360 + baseTarget;
}
