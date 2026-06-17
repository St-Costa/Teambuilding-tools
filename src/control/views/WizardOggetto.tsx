import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { cropIniziale, validaNomeOggetto, type Crop, type Oggetto } from "../../lib/ambientazione";
import { cropDiPartenzaDaImmagine } from "../../lib/immagine";
import MaschereCircolare from "../components/MaschereCircolare";
import styles from "./WizardOggetto.module.css";

interface Props {
  oggettiEsistenti: Oggetto[];
  onAnnulla: () => void;
  onConferma: (input: { sourceImgPath: string; nome: string; crop: Crop }) => Promise<void>;
}

type Step = "immagine" | "ritaglio";

const COLORE_NEUTRO = "#888888";

export default function WizardOggetto({ oggettiEsistenti, onAnnulla, onConferma }: Props) {
  const [step, setStep] = useState<Step>("immagine");
  const [sourceImgPath, setSourceImgPath] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>(cropIniziale());
  const [nome, setNome] = useState("");
  const [erroreNome, setErroreNome] = useState<string | null>(null);
  const [erroreGenerico, setErroreGenerico] = useState<string | null>(null);
  const [inviando, setInviando] = useState(false);

  async function scegliImmagine() {
    try {
      const scelto = await open({
        multiple: false,
        filters: [{ name: "Immagini", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
      });
      if (typeof scelto === "string") {
        setSourceImgPath(scelto);
        setCrop(await cropDiPartenzaDaImmagine(scelto));
        setStep("ritaglio");
      }
    } catch (e) {
      setErroreGenerico(stringifyErr(e));
    }
  }

  async function conferma() {
    const err = validaNomeOggetto(nome, oggettiEsistenti);
    if (err) {
      setErroreNome(err);
      return;
    }
    setErroreNome(null);
    if (!sourceImgPath) {
      setErroreGenerico("Nessuna immagine selezionata.");
      return;
    }
    setInviando(true);
    setErroreGenerico(null);
    try {
      await onConferma({ sourceImgPath, nome: nome.trim(), crop });
    } catch (e) {
      setErroreGenerico(stringifyErr(e));
      setInviando(false);
    }
  }

  function handleAnnulla() {
    if (sourceImgPath && !inviando) {
      const ok = confirm("Annullare la creazione dell'oggetto?");
      if (!ok) return;
    }
    onAnnulla();
  }

  const previewUrl = sourceImgPath ? convertFileSrc(sourceImgPath) : null;

  return (
    <div className={styles.backdrop} onClick={handleAnnulla}>
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2>Nuovo oggetto</h2>
          <ol className={styles.passi}>
            <li className={step === "immagine" ? styles.passoAttivo : ""}>1. Immagine</li>
            <li className={step === "ritaglio" ? styles.passoAttivo : ""}>2. Ritaglio e nome</li>
          </ol>
        </header>

        {step === "immagine" && (
          <div className={styles.contenuto}>
            <p>Scegli un'immagine per l'oggetto (PNG, JPG, WebP, GIF o BMP).</p>
            <button className={styles.btnPrimario} onClick={() => void scegliImmagine()}>
              Scegli immagine…
            </button>
          </div>
        )}

        {step === "ritaglio" && previewUrl && (
          <div className={styles.contenuto}>
            <MaschereCircolare
              src={previewUrl}
              colore={COLORE_NEUTRO}
              crop={crop}
              onChange={setCrop}
            />
            <label className={styles.label}>
              Nome dell'oggetto
              <input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void conferma()}
                placeholder="es. Pistola, Spada, Chiave"
                maxLength={50}
              />
            </label>
            {erroreNome && <div className={styles.errore}>{erroreNome}</div>}
          </div>
        )}

        {erroreGenerico && <div className={styles.errore}>{erroreGenerico}</div>}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.btnSecondario}
            onClick={handleAnnulla}
            disabled={inviando}
          >
            Annulla
          </button>
          <div className={styles.spacer} />
          {step === "ritaglio" && (
            <>
              <button
                type="button"
                className={styles.btnSecondario}
                onClick={() => setStep("immagine")}
                disabled={inviando}
              >
                Indietro
              </button>
              <button
                type="button"
                className={styles.btnPrimario}
                onClick={() => void conferma()}
                disabled={inviando}
              >
                {inviando ? "Creazione…" : "Crea oggetto"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

function stringifyErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
