import { useState } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { risolviAsset } from "../../lib/storage";
import { PALETTE, nomeColore } from "../../lib/colori";
import { validaNomePersonaggio, type Personaggio } from "../../lib/ambientazione";
import Cerchietto from "../../components/Cerchietto";
import EditorRitaglioPersonaggio from "./EditorRitaglioPersonaggio";
import styles from "./PannelloPersonaggi.module.css";

interface Props {
  onNuovoPersonaggio: () => void;
}

export default function PannelloPersonaggi({ onNuovoPersonaggio }: Props) {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const selezionatoId = useAmbientazioneStore((s) => s.selezionatoId);
  const seleziona = useAmbientazioneStore((s) => s.selezionaPersonaggio);
  const rinomina = useAmbientazioneStore((s) => s.rinominaPersonaggio);
  const cambiaColore = useAmbientazioneStore((s) => s.cambiaColorePersonaggio);
  const modificaCrop = useAmbientazioneStore((s) => s.modificaCropPersonaggio);
  const elimina = useAmbientazioneStore((s) => s.eliminaPersonaggio);

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

  return (
    <aside className={styles.root}>
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
          {current.personaggi.map((p) => (
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
                  <span className={styles.voceColore}>{nomeColore(p.colore)}</span>
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
                  <button className={styles.menuElimina} onClick={() => handleElimina(p.id, p.nome)}>
                    Elimina personaggio
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditorRitaglioPersonaggio
          personaggio={editing}
          folderPath={folderPath}
          onAnnulla={() => setEditing(null)}
          onConferma={(crop) => {
            modificaCrop(editing.id, crop);
            setEditing(null);
          }}
        />
      )}
    </aside>
  );
}
