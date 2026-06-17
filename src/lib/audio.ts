// ───────────────────────── Audio di gioco ───────────────────────────────────
// Deroga all'audio FUORI SCOPE di CLAUDE.md §0: confermata dall'utente per i
// segnali di gioco. NESSUNA API di output device.
//
// Tutti i suoni (tick ruota, beep timer, vittoria, soundboard) girano nel
// backend Rust (rodio) via invoke(). Questo elimina ogni interazione con
// WebKitGTK/GStreamer, causa dei crash precedenti.

import { invoke } from "@tauri-apps/api/core";

/**
 * Tick della ruota: suonato dal backend nativo (bassa latenza). Da chiamare
 * sull'attraversamento reale di un confine di fetta. Fire-and-forget.
 */
export function playTick(): void {
  void invoke("play_tick").catch(() => undefined);
}

/** Via al timer: due note ascendenti. */
export function playInizioTimer(): void {
  void invoke("play_beep_inizio").catch(() => undefined);
}

/** Campanello: un minuto residuo. */
export function playCampanello(): void {
  void invoke("play_campana").catch(() => undefined);
}

/** Ferma il campanello del minuto (es. allo scadere, prima della sveglia). */
export function fermaCampanello(): void {
  void invoke("stop_campana").catch(() => undefined);
}

/** Sveglia: tempo scaduto. Va in loop finché non si chiama fermaSveglia(). */
export function playSveglia(): void {
  void invoke("play_sveglia").catch(() => undefined);
}

/** Ferma la sveglia (esce dal loop). */
export function fermaSveglia(): void {
  void invoke("stop_sveglia").catch(() => undefined);
}

/** Ferma TUTTI i suoni del timer (es. al reset). */
export function fermaTimerSuoni(): void {
  void invoke("ferma_timer_suoni").catch(() => undefined);
}

/** Sbarre prigioniero: parte da offsetMs nell'mp3, fire-and-forget via Rust. */
export function playPrigionieroSbarre(absPath: string, offsetMs: number): void {
  void invoke("play_soundboard_slot_da", { path: absPath, volume: 1.0, offsetMs }).catch(() => undefined);
}

/** Ambience prigioniero: sink stoppabile, si ferma alla chiusura. */
export function playPrigionieroAmbience(absPath: string): void {
  void invoke("play_prigioniero_sirena", { path: absPath, volume: 1.87 }).catch(() => undefined);
}

export function stopPrigionieroAmbience(): void {
  void invoke("stop_prigioniero_suoni").catch(() => undefined);
}

/** Durata in ms di un file audio (letta dai metadati via Rust). */
export async function durataAudioMs(absPath: string): Promise<number> {
  return invoke<number>("durata_audio_ms", { path: absPath });
}

// ───────────────── Musica della fase countdown (sandwich) ───────────────────
// Sequenza start → loop×n → end suonata gapless dal backend Rust.

/** Avvia la sequenza musicale countdown con n ripetizioni del loop. */
export function playCountdownMusica(n: number): void {
  void invoke("play_countdown_musica", { n }).catch(() => undefined);
}

/** Mette in pausa la musica countdown (es. timer in pausa). */
export function pausaCountdownMusica(): void {
  void invoke("pausa_countdown_musica").catch(() => undefined);
}

/** Riprende la musica countdown dopo una pausa. */
export function riprendiCountdownMusica(): void {
  void invoke("riprendi_countdown_musica").catch(() => undefined);
}

/** Ferma la musica countdown (es. reset/uscita dalla fase). */
export function fermaCountdownMusica(): void {
  void invoke("ferma_countdown_musica").catch(() => undefined);
}

/** Durate [start, loop, end] in ms dei file countdown embedded. */
export async function durateCountdownAudio(): Promise<[number, number, number]> {
  return invoke<[number, number, number]>("durate_countdown_audio");
}
