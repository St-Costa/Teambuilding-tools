import { open } from "@tauri-apps/plugin-dialog";
import { eseguiSalvataggio, useAmbientazioneStore } from "../../state/ambientazioneStore";
import { IconaOrologio } from "../../components/Icone";
import styles from "./PulsanteCountdownFullscreen.module.css";

interface Props {
  /**
   * "config" → visibile in modalità modifica (bordino END), nascosto in play.
   * "toggle" → visibile in modalità play (bordino END), nascosto in edit.
   */
  variante: "config" | "toggle";
  numeroBadge?: number;
}

export default function PulsanteCountdownFullscreen({ variante, numeroBadge }: Props) {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const impostaSfondoCountdown = useAmbientazioneStore((s) => s.impostaSfondoCountdown);
  const countdownFullscreenVisibile = useAmbientazioneStore((s) => s.countdownFullscreenVisibile);
  const setCountdownFullscreenVisibile = useAmbientazioneStore(
    (s) => s.setCountdownFullscreenVisibile,
  );

  const inEdit = modalita === "edit";
  const sfondoPath = current?.sfondoCountdownPath ?? null;
  const haSfondo = sfondoPath !== null;

  if (!current || !folderPath) return null;
  if (inEdit && variante === "toggle") return null;
  if (!inEdit && variante === "config") return null;

  async function caricaSfondo() {
    try {
      const scelto = await open({
        multiple: false,
        filters: [{ name: "Immagini", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (typeof scelto !== "string") return;
      await impostaSfondoCountdown(scelto);
      await eseguiSalvataggio();
    } catch {
      // l'utente ha annullato o c'è stato un problema
    }
  }

  // Modalità modifica: stesso bottone icona della play, colori diversi (verde=configurato, tratteggiato=no)
  if (inEdit) {
    return (
      <button
        type="button"
        className={`${styles.btnIcona} ${haSfondo ? styles.configurato : styles.daConfigurare}`}
        onClick={() => void caricaSfondo()}
        title={
          haSfondo
            ? `Sfondo countdown: ${sfondoPath?.split(/[/\\]/).pop()} — clicca per cambiare`
            : "Carica sfondo per il countdown a schermo intero"
        }
        aria-label="Sfondo countdown"
      >
        <IconaOrologio dimensione={30} />
        {numeroBadge !== undefined && <span className={styles.numeroBadge}>{numeroBadge}</span>}
      </button>
    );
  }

  // Modalità play: bottone icona compatto (bordino END)
  return (
    <button
      type="button"
      className={`${styles.btnIcona} ${countdownFullscreenVisibile ? styles.attivo : ""}`}
      onClick={() => setCountdownFullscreenVisibile(!countdownFullscreenVisibile)}
      title={
        countdownFullscreenVisibile ? "Nascondi countdown" : "Mostra countdown a schermo intero"
      }
      aria-label="Countdown a schermo intero"
    >
      <IconaOrologio dimensione={30} />
      {numeroBadge !== undefined && <span className={styles.numeroBadge}>{numeroBadge}</span>}
    </button>
  );
}
