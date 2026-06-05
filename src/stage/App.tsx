import { useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen, EVT, type ScenaPayload } from "../lib/events";
import { autorizzaCartella } from "../lib/storage";
import Scena from "../components/Scena";
import Ruota from "../components/Ruota";
import DisplayTimer from "../components/DisplayTimer";
import ScenaLeaderboard from "../components/ScenaLeaderboard";
import AnimazioneVittoria from "../components/AnimazioneVittoria";
import Presentazione from "../components/Presentazione";

const STATO_INIZIALE: ScenaPayload = {
  folderPath: null,
  mappaPath: null,
  personaggi: [],
  oggetti: [],
  annotazioni: [],
  nome: null,
  conflitto: null,
  timer: {
    stato: "idle",
    durationSec: 300,
    targetEndAt: null,
    pausedRemainingMs: 0,
  },
  leaderboard: null,
  vittoria: null,
  presentazionePath: null,
  presentazione: null,
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
  const mostraPresentazione =
    stato.presentazione !== null && stato.presentazionePath !== null && stato.folderPath !== null;
  const overlayAttivo = mostraRuota || mostraLeaderboard || mostraPresentazione;
  return (
    <>
      <Scena
        folderPath={stato.folderPath}
        mappaPath={stato.mappaPath}
        personaggi={stato.personaggi}
        oggetti={stato.oggetti}
        annotazioni={stato.annotazioni}
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
          <Ruota
            snapshot={stato.conflitto}
            folderPath={stato.folderPath}
            dimensione={Math.min(window.innerWidth * 0.72, window.innerHeight * 0.7)}
            animata={true}
          />
        </div>
      )}
      {mostraPresentazione &&
        stato.folderPath &&
        stato.presentazionePath &&
        stato.presentazione && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              zIndex: 1000,
              padding: "1.5rem",
              boxSizing: "border-box",
            }}
          >
            <Presentazione
              folderPath={stato.folderPath}
              presentazionePath={stato.presentazionePath}
              pagina={stato.presentazione.paginaCorrente}
            />
          </div>
        )}
      {stato.vittoria !== null && stato.folderPath && (
        // key={trigger}: ogni "Proclama vincitori" rimonta il componente così
        // le animazioni CSS (cerchi che salgono, corone che scendono) ripartono.
        <AnimazioneVittoria
          key={stato.vittoria.trigger}
          snapshot={stato.vittoria}
          folderPath={stato.folderPath}
        />
      )}
    </>
  );
}
