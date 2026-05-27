import { useEffect } from "react";
import { useAmbientazioneStore } from "../state/ambientazioneStore";
import { useAutosave } from "../state/useAutosave";
import { listaRecenti } from "../lib/recents";
import { autorizzaCartella } from "../lib/storage";
import SelezioneAmbientazione from "./views/SelezioneAmbientazione";
import AmbientazioneAperta from "./views/AmbientazioneAperta";

export default function App() {
  const current = useAmbientazioneStore((s) => s.current);
  useAutosave();

  useEffect(() => {
    void (async () => {
      try {
        const recenti = await listaRecenti();
        for (const r of recenti) {
          if (r.esiste) {
            await autorizzaCartella(r.path).catch(() => undefined);
          }
        }
      } catch {
        // se il restauro scope fallisce non blocchiamo: gli errori
        // verranno mostrati al primo tentativo di apertura
      }
    })();
  }, []);

  return current === null ? <SelezioneAmbientazione /> : <AmbientazioneAperta />;
}
