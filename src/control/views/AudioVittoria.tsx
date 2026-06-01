import { useEffect, useRef } from "react";
import { emit, EVT } from "../../lib/events";
import { useSottofondoStore } from "../../lib/sottofondo";
import { useVittoriaStore } from "../../state/vittoriaStore";
import vittoriaUrl from "../../assets/suoni/vittoria.mp3";
import fuocoUrl from "../../assets/suoni/fuoco.mp3";
import applausoUrl from "../../assets/suoni/applauso.mp3";

// Componente senza UI (montato nella REGIA). Quando l'animazione di vittoria è
// attiva: mette in pausa il sottofondo, suona la musica di vittoria e fa da
// "metronomo" dei fuochi → a ogni scoppio suona fuoco.mp3 E avvisa la
// proiezione (evento vittoria:boom) così suono e visivo coincidono.
//
// RISORSE AUDIO (importante su WebKitGTK/Ubuntu): gli elementi audio sono
// creati UNA SOLA VOLTA a livello di modulo e riusati. Creare `new Audio()` a
// ogni scoppio accendeva una pipeline GStreamer per ogni boom senza mai
// rilasciarla → dopo qualche animazione la pipeline si congestiona (suoni che
// tardano a partire, chiusura lenta). Il pool a rotazione gestisce la
// sovrapposizione con un numero fisso di elementi.
//
// NB: gli MP3 sono asset bundled. Finché i file reali non vengono forniti, i
// play falliscono in silenzio (catch) e l'animazione visiva funziona comunque.

const VOL_MUSICA = 0.18;
const VOL_APPLAUSO = 1.0;
const VOL_FUOCO = 0.7;
const FUOCHI_POOL = 6; // elementi riusati a rotazione per gli scoppi sovrapposti

const musica = new Audio(vittoriaUrl);
musica.preload = "auto";
musica.volume = VOL_MUSICA;

const applauso = new Audio(applausoUrl);
applauso.preload = "auto";
applauso.volume = VOL_APPLAUSO;

const fuochiPool: HTMLAudioElement[] = Array.from({ length: FUOCHI_POOL }, () => {
  const a = new Audio(fuocoUrl);
  a.preload = "auto";
  a.volume = VOL_FUOCO;
  return a;
});
let fuocoIdx = 0;

function riavvolgiEPlay(a: HTMLAudioElement, volume: number): void {
  try {
    a.volume = volume;
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  } catch {
    // ignora (file mancante/non decodificabile)
  }
}

function suonaFuoco(): void {
  const a = fuochiPool[fuocoIdx];
  fuocoIdx = (fuocoIdx + 1) % FUOCHI_POOL;
  riavvolgiEPlay(a, VOL_FUOCO);
}

function fermaAudio(a: HTMLAudioElement): void {
  try {
    a.pause();
    a.currentTime = 0;
  } catch {
    // ignora
  }
}

export default function AudioVittoria() {
  const attiva = useVittoriaStore((s) => s.attiva);
  const trigger = useVittoriaStore((s) => s.trigger);

  const timeoutRef = useRef<number | null>(null);
  const boomId = useRef(0);

  useEffect(() => {
    if (!attiva) return;

    const { pausaPerVittoria, riprendiDaVittoria } = useSottofondoStore.getState();
    pausaPerVittoria();

    // Musica + applauso: elementi precaricati, riavvolti e riprodotti. Il play
    // parte nel contesto del click "Proclama vincitori" → autoplay consentito.
    riavvolgiEPlay(musica, VOL_MUSICA);
    riavvolgiEPlay(applauso, VOL_APPLAUSO);

    // Colori delle scintille: tinte dei vincitori + oro/bianco festosi.
    const coloriVincitori = useVittoriaStore.getState().vincitori.map((v) => v.colore);
    const colori = [...coloriVincitori, "#ffd700", "#ffffff"];

    let vivo = true;
    function scoppia() {
      if (!vivo) return;
      // Boom: suona l'effetto (pool) e avvisa la proiezione di disegnare l'esplosione.
      suonaFuoco();
      void emit(EVT.vittoriaBoom, {
        id: boomId.current++,
        x: 0.1 + Math.random() * 0.8,
        colori,
      }).catch(() => undefined);
      // Intervallo irregolare per un ritmo naturale dei fuochi. Ridotto del
      // ~20% rispetto al ritmo base → circa il 20% di scoppi in più (possono
      // sovrapporsi).
      timeoutRef.current = window.setTimeout(scoppia, 583 + Math.random() * 417);
    }
    // Primo scoppio dopo un attimo (lascia entrare i vincitori).
    timeoutRef.current = window.setTimeout(scoppia, 600);

    return () => {
      vivo = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      fermaAudio(musica);
      fermaAudio(applauso);
      for (const f of fuochiPool) fermaAudio(f);
      riprendiDaVittoria();
    };
    // trigger nel deps: un nuovo "Proclama vincitori" riavvia musica e fuochi.
  }, [attiva, trigger]);

  return null;
}
