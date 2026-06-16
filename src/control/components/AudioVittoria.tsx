import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, EVT } from "../../lib/events";
import { useSottofondoStore } from "../../lib/sottofondo";
import { useVittoriaStore } from "../../state/vittoriaStore";

// Componente senza UI (montato nella REGIA). Quando l'animazione di vittoria è
// attiva: mette in pausa il sottofondo, suona la musica di vittoria e fa da
// "metronomo" dei fuochi → a ogni scoppio chiama play_fuoco nel backend Rust E
// avvisa la proiezione (evento vittoria:boom) così suono e visivo coincidono.
//
// Tutti i suoni girano nel backend (rodio), senza HTMLAudioElement: elimina
// ogni interazione con WebKitGTK/GStreamer.

export default function AudioVittoria() {
  const attiva = useVittoriaStore((s) => s.attiva);
  const trigger = useVittoriaStore((s) => s.trigger);

  const timeoutRef = useRef<number | null>(null);
  const boomId = useRef(0);

  useEffect(() => {
    if (!attiva) return;

    const { pausaPerVittoria, riprendiDaVittoria } = useSottofondoStore.getState();
    pausaPerVittoria();

    void invoke("play_vittoria_suono").catch(() => undefined);
    void invoke("play_applauso").catch(() => undefined);

    const coloriVincitori = useVittoriaStore.getState().vincitori.map((v) => v.colore);
    const colori = [...coloriVincitori, "#ffd700", "#ffffff"];

    let vivo = true;
    function scoppia() {
      if (!vivo) return;
      void invoke("play_fuoco").catch(() => undefined);
      void emit(EVT.vittoriaBoom, {
        id: boomId.current++,
        x: 0.1 + Math.random() * 0.8,
        colori,
      }).catch(() => undefined);
      timeoutRef.current = window.setTimeout(scoppia, 583 + Math.random() * 417);
    }
    timeoutRef.current = window.setTimeout(scoppia, 600);

    return () => {
      vivo = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      void invoke("stop_vittoria_suoni").catch(() => undefined);
      riprendiDaVittoria();
    };
  }, [attiva, trigger]);

  return null;
}
