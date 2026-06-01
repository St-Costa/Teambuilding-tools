import { useEffect } from "react";
import { eseguiSalvataggio, useAmbientazioneStore } from "./ambientazioneStore";

const DEBOUNCE_MS = 500;

export function useAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let staleAfterSave = false;

    const trigger = async () => {
      if (inFlight) {
        staleAfterSave = true;
        return;
      }
      inFlight = true;
      try {
        await eseguiSalvataggio();
      } finally {
        inFlight = false;
        if (staleAfterSave) {
          staleAfterSave = false;
          if (useAmbientazioneStore.getState().saveStatus === "dirty") {
            void trigger();
          }
        }
      }
    };

    // (Ri)programma un salvataggio debounced. Chiamato a OGNI stato "dirty",
    // non solo sul fronte saved→dirty: così non può restare bloccato in
    // "dirty" se un edge va perso (es. rimontaggio in HMR, set ravvicinati).
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (useAmbientazioneStore.getState().saveStatus === "dirty") {
          void trigger();
        }
      }, DEBOUNCE_MS);
    };

    // Se all'attivazione c'è già roba non salvata, programma subito.
    if (useAmbientazioneStore.getState().saveStatus === "dirty") schedule();

    const unsub = useAmbientazioneStore.subscribe((state) => {
      if (state.saveStatus === "dirty") schedule();
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
