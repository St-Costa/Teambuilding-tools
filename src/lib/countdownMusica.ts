// Calcolo della durata countdown per incastrare la musica "a sandwich".
//
// La sequenza audio è start → loop×N → end. La durata totale può assumere solo
// valori discreti S + N·L + E (N intero ≥ 0). Dato il tempo richiesto dal
// conduttore, scegliamo il PIÙ PICCOLO N tale che la durata audio sia ≥ tempo
// richiesto: così la fine di end.mp3 coincide (entro l'arrotondamento al
// secondo) con lo zero del countdown.
//
// REGOLA: la durata può solo essere ALLUNGATA, mai accorciata. Per questo si usa
// ceil sia per N sia per la durata finale (così end.mp3 non viene mai tagliato).

export interface RisultatoCountdown {
  /** Ripetizioni del loop. */
  n: number;
  /** Durata effettiva del countdown in secondi (intera, ≥ durata richiesta). */
  durataSec: number;
}

/**
 * @param durataRichiestaSec durata impostata dal conduttore, in secondi
 * @param startMs durata di start.mp3 in millisecondi
 * @param loopMs  durata di loop.mp3 in millisecondi
 * @param endMs   durata di end.mp3 in millisecondi
 */
export function calcolaCountdownConMusica(
  durataRichiestaSec: number,
  startMs: number,
  loopMs: number,
  endMs: number,
): RisultatoCountdown {
  const richiestaMs = Math.max(0, durataRichiestaSec) * 1000;
  const baseMs = startMs + endMs; // sequenza minima, N=0
  // N = ceil((richiesta − base) / loop), mai sotto 0. Se loop non è valido,
  // ripieghiamo su N=0 per evitare divisioni per zero.
  let n = 0;
  if (loopMs > 0 && richiestaMs > baseMs) {
    n = Math.ceil((richiestaMs - baseMs) / loopMs);
  }
  const totaleMs = baseMs + n * loopMs;
  // ceil al secondo: la durata effettiva è ≥ durata audio, così l'audio termina
  // un istante prima dello zero e non viene mai tagliato.
  const durataSec = Math.ceil(totaleMs / 1000);
  return { n, durataSec };
}
