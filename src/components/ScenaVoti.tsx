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

// Griglia dei votanti: layout normale a 2 colonne. Con 5 voti, la griglia
// resta 2×2 e il 5° voto è sovrapposto al centro con position:absolute così
// l'altezza occupata è identica a quella di 4 voti (niente spostamento layout).
function GrigliaVotanti({
  votanti,
  folderPath,
  dim,
}: {
  votanti: PersonaggioMiniSnap[];
  folderPath: string;
  dim: number;
}) {
  if (votanti.length === 5) {
    // Griglia 2×2 + 5° voto centrato in assoluto: stesso ingombro di 4 voti.
    const gridSize = dim * 2 + 4;
    return (
      <div style={{ position: "relative", width: gridSize, height: gridSize, flexShrink: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(2, ${dim}px)`,
            gridTemplateRows: `repeat(2, ${dim}px)`,
            gap: "4px",
          }}
        >
          {[votanti[0], votanti[1], votanti[3], votanti[4]].map((v) => (
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
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
          }}
        >
          <Cerchietto
            src={risolviAsset(folderPath, votanti[2].imgPath)}
            colore={votanti[2].colore}
            crop={votanti[2].crop}
            dimensione={dim}
            alt={votanti[2].nome}
          />
        </div>
      </div>
    );
  }
  return (
    <div
      className={styles.rigaVotanti}
      style={{ gridTemplateColumns: `repeat(2, ${dim}px)` }}
    >
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
  const colWidth = Math.floor((w * 0.90 - (numChars - 1) * gapPx) / numChars);
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
  const nameFontSizeMax = Math.floor((colWidth * 0.88) / 0.60);

  // Font size uguale per tutti: prende il minimo adattivo tra tutti i nomi
  const nomeFontSize = players.reduce((minSz, r) => {
    const fitted = Math.max(
      Math.min(nameFontSizeBase, Math.floor(nameFontSizeMax / Math.max(1, r.target.nome.length))),
      8
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
      {sfondoSrc && (
        <img src={sfondoSrc} className={styles.sfondo} alt="" aria-hidden="true" />
      )}
      {/* Velo scuro per leggibilità, come nella schermata countdown */}
      <div className={styles.overlay} aria-hidden="true" />
      <div className={`${styles.contenuto} ${npcRiga ? styles.contenutoConNpc : ""}`}>
        <div className={styles.rigaPersonaggi} style={{ gap: gapPx }}>
          {players.map(renderColonnaPlayer)}
        </div>
      </div>

      {/* Riga NPC: "landscape", entra dal basso. Manette a sinistra, voti a destra. */}
      {npcRiga && (
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
        })()
      )}
    </div>
  );
}
