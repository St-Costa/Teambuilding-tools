// ───────────────────────── Audio di gioco ───────────────────────────────────
// Deroga all'audio FUORI SCOPE di CLAUDE.md §0: confermata dall'utente per i
// segnali di gioco. NESSUNA API di output device.
//
// DUE STRADE, ognuna scelta perché FUNZIONA su questo stack:
//  1. Beep del timer (inizio/1-min/scaduto): MP3 brevi riprodotti nel webview
//     via HTMLAudioElement+blob. Eventi radi, non serve bassa latenza.
//  2. Tick della ruota: riprodotti dal BACKEND nativo (Rust/rodio) via il
//     comando `play_tick`. L'uscita audio del webview (WebKitGTK) ha latenza
//     alta e variabile → i tick andavano sempre fuori sync; il backend ha
//     latenza bassa e costante, così il click coincide col passaggio della
//     freccia.

import { invoke } from "@tauri-apps/api/core";
import inizioUrl from "../assets/suoni/timer-inizio.mp3";
import unMinUrl from "../assets/suoni/timer-1min.mp3";
import scadutoUrl from "../assets/suoni/timer-scaduto.mp3";

// Durata di un ciclo completo della sveglia di fine (4 beep + ~1s di pausa):
// la regia la usa per ripetere il suono fino al reset.
export const SVEGLIA_DURATA_TOTALE_MS = (0.14 * 4 + 1) * 1000;

const INIZIO = 0;
const UN_MIN = 1;
const SCADUTO = 2;
const sorgenti = [inizioUrl, unMinUrl, scadutoUrl];
const elementi: Array<HTMLAudioElement | null> = [null, null, null];

let gestoFatto = false;

// "Sblocca" un elemento: un play a volume 0 dentro lo stack di un gesto utente
// abilita i play programmatici successivi su quello stesso elemento.
function sblocca(a: HTMLAudioElement): void {
  try {
    a.volume = 0;
    const p = a.play();
    if (p && typeof p.then === "function") {
      void p
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = 1;
        })
        .catch(() => {
          a.volume = 1;
        });
    } else {
      a.pause();
      a.currentTime = 0;
      a.volume = 1;
    }
  } catch {
    a.volume = 1;
  }
}

// Precarica i beep del timer come blob in memoria (mirror del soundboard).
void Promise.all(
  sorgenti.map(async (url, i) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = new Audio(URL.createObjectURL(blob));
      a.preload = "auto";
      elementi[i] = a;
      if (gestoFatto) sblocca(a);
    } catch {
      // se il caricamento fallisce, quel suono resterà muto
    }
  }),
);

/**
 * Aggancia il primo pointerdown/keydown della finestra e sblocca i beep del
 * timer già caricati (e quelli che finiranno di caricarsi dopo). Idempotente.
 * Restituisce una funzione di cleanup. (Il tick della ruota è nativo: non
 * richiede sblocco.)
 */
export function abilitaAudioAlPrimoGesto(): () => void {
  if (gestoFatto) return () => undefined;

  const handler = () => {
    gestoFatto = true;
    for (const a of elementi) if (a) sblocca(a);
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };

  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
  return () => {
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
}

function suona(i: number): void {
  const a = elementi[i];
  if (!a) return;
  try {
    a.volume = 1;
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  } catch {
    // silenziosi in caso di errore
  }
}

/**
 * Tick della ruota: suonato dal backend nativo (bassa latenza). Da chiamare
 * sull'attraversamento reale di un confine di fetta. Fire-and-forget.
 */
export function playTick(): void {
  void invoke("play_tick").catch(() => undefined);
}

/** Via al timer: due note ascendenti. */
export function playInizioTimer(): void {
  suona(INIZIO);
}

/** Campanello: un minuto residuo. */
export function playCampanello(): void {
  suona(UN_MIN);
}

/** Sveglia: tempo scaduto (4 beep). */
export function playSveglia(): void {
  suona(SCADUTO);
}
