import { useRef } from "react";
import type { RigaVotiSnap, VotiSnapshot, PersonaggioMiniSnap } from "../lib/events";
import { risolviAsset } from "../lib/storage";
import Cerchietto from "./Cerchietto";
import { IconaManette } from "./Icone";
import { useViewport } from "../lib/useViewport";
import styles from "./ScenaVoti.module.css";

interface Props {
  snapshot: VotiSnapshot;
  folderPath: string;
  sfondoSrc: string | null;
}

// Caselle del "5" del dado: 4 angoli (0..3) + centro (4). Le coordinate sono
// calcolate sul box 2×2 così il centro si sovrappone agli angoli senza
// aumentare l'ingombro rispetto a 4 voti.
const GAP_VOTI = 4;
function posizioneCasella(slot: number, dim: number): { top: number; left: number } {
  const passo = dim + GAP_VOTI;
  const centro = passo / 2; // (box - dim)/2 con box = 2*dim + gap
  switch (slot) {
    case 0:
      return { top: 0, left: 0 };
    case 1:
      return { top: 0, left: passo };
    case 2:
      return { top: passo, left: 0 };
    case 3:
      return { top: passo, left: passo };
    default:
      return { top: centro, left: centro };
  }
}

// Assegna a ogni votante una casella stabile (0..4) ricordando il render
// precedente. Regola: il centro (4) è usato solo quando i 4 angoli sono pieni;
// se un angolo si libera mentre il centro è occupato, l'occupante del centro
// (cioè il 5° voto) scende nell'angolo liberato — così togliendo uno dei primi
// 4 voti è sempre il voto centrale a prenderne il posto.
function assegnaCaselle(
  votanti: PersonaggioMiniSnap[],
  precedenti: Map<string, number>,
): Map<string, number> {
  const idsCorrenti = new Set(votanti.map((v) => v.personaggioId));
  const assegnazioni = new Map<string, number>();
  // Mantieni le caselle dei votanti ancora presenti.
  for (const [id, slot] of precedenti) {
    if (idsCorrenti.has(id)) assegnazioni.set(id, slot);
  }
  const occupati = () => new Set(assegnazioni.values());
  const primoAngoloLibero = () => {
    const occ = occupati();
    for (let s = 0; s < 4; s++) if (!occ.has(s)) return s;
    return -1;
  };
  // Se il centro è occupato ma c'è un angolo libero, sposta il centro nell'angolo.
  const idCentro = [...assegnazioni].find(([, s]) => s === 4)?.[0];
  if (idCentro !== undefined) {
    const angolo = primoAngoloLibero();
    if (angolo !== -1) assegnazioni.set(idCentro, angolo);
  }
  // Assegna i votanti nuovi: prima gli angoli, poi il centro.
  for (const v of votanti) {
    if (assegnazioni.has(v.personaggioId)) continue;
    const angolo = primoAngoloLibero();
    assegnazioni.set(v.personaggioId, angolo !== -1 ? angolo : 4);
  }
  return assegnazioni;
}

// Griglia dei votanti a forma di "5" del dado (fino a 5 voti), con caselle
// stabili tra i render. Oltre i 5 voti si ripiega sul flow grid a 2 colonne.
function GrigliaVotanti({
  votanti,
  folderPath,
  dim,
}: {
  votanti: PersonaggioMiniSnap[];
  folderPath: string;
  dim: number;
}) {
  const caselleRef = useRef<Map<string, number>>(new Map());

  if (votanti.length > 5) {
    caselleRef.current = new Map();
    return (
      <div className={styles.rigaVotanti} style={{ gridTemplateColumns: `repeat(2, ${dim}px)` }}>
        {votanti.map((v) => (
          <Cerchietto
            key={v.personaggioId}
            src={risolviAsset(folderPath, v.imgPath)}
            colore={v.colore}
            crop={v.crop}
            dimensione={dim}
            alt={v.nome}
          />
        ))}
      </div>
    );
  }

  const caselle = assegnaCaselle(votanti, caselleRef.current);
  caselleRef.current = caselle;
  const gridSize = dim * 2 + GAP_VOTI;

  return (
    <div style={{ position: "relative", width: gridSize, height: gridSize, flexShrink: 0 }}>
      {votanti.map((v) => {
        const slot = caselle.get(v.personaggioId) ?? 4;
        const { top, left } = posizioneCasella(slot, dim);
        return (
          <div
            key={v.personaggioId}
            style={{ position: "absolute", top, left, zIndex: slot === 4 ? 1 : 0 }}
          >
            <Cerchietto
              src={risolviAsset(folderPath, v.imgPath)}
              colore={v.colore}
              crop={v.crop}
              dimensione={dim}
              alt={v.nome}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function ScenaVoti({ snapshot, folderPath, sfondoSrc }: Props) {
  const { w, h } = useViewport();

  // Giocatori (riga in alto) e NPC (riga landscape in basso, se votabile).
  const players = snapshot.righe.filter((r) => !r.isNpc);
  const npcRiga = snapshot.righe.find((r) => r.isNpc) ?? null;

  const numChars = players.length || 1;
  const npcPresente = !!npcRiga;

  // Gap tra colonne: pochi pixel dinamici; il padding interno è ridotto per compensare.
  const gapPx = Math.max(8, Math.floor(w * 0.008));
  // colWidth esclude i gap così il totale resta dentro il 90% della larghezza
  const colWidth = Math.floor((w * 0.9 - (numChars - 1) * gapPx) / numChars);
  // Quando l'NPC è visibile, i giocatori vengono rimpiccioliti (h*0.21 vs h*0.26)
  // per garantire che la barra NPC in basso non si sovrapponga mai ai giocatori.
  // Verifica matematica: con h=1080, playerH≈642px, NPC top≈766px → 124px di margine.
  const dimMaxH = npcPresente ? Math.floor(h * 0.21) : Math.floor(h * 0.26);
  const dimTarget = Math.min(Math.floor(colWidth * 0.87), dimMaxH);
  // Cerchietti votanti
  const dimVotante = Math.max(Math.floor(dimTarget * 0.42), 20);
  const voterAreaH = dimVotante * 2 + 8;
  // Manette
  const manetteSize = Math.max(Math.floor(dimTarget * 0.52), 40);
  const manetteGap = npcPresente ? 4 : 8;

  // Font base aumentato (0.25 vs 0.19) perché il padding ridotto "libera" spazio al testo
  const nameFontSizeBase = Math.max(Math.floor(dimTarget * 0.25), 11);
  const nameFontSizeMax = Math.floor((colWidth * 0.88) / 0.6);

  // Font size uguale per tutti: prende il minimo adattivo tra tutti i nomi
  const nomeFontSize = players.reduce((minSz, r) => {
    const fitted = Math.max(
      Math.min(nameFontSizeBase, Math.floor(nameFontSizeMax / Math.max(1, r.target.nome.length))),
      8,
    );
    return Math.min(minSz, fitted);
  }, nameFontSizeBase);

  const nomeH = Math.ceil(nameFontSizeBase * 1.2);

  // Max voti su TUTTE le righe (giocatori + NPC): determina chi è "il più votato".
  const maxVoti = Math.max(...snapshot.righe.map((r) => r.votanti.length), 0);

  // Riga NPC: cerchietto più piccolo per far stare la barra dentro lo spazio rimasto.
  const dimNpc = Math.min(dimTarget, Math.floor(h * 0.16));
  const dimVotanteNpc = Math.max(Math.floor(dimNpc * 0.42), 20);
  const manetteNpcSize = Math.max(Math.floor(dimNpc * 0.55), 40);

  function renderColonnaPlayer(r: RigaVotiSnap) {
    const isTop = maxVoti > 0 && r.votanti.length === maxVoti;
    return (
      <div
        key={r.target.personaggioId}
        className={`${styles.colonnaPersonaggio} ${isTop ? styles.colonnaTop : ""}`}
        style={{ width: colWidth, minWidth: colWidth, boxSizing: "border-box" }}
      >
        {/* Manette: sempre nel DOM a dimensione fissa, invisible se non top */}
        <span
          className={styles.manette}
          style={{ visibility: isTop ? "visible" : "hidden", height: manetteSize + manetteGap }}
        >
          <IconaManette dimensione={manetteSize} />
        </span>

        <Cerchietto
          src={risolviAsset(folderPath, r.target.imgPath)}
          colore={r.target.colore}
          crop={r.target.crop}
          dimensione={dimTarget}
          alt={r.target.nome}
        />

        {/* Nome: font uguale per tutti i personaggi, adattato al nome più lungo */}
        <span
          className={styles.nomeTarget}
          style={{ fontSize: nomeFontSize, lineHeight: 1.2, height: nomeH }}
        >
          {r.target.nome}
        </span>

        {/* Area votanti: altezza fissa */}
        <div className={styles.areaVotanti} style={{ minHeight: voterAreaH }}>
          <GrigliaVotanti votanti={r.votanti} folderPath={folderPath} dim={dimVotante} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {sfondoSrc && <img src={sfondoSrc} className={styles.sfondo} alt="" aria-hidden="true" />}
      {/* Velo scuro per leggibilità, come nella schermata countdown */}
      <div className={styles.overlay} aria-hidden="true" />
      <div className={`${styles.contenuto} ${npcRiga ? styles.contenutoConNpc : ""}`}>
        <div className={styles.rigaPersonaggi} style={{ gap: gapPx }}>
          {players.map(renderColonnaPlayer)}
        </div>
      </div>

      {/* Riga NPC: "landscape", entra dal basso. Manette a sinistra, voti a destra. */}
      {npcRiga &&
        (() => {
          const isTop = maxVoti > 0 && npcRiga.votanti.length === maxVoti;
          return (
            <div className={`${styles.npcRiga} ${isTop ? styles.npcRigaTop : ""}`}>
              {/* Manette a SINISTRA (sempre nel DOM, visibili solo se top) */}
              <span
                className={styles.manetteNpc}
                style={{ visibility: isTop ? "visible" : "hidden", width: manetteNpcSize }}
              >
                <IconaManette dimensione={manetteNpcSize} />
              </span>

              <div className={styles.npcTarget}>
                <Cerchietto
                  src={risolviAsset(folderPath, npcRiga.target.imgPath)}
                  colore={npcRiga.target.colore}
                  crop={npcRiga.target.crop}
                  dimensione={dimNpc}
                  npc
                  alt={npcRiga.target.nome}
                />
                <span
                  className={styles.nomeTargetNpc}
                  style={{ fontSize: nomeFontSize, lineHeight: 1.2 }}
                >
                  {npcRiga.target.nome}
                </span>
              </div>

              {/* Voti a DESTRA */}
              <div className={styles.votantiNpc}>
                <GrigliaVotanti
                  votanti={npcRiga.votanti}
                  folderPath={folderPath}
                  dim={dimVotanteNpc}
                />
              </div>
            </div>
          );
        })()}
    </div>
  );
}
