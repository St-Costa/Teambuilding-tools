import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import IndicatoreSalvataggio from "../components/IndicatoreSalvataggio";
import PannelloPersonaggi from "./PannelloPersonaggi";
import AreaMappa from "./AreaMappa";
import WizardPersonaggio from "./WizardPersonaggio";
import WizardOggetto from "./WizardOggetto";
import styles from "./AmbientazioneAperta.module.css";

export default function AmbientazioneAperta() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const saveStatus = useAmbientazioneStore((s) => s.saveStatus);
  const impostaMappa = useAmbientazioneStore((s) => s.impostaMappa);
  const aggiungiPersonaggio = useAmbientazioneStore((s) => s.aggiungiPersonaggio);
  const aggiungiOggetto = useAmbientazioneStore((s) => s.aggiungiOggetto);
  const chiudi = useAmbientazioneStore((s) => s.chiudi);

  const [wizardPersonaggioAperto, setWizardPersonaggioAperto] = useState(false);
  const [wizardOggettoAperto, setWizardOggettoAperto] = useState(false);
  const [erroreMappa, setErroreMappa] = useState<string | null>(null);
  const [stageFullscreen, setStageFullscreen] = useState(false);

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
    </div>
  );
}
