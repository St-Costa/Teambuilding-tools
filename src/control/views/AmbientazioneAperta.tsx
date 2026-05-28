import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import IndicatoreSalvataggio from "../components/IndicatoreSalvataggio";
import PannelloPersonaggi from "./PannelloPersonaggi";
import AreaMappa from "./AreaMappa";
import WizardPersonaggio from "./WizardPersonaggio";
import WizardOggetto from "./WizardOggetto";
import PannelloConflitto from "./PannelloConflitto";
import PannelloTimer from "./PannelloTimer";
import PannelloLeaderboard from "./PannelloLeaderboard";
import { useConflittoStore } from "../../state/conflittoStore";
import { useLeaderboardStore } from "../../state/leaderboardStore";
import "../../state/timerStore";
import styles from "./AmbientazioneAperta.module.css";

export default function AmbientazioneAperta() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const saveStatus = useAmbientazioneStore((s) => s.saveStatus);
  const impostaMappa = useAmbientazioneStore((s) => s.impostaMappa);
  const aggiungiPersonaggio = useAmbientazioneStore((s) => s.aggiungiPersonaggio);
  const aggiungiOggetto = useAmbientazioneStore((s) => s.aggiungiOggetto);
  const salvaTutte = useAmbientazioneStore((s) => s.salvaTuttePosizioniIniziali);
  const ripristinaTutte = useAmbientazioneStore((s) => s.ripristinaTuttePosizioniIniziali);
  const chiudi = useAmbientazioneStore((s) => s.chiudi);

  const [wizardPersonaggioAperto, setWizardPersonaggioAperto] = useState(false);
  const [wizardOggettoAperto, setWizardOggettoAperto] = useState(false);
  const [erroreMappa, setErroreMappa] = useState<string | null>(null);
  const [stageFullscreen, setStageFullscreen] = useState(false);
  const [conflittoAperto, setConflittoAperto] = useState(false);
  const avviaConflitto = useConflittoStore((s) => s.avvia);
  const [leaderboardAperta, setLeaderboardAperta] = useState(false);
  const apriLeaderboard = useLeaderboardStore((s) => s.apri);
  const conflittoFase = useConflittoStore((s) => s.fase);
  const leaderboardFaseStore = useLeaderboardStore((s) => s.fase);
  const conflittoInCorso = conflittoFase !== "chiuso";
  const leaderboardInCorso = leaderboardFaseStore === "aperta";

  useEffect(() => {
    let cancellato = false;
    (async () => {
      const stage = await WebviewWindow.getByLabel("stage");
      if (!stage || cancellato) return;
      try {
        const ora = await stage.isFullscreen();
        if (!cancellato) setStageFullscreen(ora);
      } catch {
        // se non riusciamo a leggere lo stato, manteniamo false
      }
    })();
    return () => {
      cancellato = true;
    };
  }, []);

  async function toggleStageFullscreen() {
    const stage = await WebviewWindow.getByLabel("stage");
    if (!stage) return;
    const nuovo = !stageFullscreen;
    try {
      await stage.setFullscreen(nuovo);
      setStageFullscreen(nuovo);
    } catch (e) {
      alert(`Impossibile cambiare modalità della finestra di proiezione: ${e}`);
    }
  }

  if (!current) return null;

  function handleChiudi() {
    if (saveStatus !== "saved") {
      const ok = confirm("Ci sono modifiche non ancora salvate. Vuoi davvero chiudere?");
      if (!ok) return;
    }
    chiudi();
  }

  async function handleImpostaMappa() {
    setErroreMappa(null);
    try {
      const scelto = await open({
        multiple: false,
        filters: [
          { name: "Immagini", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] },
        ],
      });
      if (typeof scelto !== "string") return;
      await impostaMappa(scelto);
    } catch (e) {
      setErroreMappa(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className={styles.root}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarSinistra}>
          <h1 className={styles.nome}>{current.nome}</h1>
          <p className={styles.path} title={folderPath ?? ""}>{folderPath}</p>
        </div>
        <div className={styles.toolbarDestra}>
          <button className={styles.btnAzione} onClick={handleImpostaMappa}>
            {current.mappaPath ? "Cambia mappa…" : "Imposta mappa…"}
          </button>
          <button
            className={styles.btnAzione}
            onClick={() => void toggleStageFullscreen()}
            title="Mostra/nascondi la proiezione a tutto schermo"
          >
            {stageFullscreen ? "Esci da tutto schermo" : "Proiezione a tutto schermo"}
          </button>
          <button
            className={styles.btnAzione}
            onClick={() => {
              avviaConflitto();
              setConflittoAperto(true);
            }}
            disabled={current.personaggi.length < 2 || leaderboardInCorso}
            title={
              leaderboardInCorso
                ? "Chiudi prima la leaderboard"
                : current.personaggi.length < 2
                  ? "Servono almeno 2 personaggi"
                  : "Apri la ruota della fortuna"
            }
          >
            Conflitto
          </button>
          <button
            className={styles.btnAzione}
            onClick={() => {
              apriLeaderboard();
              setLeaderboardAperta(true);
            }}
            disabled={current.personaggi.length === 0 || conflittoInCorso}
            title={
              conflittoInCorso
                ? "Chiudi prima il conflitto"
                : current.personaggi.length === 0
                  ? "Serve almeno 1 personaggio"
                  : "Mostra la leaderboard finale"
            }
          >
            Leaderboard
          </button>
          <details className={styles.menuPosizioniRoot}>
            <summary className={styles.btnAzione} title="Salva o ripristina posizioni iniziali">
              Posizioni ▾
            </summary>
            <div className={styles.menuPosizioni}>
              <button
                onClick={(e) => {
                  if (!confirm("Salva la posizione corrente di tutti i personaggi come posizione iniziale?")) return;
                  salvaTutte();
                  (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                }}
                disabled={current.personaggi.length === 0}
              >
                Salva tutte come iniziali
              </button>
              <button
                onClick={(e) => {
                  ripristinaTutte();
                  (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                }}
                disabled={!current.personaggi.some((p) => p.posizioneIniziale !== null)}
              >
                Ripristina tutte alle iniziali
              </button>
            </div>
          </details>
          <PannelloTimer />
          <IndicatoreSalvataggio />
          <button className={styles.btnChiudi} onClick={handleChiudi}>
            Chiudi ambientazione
          </button>
        </div>
      </header>

      {erroreMappa && (
        <div className={styles.banner}>
          {erroreMappa}
          <button onClick={() => setErroreMappa(null)} aria-label="Chiudi">×</button>
        </div>
      )}

      <div className={styles.corpo}>
        <PannelloPersonaggi
          onNuovoPersonaggio={() => setWizardPersonaggioAperto(true)}
          onNuovoOggetto={() => setWizardOggettoAperto(true)}
        />
        <AreaMappa />
      </div>

      {wizardPersonaggioAperto && (
        <WizardPersonaggio
          personaggiEsistenti={current.personaggi}
          onAnnulla={() => setWizardPersonaggioAperto(false)}
          onConferma={async (input) => {
            await aggiungiPersonaggio(input);
            setWizardPersonaggioAperto(false);
          }}
        />
      )}

      {wizardOggettoAperto && (
        <WizardOggetto
          oggettiEsistenti={current.oggetti}
          onAnnulla={() => setWizardOggettoAperto(false)}
          onConferma={async (input) => {
            await aggiungiOggetto(input);
            setWizardOggettoAperto(false);
          }}
        />
      )}

      {conflittoAperto && (
        <PannelloConflitto onChiudi={() => setConflittoAperto(false)} />
      )}

      {leaderboardAperta && (
        <PannelloLeaderboard onChiudi={() => setLeaderboardAperta(false)} />
      )}
    </div>
  );
}
