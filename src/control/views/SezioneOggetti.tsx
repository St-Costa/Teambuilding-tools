import { useState } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { risolviAsset } from "../../lib/storage";
import { validaNomeOggetto, type Oggetto } from "../../lib/ambientazione";
import Quadratino from "../../components/Quadratino";
import EditorRitaglio from "./EditorRitaglio";
import styles from "./PannelloPersonaggi.module.css";

interface Props {
  onNuovoOggetto: () => void;
}

export default function SezioneOggetti({ onNuovoOggetto }: Props) {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const rinomina = useAmbientazioneStore((s) => s.rinominaOggetto);
  const modificaCrop = useAmbientazioneStore((s) => s.modificaCropOggetto);
  const elimina = useAmbientazioneStore((s) => s.eliminaOggetto);
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const inEdit = modalita === "edit";

  const [menuApertoPer, setMenuApertoPer] = useState<string | null>(null);
  const [editing, setEditing] = useState<Oggetto | null>(null);

  if (!current || !folderPath) return null;

  function assegnatarioDi(oggettoId: string) {
    return current?.personaggi.find((p) => p.oggettoId === oggettoId) ?? null;
  }

  function handleRinomina(id: string, nomeAttuale: string) {
    setMenuApertoPer(null);
    const nuovo = prompt("Nuovo nome:", nomeAttuale);
    if (nuovo === null) return;
    if (!current) return;
    const err = validaNomeOggetto(nuovo, current.oggetti, id);
    if (err) {
      alert(err);
      return;
    }
    rinomina(id, nuovo);
  }

  function handleElimina(id: string, nome: string) {
    setMenuApertoPer(null);
    const assegnatario = assegnatarioDi(id);
    const messaggio = assegnatario
      ? `Eliminare l'oggetto "${nome}"? Attualmente è assegnato a ${assegnatario.nome} e verrà rimosso. L'operazione non si può annullare.`
      : `Eliminare l'oggetto "${nome}"? L'operazione non si può annullare.`;
    if (confirm(messaggio)) elimina(id);
  }

  return (
    <section className={styles.sezione}>
      <header className={styles.header}>
        <h2>Oggetti</h2>
        {inEdit && (
          <button className={styles.btnNuovo} onClick={onNuovoOggetto}>
            + Nuovo
          </button>
        )}
      </header>

      {current.oggetti.length === 0 ? (
        <p className={styles.vuoto}>Nessun oggetto. Premi "+ Nuovo" per aggiungerne uno.</p>
      ) : (
        <ul className={styles.lista}>
          {current.oggetti.map((o) => {
            const assegnatario = assegnatarioDi(o.id);
            return (
              <li key={o.id} className={styles.voce}>
                <div className={styles.voceMain} style={{ cursor: "default" }}>
                  <Quadratino
                    src={risolviAsset(folderPath, o.imgPath)}
                    crop={o.crop}
                    dimensione={36}
                    alt={o.nome}
                  />
                  <div className={styles.voceTesto}>
                    <span className={styles.voceNome}>{o.nome}</span>
                    <span className={styles.voceColore}>
                      {assegnatario ? `Di ${assegnatario.nome}` : "Disponibile"}
                    </span>
                  </div>
                </div>
                {inEdit && (
                  <button
                    className={styles.voceMenu}
                    onClick={() => setMenuApertoPer(menuApertoPer === o.id ? null : o.id)}
                    aria-label="Altre azioni"
                    title="Altre azioni"
                  >
                    ⋯
                  </button>
                )}
                {inEdit && menuApertoPer === o.id && (
                  <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleRinomina(o.id, o.nome)}>Rinomina…</button>
                    <button
                      onClick={() => {
                        setMenuApertoPer(null);
                        setEditing(o);
                      }}
                    >
                      Modifica ritaglio…
                    </button>
                    <button
                      className={styles.menuElimina}
                      onClick={() => handleElimina(o.id, o.nome)}
                    >
                      Elimina oggetto
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <EditorRitaglio
          nome={editing.nome}
          imgPath={editing.imgPath}
          cropIniziale={editing.crop}
          folderPath={folderPath}
          onAnnulla={() => setEditing(null)}
          onConferma={(crop) => {
            modificaCrop(editing.id, crop);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
