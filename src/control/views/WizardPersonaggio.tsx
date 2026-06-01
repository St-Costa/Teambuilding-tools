import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  cropIniziale,
  validaNomePersonaggio,
  type Crop,
  type Personaggio,
} from "../../lib/ambientazione";
import { PALETTE, nomeColore, primoColoreLibero } from "../../lib/colori";
import MaschereCircolare from "../components/MaschereCircolare";
import styles from "./WizardPersonaggio.module.css";

interface Props {
  personaggiEsistenti: Personaggio[];
  onAnnulla: () => void;
  onConferma: (input: { sourceImgPath: string; nome: string; colore: string; crop: Crop; npc: boolean }) => Promise<void>;
}

type Step = "immagine" | "ritaglio" | "dettagli";

export default function WizardPersonaggio({
  personaggiEsistenti,
  onAnnulla,
  onConferma,
}: Props) {
  const [step, setStep] = useState<Step>("immagine");
  const [sourceImgPath, setSourceImgPath] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>(cropIniziale());
  const [nome, setNome] = useState("");
  const [colore, setColore] = useState<string>(
    primoColoreLibero(personaggiEsistenti.map((p) => p.colore)) ?? PALETTE[0].hex,
  );
  const [npc, setNpc] = useState(false);
  const [erroreNome, setErroreNome] = useState<string | null>(null);
  const [erroreGenerico, setErroreGenerico] = useState<string | null>(null);
  const [inviando, setInviando] = useState(false);

  const coloriUsati = new Set(
    personaggiEsistenti.map((p) => p.colore.toUpperCase()),
  );

  async function scegliImmagine() {
    try {
      const scelto = await open({
        multiple: false,
        filters: [
          { name: "Immagini", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] },
        ],
      });
      if (typeof scelto === "string") {
        setSourceImgPath(scelto);
        setCrop(await cropDiPartenza(scelto));
        setStep("ritaglio");
      }
    } catch (e) {
      setErroreGenerico(stringifyErr(e));
    }
  }

  async function cropDiPartenza(path: string): Promise<Crop> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const lato = Math.max(img.naturalWidth, img.naturalHeight);
        const lato_corto = Math.min(img.naturalWidth, img.naturalHeight);
        const zoomNaturale = lato_corto > 0 ? lato / lato_corto : 1;
        const zoom = Math.min(10, Math.max(0.5, zoomNaturale));
        resolve({ zoom, offsetX: 0, offsetY: 0 });
      };
      img.onerror = () => resolve(cropIniziale());
      img.src = convertFileSrc(path);
    });
  }

  function handleConfermaNome() {
    const err = validaNomePersonaggio(nome, personaggiEsistenti);
    if (err) {
      setErroreNome(err);
      return;
    }
    setErroreNome(null);
    void inviaPersonaggio();
  }

  async function inviaPersonaggio() {
    if (!sourceImgPath) {
      setErroreGenerico("Nessuna immagine selezionata.");
      return;
    }
    setInviando(true);
    setErroreGenerico(null);
    try {
      await onConferma({ sourceImgPath, nome: nome.trim(), colore, crop, npc });
    } catch (e) {
      setErroreGenerico(stringifyErr(e));
      setInviando(false);
    }
  }

  function handleAnnulla() {
    if (sourceImgPath && !inviando) {
      const ok = confirm("Annullare la creazione del personaggio?");
      if (!ok) return;
    }
    onAnnulla();
  }

  const previewUrl = sourceImgPath ? convertFileSrc(sourceImgPath) : null;

  return (
    <div className={styles.backdrop} onClick={handleAnnulla}>
      <div className={styles.modale} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2>Nuovo personaggio</h2>
          <ol className={styles.passi}>
            <li className={step === "immagine" ? styles.passoAttivo : ""}>1. Immagine</li>
            <li className={step === "ritaglio" ? styles.passoAttivo : ""}>2. Centra la faccia</li>
            <li className={step === "dettagli" ? styles.passoAttivo : ""}>3. Nome e colore</li>
          </ol>
        </header>

        {step === "immagine" && (
          <div className={styles.contenuto}>
            <p>Scegli un'immagine per il personaggio (PNG, JPG, WebP, GIF o BMP).</p>
            <button className={styles.btnPrimario} onClick={() => void scegliImmagine()}>
              Scegli immagine…
            </button>
          </div>
        )}

        {step === "ritaglio" && previewUrl && (
          <div className={styles.contenuto}>
            <MaschereCircolare
              src={previewUrl}
              colore={colore}
              crop={crop}
              onChange={setCrop}
            />
          </div>
        )}

        {step === "dettagli" && previewUrl && (
          <div className={styles.contenuto}>
            <div className={styles.previewDettagli}>
              <div
                className={styles.cerchioPreview}
                style={{ borderColor: colore }}
              >
                <img
                  src={previewUrl}
                  alt=""
                  draggable={false}
                  style={{
                    transform: `translate(${crop.offsetX * 100}%, ${crop.offsetY * 100}%) scale(${crop.zoom})`,
                  }}
                />
              </div>
              <p className={styles.previewLabel}>
                {nome.trim() || "(senza nome)"} — {nomeColore(colore)}
              </p>
            </div>
            <label className={styles.label}>
              Nome
              <input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfermaNome()}
                placeholder="es. Anna"
                maxLength={50}
              />
            </label>
            {erroreNome && <div className={styles.errore}>{erroreNome}</div>}
            <div className={styles.palette}>
              {PALETTE.map((c) => {
                const usato = coloriUsati.has(c.hex.toUpperCase()) && c.hex !== colore;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    className={`${styles.colore} ${c.hex === colore ? styles.coloreScelto : ""} ${usato ? styles.coloreUsato : ""}`}
                    style={{ background: c.hex }}
                    onClick={() => !usato && setColore(c.hex)}
                    disabled={usato}
                    title={usato ? `${c.nome} (già usato)` : c.nome}
                    aria-label={c.nome}
                  >
                    {c.hex === colore && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </div>
            <label className={styles.npc}>
              <input
                type="checkbox"
                checked={npc}
                onChange={(e) => setNpc(e.target.checked)}
              />
              Personaggio NPC (escluso dalla classifica, ma usabile nei conflitti)
            </label>
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
              >
                Indietro
              </button>
              <button
                type="button"
                className={styles.btnPrimario}
                onClick={() => setStep("dettagli")}
              >
                Avanti
              </button>
            </>
          )}
          {step === "dettagli" && (
            <>
              <button
                type="button"
                className={styles.btnSecondario}
                onClick={() => setStep("ritaglio")}
                disabled={inviando}
              >
                Indietro
              </button>
              <button
                type="button"
                className={styles.btnPrimario}
                onClick={handleConfermaNome}
                disabled={inviando}
              >
                {inviando ? "Creazione…" : "Crea personaggio"}
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
