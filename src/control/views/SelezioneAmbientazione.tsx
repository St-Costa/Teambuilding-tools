import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import {
  aggiungiRecente,
  listaRecenti,
  rimuoviRecente,
  type RecentEntryConStato,
} from "../../lib/recents";
import { validaNome } from "../../lib/ambientazione";
import { exists } from "@tauri-apps/plugin-fs";
import {
  apriAmbientazione,
  autorizzaCartella,
  eliminaAmbientazione,
  risolviAsset,
} from "../../lib/storage";
import styles from "./SelezioneAmbientazione.module.css";

interface InstallResult {
  nome: string;
  path: string;
  copiato: boolean;
}

export default function SelezioneAmbientazione() {
  const apri = useAmbientazioneStore((s) => s.apri);
  const creaNuova = useAmbientazioneStore((s) => s.creaNuova);

  const [recenti, setRecenti] = useState<RecentEntryConStato[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [creazioneAperta, setCreazioneAperta] = useState(false);
  const [factoryDisponibili, setFactoryDisponibili] = useState(false);
  const [ripristinoInCorso, setRipristinoInCorso] = useState(false);
  const [repoScenari, setRepoScenari] = useState<string | null>(null);
  // Per ogni cartella ambientazione, manteniamo il path della mappa (relativo)
  // per renderizzare la thumbnail nel tile.
  const [mappePerPath, setMappePerPath] = useState<Record<string, string | null>>({});

  useEffect(() => {
    void caricaRecenti();
    // Mostra il bottone "Ripristina scenari pre-installati" solo se nel bundle
    // ci sono effettivamente scenari factory.
    void (async () => {
      try {
        const lista = await invoke<string[]>("lista_scenari_factory_disponibili");
        if (lista.length > 0) setFactoryDisponibili(true);
      } catch {
        // se Tauri command non risponde, lasciamo il bottone nascosto
      }
    })();
    void (async () => {
      try {
        const repo = await invoke<string | null>("cartella_repo_scenari");
        if (repo) setRepoScenari(repo);
      } catch {
        // non in dev / comando non disponibile
      }
    })();
  }, []);

  async function caricaRecenti() {
    try {
      const lista = await listaRecenti();
      setRecenti(lista);
      // Carica le mappe per renderizzare le thumbnail.
      void caricaMappe(lista);
    } catch (e) {
      setErrore(`Impossibile caricare le ambientazioni: ${stringifyErr(e)}`);
    }
  }

  async function caricaMappe(lista: RecentEntryConStato[]) {
    for (const r of lista) {
      if (!r.esiste) continue;
      if (mappePerPath[r.path] !== undefined) continue;
      try {
        const a = await apriAmbientazione(r.path);
        setMappePerPath((m) => ({ ...m, [r.path]: a.mappaPath }));
      } catch {
        setMappePerPath((m) => ({ ...m, [r.path]: null }));
      }
    }
  }

  async function handleApriPlay(path: string) {
    setErrore(null);
    try {
      await apri(path, "play");
    } catch (e) {
      setErrore(stringifyErr(e));
      void caricaRecenti();
    }
  }

  async function handleApriEdit(path: string) {
    setErrore(null);
    try {
      await apri(path, "edit");
    } catch (e) {
      setErrore(stringifyErr(e));
      void caricaRecenti();
    }
  }

  async function handleElimina(path: string, nome: string) {
    const ok = confirm(
      `Sei sicuro di voler eliminare l'ambientazione "${nome}"?\n\nLa cartella e tutti i file verranno cancellati definitivamente dal disco.`,
    );
    if (!ok) return;
    try {
      await eliminaAmbientazione(path);
      await rimuoviRecente(path);
      void caricaRecenti();
    } catch (e) {
      setErrore(`Impossibile eliminare: ${stringifyErr(e)}`);
    }
  }

  async function handleRipristinaFactory() {
    const ok = confirm(
      "Le tue modifiche agli scenari pre-installati verranno sovrascritte con la versione del bundle. Continuare?",
    );
    if (!ok) return;
    setRipristinoInCorso(true);
    setErrore(null);
    try {
      const ripristinati = await invoke<InstallResult[]>("ripristina_scenari_factory");
      // Aggiorna i recenti con eventuali nuove voci e refresha l'elenco.
      for (const r of ripristinati) {
        try {
          const a = await apriAmbientazione(r.path);
          await aggiungiRecente(r.path, a.nome);
        } catch {
          // manifest non leggibile dopo il ripristino: salta
        }
      }
      await caricaRecenti();
    } catch (e) {
      setErrore(`Impossibile ripristinare gli scenari pre-installati: ${stringifyErr(e)}`);
    } finally {
      setRipristinoInCorso(false);
    }
  }

  return (
    <div className={styles.root}>
      <h1>Ambientazioni</h1>

      <button className={styles.btnNuova} onClick={() => setCreazioneAperta(true)}>
        + Nuova ambientazione
      </button>

      {errore && (
        <div className={styles.errore}>
          {errore}
          <button onClick={() => setErrore(null)} className={styles.chiudiErrore}>
            ×
          </button>
        </div>
      )}

      <h2 className={styles.titoloRecenti}>Disponibili</h2>
      {recenti.filter((r) => r.esiste).length === 0 ? (
        <p className={styles.vuoto}>Nessuna ambientazione disponibile.</p>
      ) : (
        <div className={styles.griglia}>
          {recenti
            .filter((r) => r.esiste)
            .map((v) => {
              const mappaPath = mappePerPath[v.path];
              const mappaUrl = mappaPath ? risolviAsset(v.path, mappaPath) : null;
              return (
                <div key={v.path} className={styles.tile}>
                  <button
                    type="button"
                    className={styles.tileThumb}
                    onClick={() => handleApriPlay(v.path)}
                    title="Apri (modalità gioco)"
                  >
                    {mappaUrl ? (
                      <img
                        src={mappaUrl}
                        alt={v.nome}
                        className={styles.tileMappa}
                        draggable={false}
                      />
                    ) : (
                      <div className={styles.tileSenzaMappa}>nessuna mappa</div>
                    )}
                  </button>
                  <div className={styles.tileFooter}>
                    <span className={styles.tileNome} title={v.nome}>
                      {v.nome}
                    </span>
                    <div className={styles.tileAzioni}>
                      <button
                        type="button"
                        className={styles.tileIcona}
                        onClick={() => handleApriEdit(v.path)}
                        title="Modifica ambientazione"
                        aria-label="Modifica"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className={`${styles.tileIcona} ${styles.tileEliminaIcona}`}
                        onClick={() => void handleElimina(v.path, v.nome)}
                        title="Elimina ambientazione"
                        aria-label="Elimina"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {factoryDisponibili && (
        <div className={styles.ripristinoBox}>
          <button
            type="button"
            className={styles.btnRipristina}
            onClick={() => void handleRipristinaFactory()}
            disabled={ripristinoInCorso}
            title="Ricopia gli scenari pre-installati dal bundle del tool, sovrascrivendo eventuali modifiche"
          >
            {ripristinoInCorso ? "Ripristino in corso…" : "Ripristina scenari pre-installati"}
          </button>
        </div>
      )}

      {creazioneAperta && (
        <ModaleCreazione
          parentFissato={repoScenari}
          onAnnulla={() => setCreazioneAperta(false)}
          onConferma={async (nome, folderParent) => {
            setCreazioneAperta(false);
            try {
              await creaNuova(folderParent, nome);
            } catch (e) {
              setErrore(stringifyErr(e));
            }
          }}
        />
      )}
    </div>
  );
}

function ModaleCreazione({
  parentFissato,
  onAnnulla,
  onConferma,
}: {
  parentFissato: string | null;
  onAnnulla: () => void;
  onConferma: (nome: string, folderParent: string) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [erroreNome, setErroreNome] = useState<string | null>(null);
  const [erroreCartella, setErroreCartella] = useState<string | null>(null);

  async function conferma() {
    const err = validaNome(nome);
    if (err) {
      setErroreNome(err);
      return;
    }
    setErroreNome(null);

    // Se siamo in dev (parentFissato presente) saltiamo il dialog: il nuovo
    // scenario viene creato direttamente in <repo>/scenari-bundled/<nome>/.
    const parent = parentFissato ?? (await open({ directory: true, multiple: false }));
    if (typeof parent !== "string") return;

    try {
      await autorizzaCartella(parent);
      const sep = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
      const target = `${parent.replace(/[/\\]+$/, "")}${sep}${nome.trim()}`;
      const giaPresente = await exists(target);
      if (giaPresente) {
        const ok = confirm(
          `La cartella "${target}" esiste già. Vuoi continuare? I file esistenti non saranno toccati ma il manifest potrebbe essere sovrascritto.`,
        );
        if (!ok) return;
      }
      await onConferma(nome.trim(), parent);
    } catch (e) {
      setErroreCartella(stringifyErr(e));
    }
  }

  return (
    <div className={styles.backdrop} onClick={onAnnulla}>
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        <h2>Nuova ambientazione</h2>
        <label className={styles.label}>
          Nome dell'ambientazione
          <input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void conferma();
              if (e.key === "Escape") onAnnulla();
            }}
            placeholder="es. Misteri di Villa Astri"
          />
        </label>
        {erroreNome && <div className={styles.erroreModale}>{erroreNome}</div>}
        {erroreCartella && <div className={styles.erroreModale}>{erroreCartella}</div>}
        <p className={styles.hint}>
          {parentFissato
            ? `Lo scenario verrà creato in: ${parentFissato} (cartella bundled del repository).`
            : "Al passo successivo sceglierai la cartella dove creare l'ambientazione. Verrà creata una sottocartella con il nome scelto."}
        </p>
        <div className={styles.bottoni}>
          <button className={styles.btnSecondario} onClick={onAnnulla}>
            Annulla
          </button>
          <button className={styles.btnPrimario} onClick={() => void conferma()}>
            {parentFissato ? "Crea" : "Scegli cartella…"}
          </button>
        </div>
      </div>
    </div>
  );
}

function stringifyErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
