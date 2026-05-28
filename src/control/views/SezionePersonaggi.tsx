import { useState } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { risolviAsset } from "../../lib/storage";
import { PALETTE, nomeColore } from "../../lib/colori";
import {
  validaNomePersonaggio,
  type Personaggio,
} from "../../lib/ambientazione";
import Cerchietto from "../../components/Cerchietto";
import Quadratino from "../../components/Quadratino";
import EditorRitaglio from "./EditorRitaglio";
import styles from "./PannelloPersonaggi.module.css";

interface Props {
  onNuovoPersonaggio: () => void;
}

export default function SezionePersonaggi({ onNuovoPersonaggio }: Props) {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const selezionatoId = useAmbientazioneStore((s) => s.selezionatoId);
  const seleziona = useAmbientazioneStore((s) => s.selezionaPersonaggio);
  const rinomina = useAmbientazioneStore((s) => s.rinominaPersonaggio);
  const cambiaColore = useAmbientazioneStore((s) => s.cambiaColorePersonaggio);
  const modificaCrop = useAmbientazioneStore((s) => s.modificaCropPersonaggio);
  const elimina = useAmbientazioneStore((s) => s.eliminaPersonaggio);
  const assegnaOggetto = useAmbientazioneStore((s) => s.assegnaOggettoAPersonaggio);

  const [menuApertoPer, setMenuApertoPer] = useState<string | null>(null);
  const [editing, setEditing] = useState<Personaggio | null>(null);

  if (!current || !folderPath) return null;

  const coloriUsati = new Set(current.personaggi.map((p) => p.colore.toUpperCase()));

  function handleRinomina(id: string, nomeAttuale: string) {
    setMenuApertoPer(null);
    const nuovo = prompt("Nuovo nome:", nomeAttuale);
    if (nuovo === null) return;
    if (!current) return;
    const err = validaNomePersonaggio(nuovo, current.personaggi, id);
    if (err) {
      alert(err);
      return;
    }
    rinomina(id, nuovo);
  }

  function handleElimina(id: string, nome: string) {
    setMenuApertoPer(null);
    const ok = confirm(`Eliminare il personaggio "${nome}"? Questa operazione non si può annullare.`);
    if (ok) elimina(id);
  }

  function handleCambiaColore(id: string, nuovo: string) {
    setMenuApertoPer(null);
    cambiaColore(id, nuovo);
  }

  function handleAssegnaOggetto(personaggioId: string, oggettoId: string | null) {
    setMenuApertoPer(null);
    assegnaOggetto(personaggioId, oggettoId);
  }

  return (
    <section className={styles.sezione}>
      <header className={styles.header}>
        <h2>Personaggi</h2>
        <button className={styles.btnNuovo} onClick={onNuovoPersonaggio}>
          + Nuovo
        </button>
      </header>

      {current.personaggi.length === 0 ? (
        <p className={styles.vuoto}>Nessun personaggio. Premi "+ Nuovo" per aggiungerne uno.</p>
      ) : (
        <ul className={styles.lista}>
          {current.personaggi.map((p) => {
            const oggettoAssegnato = p.oggettoId
              ? current.oggetti.find((o) => o.id === p.oggettoId) ?? null
              : null;
            return (
              <li
                key={p.id}
                className={`${styles.voce} ${selezionatoId === p.id ? styles.voceSelezionata : ""}`}
              >
                <button
                  className={styles.voceMain}
                  onClick={() => seleziona(selezionatoId === p.id ? null : p.id)}
                >
                  <Cerchietto
                    src={risolviAsset(folderPath, p.imgPath)}
                    colore={p.colore}
                    crop={p.crop}
                    dimensione={36}
                    alt={p.nome}
                  />
                  <div className={styles.voceTesto}>
                    <span className={styles.voceNome}>{p.nome}</span>
                    <span className={styles.voceColore}>
                      {nomeColore(p.colore)}
                      {oggettoAssegnato && ` · ${oggettoAssegnato.nome}`}
                    </span>
                  </div>
                </button>
                <button
                  className={styles.voceMenu}
                  onClick={() => setMenuApertoPer(menuApertoPer === p.id ? null : p.id)}
                  aria-label="Altre azioni"
                  title="Altre azioni"
                >
                  ⋯
                </button>
                {menuApertoPer === p.id && (
                  <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleRinomina(p.id, p.nome)}>Rinomina…</button>
                    <button onClick={() => { setMenuApertoPer(null); setEditing(p); }}>
                      Modifica ritaglio…
                    </button>
                    <div className={styles.menuLabel}>Cambia colore</div>
                    <div className={styles.menuPalette}>
                      {PALETTE.map((c) => {
                        const usato = coloriUsati.has(c.hex.toUpperCase()) && c.hex !== p.colore;
                        return (
                          <button
                            key={c.hex}
                            className={`${styles.menuColore} ${c.hex === p.colore ? styles.menuColoreScelto : ""}`}
                            style={{ background: c.hex }}
                            onClick={() => !usato && handleCambiaColore(p.id, c.hex)}
                            disabled={usato}
                            title={usato ? `${c.nome} (già usato)` : c.nome}
                          />
                        );
                      })}
                    </div>
                    <div className={styles.menuLabel}>Oggetto</div>
                    {current.oggetti.length === 0 ? (
                      <p className={styles.menuVuoto}>
                        Nessun oggetto. Creane uno nella sezione "Oggetti".
                      </p>
                    ) : (
                      <div className={styles.menuListaOggetti}>
                        {current.oggetti.map((o) => {
                          const assegnatoA = current.personaggi.find(
                            (x) => x.id !== p.id && x.oggettoId === o.id,
                          );
                          const scelto = o.id === p.oggettoId;
                          return (
                            <button
                              key={o.id}
                              className={`${styles.menuOggetto} ${scelto ? styles.menuOggettoScelto : ""}`}
                              onClick={() => handleAssegnaOggetto(p.id, o.id)}
                              title={assegnatoA ? `Attualmente di ${assegnatoA.nome}` : o.nome}
                            >
                              <Quadratino
                                src={risolviAsset(folderPath, o.imgPath)}
                                crop={o.crop}
                                dimensione={28}
                                alt={o.nome}
                              />
                              <span className={styles.menuOggettoTesto}>
                                <span className={styles.menuOggettoNome}>{o.nome}</span>
                                {assegnatoA && (
                                  <span className={styles.menuOggettoAssegnato}>
                                    (di {assegnatoA.nome})
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                        {p.oggettoId && (
                          <button
                            className={styles.menuStacca}
                            onClick={() => handleAssegnaOggetto(p.id, null)}
                          >
                            Nessuno (rimuovi oggetto)
                          </button>
                        )}
                      </div>
                    )}
                    <button className={styles.menuElimina} onClick={() => handleElimina(p.id, p.nome)}>
                      Elimina personaggio
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
          colore={editing.colore}
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
