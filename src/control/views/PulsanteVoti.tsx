import { open } from "@tauri-apps/plugin-dialog";
import { eseguiSalvataggio, useAmbientazioneStore } from "../../state/ambientazioneStore";
import { useVotiStore } from "../../state/votiStore";
import { IconaVoto } from "../../components/Icone";
import styles from "./PulsanteVoti.module.css";

interface Props {
  numeroBadge?: number;
}

export default function PulsanteVoti({ numeroBadge }: Props) {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const impostaSfondoVoti = useAmbientazioneStore((s) => s.impostaSfondoVoti);

  const fase = useVotiStore((s) => s.fase);
  const apri = useVotiStore((s) => s.apri);
  const chiudi = useVotiStore((s) => s.chiudi);

  const inEdit = modalita === "edit";
  const sfondoPath = current?.sfondoVotiPath ?? null;
  const haSfondo = sfondoPath !== null;
  const aperta = fase === "aperta";

  if (!current || !folderPath) return null;

  // Modalità modifica: il pulsante imposta lo sfondo della schermata voti.
  if (inEdit) {
    async function caricaSfondo() {
      try {
        const scelto = await open({
          multiple: false,
          filters: [{ name: "Immagini", extensions: ["png", "jpg", "jpeg", "webp"] }],
        });
        if (typeof scelto !== "string") return;
        await impostaSfondoVoti(scelto);
        await eseguiSalvataggio();
      } catch {
        // annullato o errore
      }
    }

    return (
      <button
        type="button"
        className={`${styles.btnIcona} ${haSfondo ? styles.configurato : styles.daConfigurare}`}
        onClick={() => void caricaSfondo()}
        title={
          haSfondo
            ? `Sfondo voti: ${sfondoPath?.split(/[/\\]/).pop()} — clicca per cambiare`
            : "Carica sfondo per la schermata dei voti"
        }
        aria-label="Sfondo schermata voti"
      >
        <IconaVoto dimensione={30} />
        {numeroBadge !== undefined && (
          <span className={styles.numeroBadge}>{numeroBadge}</span>
        )}
      </button>
    );
  }

  // Modalità play: il pulsante mostra/nasconde la schermata voti sulla proiezione
  // e apre/chiude il pannello di controllo voti in regia.
  return (
    <button
      type="button"
      className={`${styles.btnIcona} ${aperta ? styles.attivo : ""}`}
      onClick={() => (aperta ? chiudi() : apri())}
      disabled={current.personaggi.every((p) => p.npc)}
      title={
        current.personaggi.every((p) => p.npc)
          ? "Serve almeno 1 personaggio non-NPC"
          : aperta
            ? "Nascondi la schermata dei voti"
            : "Mostra la schermata dei voti"
      }
      aria-label="Schermata voti"
    >
      <IconaVoto dimensione={30} />
      {numeroBadge !== undefined && (
        <span className={styles.numeroBadge}>{numeroBadge}</span>
      )}
    </button>
  );
}
