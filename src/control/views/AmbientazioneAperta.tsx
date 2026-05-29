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
import PannelloGioco from "./PannelloGioco";
import PannelloSoundboard from "./PannelloSoundboard";
import PulsanteSottofondo from "./PulsanteSottofondo";
import { IconaCasa, IconaMonitor, IconaTrofeo, IconaVS } from "../../components/Icone";
import { useConflittoStore } from "../../state/conflittoStore";
import { useLeaderboardStore } from "../../state/leaderboardStore";
import "../../state/timerStore";
import styles from "./AmbientazioneAperta.module.css";

export default function AmbientazioneAperta() {
  const current = useAmbientazioneStore((s) => s.current);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const inEdit = modalita === "edit";
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
  const [confermaChiusuraAperta, setConfermaChiusuraAperta] = useState(false);
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
    setConfermaChiusuraAperta(true);
  }

  function confermaChiusura() {
    setConfermaChiusuraAperta(false);
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
          <PulsanteSottofondo />
        </div>
        <PannelloSoundboard />
        <div className={styles.toolbarDestra}>
          {inEdit && (
            <button className={styles.btnAzione} onClick={handleImpostaMappa}>
              {current.mappaPath ? "Cambia mappa…" : "Imposta mappa…"}
            </button>
          )}
          <button
            className={styles.btnIcona}
            onClick={() => void toggleStageFullscreen()}
            title={stageFullscreen ? "Esci da tutto schermo" : "Proiezione a tutto schermo"}
            aria-label={stageFullscreen ? "Esci da tutto schermo" : "Proiezione a tutto schermo"}
          >
            <IconaMonitor dimensione={30} />
          </button>
          <button
            className={styles.btnIcona}
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
                  : "Apri la ruota della fortuna (Conflitto)"
            }
            aria-label="Conflitto"
          >
            <IconaVS dimensione={34} />
          </button>
          <button
            className={styles.btnIcona}
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
            aria-label="Leaderboard"
          >
            <IconaTrofeo dimensione={30} />
          </button>
          {inEdit && (
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
          )}
          <PannelloTimer />
          {inEdit && <IndicatoreSalvataggio />}
          <button
            className={styles.btnIcona}
            onClick={handleChiudi}
            title="Torna alla schermata iniziale"
            aria-label="Chiudi ambientazione"
          >
            <IconaCasa dimensione={30} />
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
        {inEdit ? (
          <PannelloPersonaggi
            onNuovoPersonaggio={() => setWizardPersonaggioAperto(true)}
            onNuovoOggetto={() => setWizardOggettoAperto(true)}
          />
        ) : (
          <PannelloGioco />
        )}
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

      {confermaChiusuraAperta && (
        <div className={styles.confermaBackdrop}>
          <div className={styles.confermaModale}>
            <h2>Tornare alla schermata iniziale?</h2>
            <p>
              Lo stato corrente dello scenario (posizioni dei personaggi, timer,
              leaderboard, oggetti assegnati) <strong>non viene salvato</strong>:
              alla riapertura lo scenario ripartirà dalle posizioni iniziali.
            </p>
            <div className={styles.confermaBottoni}>
              <button
                type="button"
                className={styles.confermaSecondario}
                onClick={() => setConfermaChiusuraAperta(false)}
                autoFocus
              >
                Annulla
              </button>
              <button
                type="button"
                className={styles.confermaPrimario}
                onClick={confermaChiusura}
              >
                Sì, esci
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
