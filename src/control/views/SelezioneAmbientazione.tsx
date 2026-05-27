import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import {
  listaRecenti,
  rimuoviRecente,
  type RecentEntryConStato,
} from "../../lib/recents";
import { validaNome } from "../../lib/ambientazione";
import { exists } from "@tauri-apps/plugin-fs";
import { autorizzaCartella } from "../../lib/storage";
import styles from "./SelezioneAmbientazione.module.css";

export default function SelezioneAmbientazione() {
  const apri = useAmbientazioneStore((s) => s.apri);
  const creaNuova = useAmbientazioneStore((s) => s.creaNuova);

  const [recenti, setRecenti] = useState<RecentEntryConStato[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [creazioneAperta, setCreazioneAperta] = useState(false);

  useEffect(() => {
    void caricaRecenti();
  }, []);

  async function caricaRecenti() {
    try {
      setRecenti(await listaRecenti());
    } catch (e) {
      setErrore(`Impossibile caricare le ambientazioni recenti: ${stringifyErr(e)}`);
    }
  }

  async function handleApri() {
    setErrore(null);
    const scelta = await open({ directory: true, multiple: false });
    if (typeof scelta !== "string") return;
    try {
      await apri(scelta);
    } catch (e) {
      setErrore(stringifyErr(e));
    }
  }

  async function handleApriRecente(path: string) {
    setErrore(null);
    try {
      await apri(path);
    } catch (e) {
      setErrore(stringifyErr(e));
      void caricaRecenti();
    }
  }

  async function handleRimuoviRecente(path: string, e: React.MouseEvent) {
    e.stopPropagation();
    await rimuoviRecente(path);
    void caricaRecenti();
  }

  return (
    <div className={styles.root}>
      <h1>Apri o crea un'ambientazione</h1>
      <p className={styles.intro}>
        Un'ambientazione è una cartella sul tuo computer che contiene mappa,
        personaggi, oggetti e tutto il resto del materiale per la sessione.
      </p>

      <div className={styles.azioni}>
        <button className={styles.azione} onClick={handleApri}>
          <span className={styles.azioneTitolo}>Apri esistente</span>
          <span className={styles.azioneHint}>Scegli una cartella di ambientazione già creata</span>
        </button>
        <button className={styles.azione} onClick={() => setCreazioneAperta(true)}>
          <span className={styles.azioneTitolo}>Nuova ambientazione</span>
          <span className={styles.azioneHint}>Crea una cartella vuota da popolare</span>
        </button>
      </div>

      {errore && (
        <div className={styles.errore}>
          {errore}
          <button onClick={() => setErrore(null)} className={styles.chiudiErrore}>×</button>
        </div>
      )}

      <h2 className={styles.titoloRecenti}>Ambientazioni recenti</h2>
      {recenti.length === 0 ? (
        <p className={styles.vuoto}>Nessuna ambientazione recente.</p>
      ) : (
        <ul className={styles.lista}>
          {recenti.map((v) => (
            <li
              key={v.path}
              className={`${styles.voce} ${!v.esiste ? styles.voceMancante : ""}`}
            >
              <button
                className={styles.voceMain}
                onClick={() => v.esiste && handleApriRecente(v.path)}
                disabled={!v.esiste}
                title={v.path}
              >
                <span className={styles.voceNome}>{v.nome}</span>
                <span className={styles.vocePath}>{v.path}</span>
                <span className={styles.voceData}>
                  {v.esiste ? formattaData(v.lastOpenedAt) : "cartella mancante"}
                </span>
              </button>
              <button
                className={styles.voceRimuovi}
                onClick={(e) => handleRimuoviRecente(v.path, e)}
                title="Rimuovi dalla lista"
                aria-label="Rimuovi dalla lista"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {creazioneAperta && (
        <ModaleCreazione
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
  onAnnulla,
  onConferma,
}: {
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

    const parent = await open({ directory: true, multiple: false });
    if (typeof parent !== "string") return;

    try {
      await autorizzaCartella(parent);
      const sep = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
      const target = `${parent.replace(/[\/\\]+$/, "")}${sep}${nome.trim()}`;
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
          Al passo successivo sceglierai la cartella dove creare l'ambientazione.
          Verrà creata una sottocartella con il nome scelto.
        </p>
        <div className={styles.bottoni}>
          <button className={styles.btnSecondario} onClick={onAnnulla}>
            Annulla
          </button>
          <button className={styles.btnPrimario} onClick={() => void conferma()}>
            Scegli cartella…
          </button>
        </div>
      </div>
    </div>
  );
}

function formattaData(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stringifyErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
