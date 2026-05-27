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
          const status = useAmbientazioneStore.getState().saveStatus;
          if (status === "dirty") {
            void trigger();
          }
        }
      }
    };

    const unsub = useAmbientazioneStore.subscribe((state, prev) => {
      if (state.saveStatus === "dirty" && prev.saveStatus !== "dirty") {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          void trigger();
        }, DEBOUNCE_MS);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
