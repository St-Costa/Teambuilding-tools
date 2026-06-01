import { useRef } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { EMOJI_ANNOTAZIONI } from "../../lib/scena";
import { IconaImmagine, IconaTesto } from "../../components/Icone";
import styles from "./PannelloAnnotazioni.module.css";

export default function PannelloAnnotazioni() {
  const aggiungi = useAmbientazioneStore((s) => s.aggiungiAnnotazione);
  const setInModifica = useAmbientazioneStore((s) => s.setAnnotazioneInModifica);

  const dettagliRef = useRef<HTMLDetailsElement | null>(null);

  function aggiungiSimbolo(emoji: string) {
    aggiungi({ tipo: "simbolo", contenuto: emoji });
    dettagliRef.current?.removeAttribute("open");
  }

  function aggiungiTesto() {
    const id = aggiungi({ tipo: "testo", contenuto: "Testo" });
    // Entra subito in modifica inline: l'utente scrive direttamente sulla mappa.
    setInModifica(id);
  }

  return (
    <div className={styles.root}>
      <details className={styles.menuRoot} ref={dettagliRef}>
        <summary
          className={styles.btnIcona}
          title="Aggiungi un simbolo sulla mappa"
          aria-label="Aggiungi simbolo"
        >
          <IconaImmagine dimensione={28} />
        </summary>
        <div className={styles.menu}>
          {EMOJI_ANNOTAZIONI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={styles.emojiBtn}
              onClick={() => aggiungiSimbolo(emoji)}
              title={`Aggiungi ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </details>

      <button
        className={styles.btnIcona}
        onClick={aggiungiTesto}
        title="Aggiungi un testo sulla mappa"
        aria-label="Aggiungi testo"
      >
        <IconaTesto dimensione={28} />
      </button>
    </div>
  );
}
