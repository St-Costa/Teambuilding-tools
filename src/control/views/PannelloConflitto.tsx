import { useMemo, useState } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import {
  useConflittoStore,
  type Fonte,
  type PartecipanteConflitto,
} from "../../state/conflittoStore";
import { calcolaFette, type Modificatore } from "../../lib/ruota";
import { risolviAsset } from "../../lib/storage";
import type { ConflittoSnapshot, FonteSnap, PartecipanteSnap } from "../../lib/events";
import Cerchietto from "../../components/Cerchietto";
import Quadratino from "../../components/Quadratino";
import Ruota from "../../components/Ruota";
import styles from "./PannelloConflitto.module.css";

type Step = "partecipanti" | "modificatori" | "spin";

interface Props {
  onChiudi: () => void;
}

export default function PannelloConflitto({ onChiudi }: Props) {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const partecipanti = useConflittoStore((s) => s.partecipanti);
  const fase = useConflittoStore((s) => s.fase);
  const vincitoreId = useConflittoStore((s) => s.vincitoreId);
  const angoloCorrente = useConflittoStore((s) => s.angoloCorrente);
  const triggerCount = useConflittoStore((s) => s.triggerCount);
  const fetteCorrenti = useConflittoStore((s) => s.fetteCorrenti);
  const snapshotSpin = useConflittoStore((s) => s.snapshotPartecipanti);

  const aggiungi = useConflittoStore((s) => s.aggiungiPartecipante);
  const rimuovi = useConflittoStore((s) => s.rimuoviPartecipante);
  const setMod = useConflittoStore((s) => s.setModificatore);
  const preparaSpin = useConflittoStore((s) => s.preparaSpin);
  const tornaSetup = useConflittoStore((s) => s.tornaSetup);
  const gira = useConflittoStore((s) => s.gira);
  const finitoSpin = useConflittoStore((s) => s.finitoSpin);
  const chiudi = useConflittoStore((s) => s.chiudi);

  const [step, setStep] = useState<Step>("partecipanti");

  // Anteprima per step 2: snapshot live (non quello bloccato della fase girando).
  const snapshotAnteprima = useMemo<PartecipanteSnap[]>(() => {
    if (!current) return [];
    const out: PartecipanteSnap[] = [];
    for (const p of partecipanti) {
      const personaggio = current.personaggi.find((x) => x.id === p.personaggioId);
      if (!personaggio) continue;
      let fonteSnap: FonteSnap | null = null;
      const fonte = p.fonte;
      if (fonte?.tipo === "testo") {
        fonteSnap = { tipo: "testo", testo: fonte.testo };
      } else if (fonte?.tipo === "oggetto") {
        const ogg = current.oggetti.find((o) => o.id === fonte.oggettoId);
        if (ogg) {
          fonteSnap = {
            tipo: "oggetto",
            oggettoId: ogg.id,
            nome: ogg.nome,
            imgPath: ogg.imgPath,
            crop: ogg.crop,
          };
        }
      }
      out.push({
        personaggioId: personaggio.id,
        nome: personaggio.nome,
        colore: personaggio.colore,
        imgPath: personaggio.imgPath,
        crop: personaggio.crop,
        modificatore: p.modificatore,
        fonte: fonteSnap,
      });
    }
    return out;
  }, [current, partecipanti]);

  const fetteAnteprima = useMemo(
    () =>
      calcolaFette(
        snapshotAnteprima.map((s) => ({ id: s.personaggioId, modificatore: s.modificatore })),
      ),
    [snapshotAnteprima],
  );

  if (!current || !folderPath) return null;

  function handleChiudi() {
    if (fase === "girando") return; // niente chiusura mid-spin
    chiudi();
    onChiudi();
  }

  function handleToggle(id: string) {
    if (partecipanti.some((p) => p.personaggioId === id)) rimuovi(id);
    else aggiungi(id);
  }

  function handleGira() {
    gira();
    setStep("spin");
  }

  const partecipantiSelezionati = new Set(partecipanti.map((p) => p.personaggioId));

  // ANTEPRIMA snapshot per Ruota: deve avere il formato ConflittoSnapshot
  const anteprimaSnapshot: ConflittoSnapshot = {
    fase: "risultato", // niente animazione per la preview
    partecipanti: snapshotAnteprima,
    fette: fetteAnteprima,
    angoloFinale: 0,
    vincitoreId: "",
    durataSpinMs: 0,
    triggerCount: 0,
  };

  // SNAPSHOT per Step 3: include la fase "pronto" (ruota ferma prima dello spin),
  // "girando" (in animazione), "risultato" (vincitore mostrato).
  const spinSnapshot: ConflittoSnapshot | null =
    fetteCorrenti.length > 0 && (fase === "pronto" || fase === "girando" || fase === "risultato")
      ? {
          fase,
          partecipanti: snapshotSpin,
          fette: fetteCorrenti,
          angoloFinale: angoloCorrente,
          vincitoreId,
          durataSpinMs: 5000,
          triggerCount,
        }
      : null;

  return (
    <div className={styles.backdrop}>
      <div className={styles.modale}>
        <header className={styles.header}>
          <h2>Conflitto</h2>
          <ol className={styles.passi}>
            <li className={step === "partecipanti" ? styles.passoAttivo : ""}>1. Partecipanti</li>
            <li className={step === "modificatori" ? styles.passoAttivo : ""}>2. Modificatori</li>
            <li className={step === "spin" ? styles.passoAttivo : ""}>3. Gira la ruota</li>
          </ol>
        </header>

        {step === "partecipanti" && (
          <div className={styles.body}>
            <p className={styles.hint}>Seleziona almeno 2 personaggi che si contendono l'esito.</p>
            <ul className={styles.listaPartecipanti}>
              {current.personaggi.map((p) => {
                const selezionato = partecipantiSelezionati.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      className={`${styles.itemPartecipante} ${selezionato ? styles.itemSelezionato : ""}`}
                      onClick={() => handleToggle(p.id)}
                    >
                      <Cerchietto
                        src={risolviAsset(folderPath, p.imgPath)}
                        colore={p.colore}
                        crop={p.crop}
                        dimensione={40}
                        alt={p.nome}
                      />
                      <span>{p.nome}</span>
                      {selezionato && <span className={styles.checkbox}>✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {step === "modificatori" && (
          <div className={styles.bodyDoppio}>
            <div className={styles.colonnaModificatori}>
              <p className={styles.hint}>Imposta eventuali modificatori e la loro fonte.</p>
              {partecipanti.map((p) => {
                const personaggio = current.personaggi.find((x) => x.id === p.personaggioId);
                if (!personaggio) return null;
                const oggettoAttaccato = personaggio.oggettoId
                  ? (current.oggetti.find((o) => o.id === personaggio.oggettoId) ?? null)
                  : null;
                return (
                  <FilaModificatore
                    key={p.personaggioId}
                    partecipante={p}
                    personaggio={personaggio}
                    folderPath={folderPath}
                    oggettoAttaccato={oggettoAttaccato}
                    setMod={(mod, fonte) => setMod(p.personaggioId, mod, fonte)}
                  />
                );
              })}
            </div>
            <div className={styles.colonnaAnteprima}>
              <p className={styles.hintCentrato}>Anteprima ruota</p>
              <Ruota
                snapshot={anteprimaSnapshot}
                folderPath={folderPath}
                dimensione={220}
                animata={false}
              />
              <ul className={styles.legenda}>
                {snapshotAnteprima.map((s, i) => {
                  const f = fetteAnteprima[i];
                  if (!f) return null;
                  return (
                    <li key={s.personaggioId} style={{ color: s.colore }}>
                      <strong>{s.nome}</strong>: {(f.totaleFrazione * 100).toFixed(1)}%
                      {s.modificatore && (
                        <span className={styles.legendaMod}> ({s.modificatore})</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {step === "spin" && spinSnapshot && (
          <div className={styles.bodySpin}>
            <Ruota
              snapshot={spinSnapshot}
              folderPath={folderPath}
              dimensione={420}
              animata={true}
              suonaTick={true}
              onSpinFine={finitoSpin}
            />
            {fase === "risultato" && (
              <div className={styles.risultatoBanner}>
                <span>Vincitore: </span>
                <strong>
                  {snapshotSpin.find((s) => s.personaggioId === vincitoreId)?.nome ?? "?"}
                </strong>
              </div>
            )}
          </div>
        )}

        {step === "spin" && !spinSnapshot && (
          <div className={styles.bodySpin}>
            <Ruota
              snapshot={anteprimaSnapshot}
              folderPath={folderPath}
              dimensione={420}
              animata={false}
            />
            <p className={styles.hintCentrato}>Premi "Gira la ruota" per iniziare.</p>
          </div>
        )}

        <footer className={styles.footer}>
          {fase !== "girando" && (
            <button type="button" className={styles.btnSecondario} onClick={handleChiudi}>
              {fase === "risultato" ? "Chiudi e torna alla mappa" : "Annulla"}
            </button>
          )}
          <div className={styles.spacer} />
          {step === "partecipanti" && (
            <button
              type="button"
              className={styles.btnPrimario}
              onClick={() => setStep("modificatori")}
              disabled={partecipanti.length < 2}
            >
              Avanti ({partecipanti.length} selezionati)
            </button>
          )}
          {step === "modificatori" && (
            <>
              <button
                type="button"
                className={styles.btnSecondario}
                onClick={() => setStep("partecipanti")}
              >
                Indietro
              </button>
              <button
                type="button"
                className={styles.btnPrimario}
                onClick={() => {
                  preparaSpin();
                  setStep("spin");
                }}
              >
                Avanti
              </button>
            </>
          )}
          {step === "spin" && fase !== "risultato" && fase !== "girando" && (
            <>
              <button
                type="button"
                className={styles.btnSecondario}
                onClick={() => {
                  tornaSetup();
                  setStep("modificatori");
                }}
              >
                Indietro
              </button>
              <button
                type="button"
                className={styles.btnPrimario}
                onClick={handleGira}
                disabled={partecipanti.length < 2}
              >
                Gira la ruota
              </button>
            </>
          )}
          {step === "spin" && fase === "girando" && (
            <span className={styles.spinHint}>Ruota in movimento…</span>
          )}
        </footer>
      </div>
    </div>
  );
}

function FilaModificatore({
  partecipante,
  personaggio,
  folderPath,
  oggettoAttaccato,
  setMod,
}: {
  partecipante: PartecipanteConflitto;
  personaggio: import("../../lib/ambientazione").Personaggio;
  folderPath: string;
  oggettoAttaccato: import("../../lib/ambientazione").Oggetto | null;
  setMod: (mod: Modificatore, fonte: Fonte | null) => void;
}) {
  const mod = partecipante.modificatore;
  const fonte = partecipante.fonte;

  function handleMod(nuovo: Modificatore) {
    if (nuovo === null) setMod(null, null);
    else setMod(nuovo, fonte ?? { tipo: "testo", testo: "" });
  }

  function handleFonte(nuova: Fonte) {
    if (mod === null) return;
    setMod(mod, nuova);
  }

  return (
    <div className={styles.fila}>
      <div className={styles.filaHeader}>
        <Cerchietto
          src={risolviAsset(folderPath, personaggio.imgPath)}
          colore={personaggio.colore}
          crop={personaggio.crop}
          dimensione={36}
          alt={personaggio.nome}
        />
        <strong>{personaggio.nome}</strong>
      </div>
      <div className={styles.gruppoRadio}>
        <label>
          <input
            type="radio"
            name={`mod-${personaggio.id}`}
            checked={mod === null}
            onChange={() => handleMod(null)}
          />
          Nessuno
        </label>
        <label>
          <input
            type="radio"
            name={`mod-${personaggio.id}`}
            checked={mod === "+1"}
            onChange={() => handleMod("+1")}
          />
          +1 (+20%)
        </label>
        <label>
          <input
            type="radio"
            name={`mod-${personaggio.id}`}
            checked={mod === "+2"}
            onChange={() => handleMod("+2")}
          />
          +2 (+40%)
        </label>
      </div>
      {mod !== null && (
        <div className={styles.fontePanel}>
          <div className={styles.gruppoRadio}>
            <label
              title={
                oggettoAttaccato
                  ? `Usa "${oggettoAttaccato.nome}" (assegnato al personaggio)`
                  : "Nessun oggetto assegnato a questo personaggio"
              }
            >
              <input
                type="radio"
                name={`fonte-${personaggio.id}`}
                checked={fonte?.tipo === "oggetto"}
                onChange={() => {
                  if (oggettoAttaccato) {
                    handleFonte({ tipo: "oggetto", oggettoId: oggettoAttaccato.id });
                  }
                }}
                disabled={!oggettoAttaccato}
              />
              {oggettoAttaccato
                ? `Oggetto (${oggettoAttaccato.nome})`
                : "Oggetto (nessuno assegnato)"}
            </label>
            <label>
              <input
                type="radio"
                name={`fonte-${personaggio.id}`}
                checked={fonte?.tipo === "testo"}
                onChange={() =>
                  handleFonte({ tipo: "testo", testo: fonte?.tipo === "testo" ? fonte.testo : "" })
                }
              />
              Descrizione libera
            </label>
          </div>
          {fonte?.tipo === "testo" && (
            <input
              type="text"
              value={fonte.testo}
              onChange={(e) => handleFonte({ tipo: "testo", testo: e.target.value })}
              maxLength={40}
              placeholder="es. superiorità numerica"
              className={styles.inputTesto}
            />
          )}
          {fonte?.tipo === "oggetto" && oggettoAttaccato && (
            <div className={styles.previewFonte}>
              <Quadratino
                src={risolviAsset(folderPath, oggettoAttaccato.imgPath)}
                crop={oggettoAttaccato.crop}
                dimensione={32}
                alt={oggettoAttaccato.nome}
              />
              <span>{oggettoAttaccato.nome}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
