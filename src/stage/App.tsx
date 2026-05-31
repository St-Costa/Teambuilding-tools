import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen, EVT, type ScenaPayload } from "../lib/events";
import { autorizzaCartella } from "../lib/storage";
import Scena from "../components/Scena";
import Ruota from "../components/Ruota";
import ScoreboardConflitto from "../components/ScoreboardConflitto";
import DisplayTimer from "../components/DisplayTimer";
import ScenaLeaderboard from "../components/ScenaLeaderboard";

const STATO_INIZIALE: ScenaPayload = {
  folderPath: null,
  mappaPath: null,
  personaggi: [],
  oggetti: [],
  nome: null,
  conflitto: null,
  timer: {
    stato: "idle",
    durationSec: 300,
    targetEndAt: null,
    pausedRemainingMs: 0,
  },
  leaderboard: null,
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

  // Cartella già autorizzata: la regia ora ri-emette lo stato 1 volta/sec
  // mentre il timer scorre, quindi autorizziamo SOLO quando cambia il path
  // (un invoke Tauri al secondo sarebbe inutile e potenzialmente costoso).
  const cartellaAutorizzata = useRef<string | null>(null);
  useEffect(() => {
    const unlistenP = listen(EVT.scenaUpdate, async (payload) => {
      if (payload.folderPath && payload.folderPath !== cartellaAutorizzata.current) {
        try {
          await autorizzaCartella(payload.folderPath);
          cartellaAutorizzata.current = payload.folderPath;
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

  // Scena sempre montata: Ruota / Leaderboard la coprono in overlay.
  // Così Scena non subisce unmount/remount → personaggi sulla mappa restano
  // renderizzati quando l'overlay si chiude (no reset di imgDim/container).
  const mostraRuota = stato.conflitto !== null && stato.folderPath !== null;
  const mostraLeaderboard = stato.leaderboard !== null && stato.folderPath !== null;
  const overlayAttivo = mostraRuota || mostraLeaderboard;
  return (
    <>
      <Scena
        folderPath={stato.folderPath}
        mappaPath={stato.mappaPath}
        personaggi={stato.personaggi}
        oggetti={stato.oggetti}
        nome={stato.nome}
      />
      {!overlayAttivo && <DisplayTimer snapshot={stato.timer} />}
      {mostraLeaderboard && stato.folderPath && stato.leaderboard && (
        <ScenaLeaderboard snapshot={stato.leaderboard} folderPath={stato.folderPath} />
      )}
      {mostraRuota && stato.folderPath && stato.conflitto && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            zIndex: 1000,
            padding: "2rem",
            boxSizing: "border-box",
          }}
        >
          <ScoreboardConflitto
            snapshot={stato.conflitto}
            folderPath={stato.folderPath}
          />
          <Ruota
            snapshot={stato.conflitto}
            folderPath={stato.folderPath}
            dimensione={Math.min(window.innerWidth * 0.72, window.innerHeight * 0.7)}
            animata={true}
          />
        </div>
      )}
    </>
  );
}
