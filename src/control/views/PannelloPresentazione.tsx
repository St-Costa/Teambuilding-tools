import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { usePresentazioneStore } from "../../state/presentazioneStore";
import { useConflittoStore } from "../../state/conflittoStore";
import { useLeaderboardStore } from "../../state/leaderboardStore";
import { IconaPresentazione } from "../../components/Icone";
import Presentazione from "../../components/Presentazione";
import styles from "./PannelloPresentazione.module.css";
import toolbar from "./AmbientazioneAperta.module.css";

interface Props {
  numeroBadge?: number;
}

// Componente autonomo: disegna il pulsante in toolbar e, all'apertura, la
// modale di controllo. In EDIT serve a caricare il PDF e scrivere le note per
// pagina; in PLAY proietta le slide e mostra in regia anteprima + nota.
export default function PannelloPresentazione({ numeroBadge }: Props) {
  const modalita = useAmbientazioneStore((s) => s.modalita);
  const inPlay = modalita === "play";
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const presentazionePath = useAmbientazioneStore((s) => s.current?.presentazionePath ?? null);
  const notePresentazione = useAmbientazioneStore((s) => s.current?.notePresentazione ?? {});
  const impostaPresentazione = useAmbientazioneStore((s) => s.impostaPresentazione);
  const rimuoviPresentazione = useAmbientazioneStore((s) => s.rimuoviPresentazione);
  const setNotaPagina = useAmbientazioneStore((s) => s.setNotaPagina);

  const avvia = usePresentazioneStore((s) => s.avvia);
  const chiudi = usePresentazioneStore((s) => s.chiudi);
  const vaiAvanti = usePresentazioneStore((s) => s.vaiAvanti);
  const vaiIndietro = usePresentazioneStore((s) => s.vaiIndietro);
  const setNumPagine = usePresentazioneStore((s) => s.setNumPagine);
  const paginaCorrente = usePresentazioneStore((s) => s.paginaCorrente);
  const numPagineStore = usePresentazioneStore((s) => s.numPagine);

  // Mutua esclusione con gli altri overlay della proiezione.
  const conflittoInCorso = useConflittoStore((s) => s.fase) !== "chiuso";
  const leaderboardInCorso = useLeaderboardStore((s) => s.fase) === "aperta";

  const [aperto, setAperto] = useState(false);
  // true dopo il primo click: pulsante diventa opaco ("già mostrato").
  // Secondo click: reset visivo, nessuna azione sul pannello.
  const [regoleViste, setRegoleViste] = useState(false);
  // Stato di navigazione locale usato SOLO in edit (in play comanda lo store).
  const [paginaEdit, setPaginaEdit] = useState(1);
  const [numPagineEdit, setNumPagineEdit] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);

  const pagina = inPlay ? paginaCorrente : paginaEdit;
  const numPagine = inPlay ? numPagineStore : numPagineEdit;

  const handleNumPagine = useCallback(
    (n: number) => {
      if (inPlay) setNumPagine(n);
      else setNumPagineEdit(n);
    },
    [inPlay, setNumPagine],
  );

  const avanti = useCallback(() => {
    if (inPlay) vaiAvanti();
    else setPaginaEdit((p) => (numPagineEdit > 0 ? Math.min(numPagineEdit, p + 1) : p + 1));
  }, [inPlay, vaiAvanti, numPagineEdit]);

  const indietro = useCallback(() => {
    if (inPlay) vaiIndietro();
    else setPaginaEdit((p) => Math.max(1, p - 1));
  }, [inPlay, vaiIndietro]);

  // Frecce della tastiera per navigare quando la modale è aperta.
  useEffect(() => {
    if (!aperto) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      // Non rubare le frecce mentre si scrive una nota.
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        avanti();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        indietro();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aperto, avanti, indietro]);

  function apri() {
    if (regoleViste) {
      setRegoleViste(false);
      return;
    }
    setRegoleViste(true);
    setErrore(null);
    setPaginaEdit(1);
    if (inPlay) avvia(); // proietta subito la pagina 1 sulla proiezione
    setAperto(true);
  }

  function chiudiPanel() {
    if (inPlay) chiudi(); // ferma la proiezione e torna alla mappa
    setAperto(false);
  }

  async function handleCarica() {
    setErrore(null);
    try {
      const scelto = await open({
        multiple: false,
        filters: [{ name: "Presentazione PDF", extensions: ["pdf"] }],
      });
      if (typeof scelto !== "string") return;
      await impostaPresentazione(scelto);
      setPaginaEdit(1);
      setNumPagineEdit(0);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
    }
  }

  function handleRimuovi() {
    if (!confirm("Rimuovere la presentazione e tutte le note delle pagine?")) return;
    rimuoviPresentazione();
    setPaginaEdit(1);
    setNumPagineEdit(0);
  }

  // Il pulsante è disabilitato se un altro overlay è attivo, o (in play) se non
  // c'è alcuna presentazione caricata.
  const altroOverlay = conflittoInCorso || leaderboardInCorso;
  const disabilitato = altroOverlay || (inPlay && !presentazionePath);
  const titolo = altroOverlay
    ? "Chiudi prima conflitto/leaderboard"
    : inPlay && !presentazionePath
      ? "Nessuna presentazione caricata"
      : inPlay
        ? "Avvia la presentazione delle regole"
        : "Carica la presentazione e scrivi le note";

  const notaCorrente = notePresentazione[pagina] ?? "";

  return (
    <>
      <button
        className={`${toolbar.btnIcona}${regoleViste ? ` ${styles.btnRegoleViste}` : ""}`}
        onClick={apri}
        disabled={disabilitato}
        title={regoleViste ? "Regole già mostrate — clicca per reimpostare" : titolo}
        aria-label="Presentazione"
        style={{ position: "relative" }}
      >
        <IconaPresentazione dimensione={28} />
        {numeroBadge !== undefined && <span className={styles.numeroBadge}>{numeroBadge}</span>}
      </button>

      {aperto && (
        <div className={styles.backdrop} onClick={chiudiPanel}>
          <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
            <header className={styles.header}>
              <h2>Presentazione delle regole</h2>
              {presentazionePath && (
                <span className={styles.contatore}>
                  Pagina {pagina}
                  {numPagine > 0 ? ` di ${numPagine}` : ""}
                </span>
              )}
            </header>

            {errore && <div className={styles.errore}>{errore}</div>}

            {!presentazionePath ? (
              <div className={styles.bodyVuoto}>
                <p>
                  {inPlay
                    ? "Nessuna presentazione caricata per questa ambientazione."
                    : "Carica un file PDF con le regole da mostrare a inizio gioco. Potrai scrivere una nota per ogni pagina."}
                </p>
                {!inPlay && (
                  <button className={styles.btnPrimario} onClick={() => void handleCarica()}>
                    Carica PDF…
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.body}>
                <div className={styles.colonnaAnteprima}>
                  <div className={styles.anteprima}>
                    {folderPath && (
                      <Presentazione
                        folderPath={folderPath}
                        presentazionePath={presentazionePath}
                        pagina={pagina}
                        onNumPagine={handleNumPagine}
                        onErrore={setErrore}
                      />
                    )}
                  </div>
                  <div className={styles.navigazione}>
                    <button
                      className={styles.btnNav}
                      onClick={indietro}
                      disabled={pagina <= 1}
                      aria-label="Pagina precedente"
                      title="Pagina precedente"
                    >
                      ◀
                    </button>
                    <span className={styles.posizione}>
                      {pagina}
                      {numPagine > 0 ? ` / ${numPagine}` : ""}
                    </span>
                    <button
                      className={styles.btnNav}
                      onClick={avanti}
                      disabled={numPagine > 0 && pagina >= numPagine}
                      aria-label="Pagina successiva"
                      title="Pagina successiva"
                    >
                      ▶
                    </button>
                  </div>
                </div>

                <div className={styles.colonnaNota}>
                  <label className={styles.etichettaNota}>
                    Nota della pagina {pagina}
                    {inPlay ? " (sola lettura durante il gioco)" : ""}
                  </label>
                  {inPlay ? (
                    <div className={styles.notaLettura}>
                      {notaCorrente || (
                        <span className={styles.notaVuota}>Nessuna nota per questa pagina.</span>
                      )}
                    </div>
                  ) : (
                    <textarea
                      className={styles.notaTextarea}
                      value={notaCorrente}
                      onChange={(e) => setNotaPagina(pagina, e.target.value)}
                      placeholder="Scrivi qui la nota per questa pagina (la vedrai in regia durante il gioco)…"
                    />
                  )}
                </div>
              </div>
            )}

            <footer className={styles.footer}>
              {!inPlay && presentazionePath && (
                <>
                  <button className={styles.btnSecondario} onClick={() => void handleCarica()}>
                    Sostituisci PDF…
                  </button>
                  <button
                    className={`${styles.btnSecondario} ${styles.btnPericolo}`}
                    onClick={handleRimuovi}
                  >
                    Rimuovi
                  </button>
                </>
              )}
              <div className={styles.spacer} />
              <button className={styles.btnPrimario} onClick={chiudiPanel}>
                {inPlay ? "Chiudi presentazione" : "Fatto"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
