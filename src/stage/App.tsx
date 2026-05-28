import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen, EVT, type ScenaPayload } from "../lib/events";
import { autorizzaCartella } from "../lib/storage";
import Scena from "../components/Scena";

const STATO_INIZIALE: ScenaPayload = {
  folderPath: null,
  mappaPath: null,
  personaggi: [],
  oggetti: [],
  nome: null,
};

export default function App() {
  const [stato, setStato] = useState<ScenaPayload>(STATO_INIZIALE);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        void getCurrentWebviewWindow().setFullscreen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const unlistenP = listen(EVT.scenaUpdate, async (payload) => {
      if (payload.folderPath) {
        try {
          await autorizzaCartella(payload.folderPath);
        } catch {
          // se l'autorizzazione fallisce le immagini non si vedranno,
          // ma è meglio del crash silenzioso
        }
      }
      setStato(payload);
    });
    return () => {
      unlistenP.then((u) => u());
    };
  }, []);

  return (
    <Scena
      folderPath={stato.folderPath}
      mappaPath={stato.mappaPath}
      personaggi={stato.personaggi}
      oggetti={stato.oggetti}
      nome={stato.nome}
    />
  );
}
