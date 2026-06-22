import { useLayoutEffect, useRef, useState } from "react";
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

// Slot del "5 dei dadi" su griglia 3×3 (riga, colonna 0-based):
// 0..3 = i quattro angoli (slot "ancora", stabili), 4 = il centro (la 5ª pedina,
// quella che va sopra le altre quattro lasciandole ferme).
const SLOT_RC: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, 2],
  [2, 0],
  [2, 2],
  [1, 1],
];
const CORNERS = [0, 1, 2, 3];
const CENTER = 4;
const GAP_DADO = 4;

// Assegna a ogni votante (per id) uno slot del dado, partendo dall'assegnazione
// precedente, così da MINIMIZZARE i movimenti tra un voto e l'altro:
// - i quattro angoli sono slot "ancora": chi li occupa non si sposta;
// - il centro è lo slot "di troppo" (la 5ª pedina);
// - se un angolo si libera mentre il centro è occupato, la pedina centrale
//   scivola in quell'angolo (un solo movimento);
// - togliendo proprio la pedina centrale, le altre quattro restano ferme.
function assegnaSlot(prev: Record<string, number>, voters: string[]): Record<string, number> {
  const next: Record<string, number> = {};
  // 1) mantiene gli slot dei votanti ancora presenti
  for (const v of voters) if (prev[v] !== undefined) next[v] = prev[v];
  const occupati = new Set(Object.values(next));
  // 2) compattazione: se il centro è occupato e c'è un angolo libero, la pedina
  //    centrale prende quell'angolo (es. dopo aver tolto un voto d'angolo).
  const pedinaCentrale = voters.find((v) => next[v] === CENTER);
  if (pedinaCentrale !== undefined) {
    const angoloLibero = CORNERS.find((c) => !occupati.has(c));
    if (angoloLibero !== undefined) {
      occupati.delete(CENTER);
      next[pedinaCentrale] = angoloLibero;
      occupati.add(angoloLibero);
    }
  }
  // 3) nuovi votanti (in ordine d'arrivo): prima gli angoli, poi il centro
  for (const v of voters) {
    if (next[v] !== undefined) continue;
    const angoloLibero = CORNERS.find((c) => !occupati.has(c));
    if (angoloLibero !== undefined) {
      next[v] = angoloLibero;
      occupati.add(angoloLibero);
    } else {
      next[v] = CENTER;
      occupati.add(CENTER);
    }
  }
  return next;
}

// Disposizione "dado" (4 o 5 voti): i votanti sono posizionati in modo assoluto
// sugli slot, con transizione sul transform così i pochi movimenti necessari
// (es. la pedina centrale che scende in un angolo) sono animati.
function VotantiDado({
  votanti,
  folderPath,
  dim,
}: {
  votanti: PersonaggioMiniSnap[];
  folderPath: string;
  dim: number;
}) {
  const slotRef = useRef<Record<string, number>>({});
  const ids = votanti.map((v) => v.personaggioId);
  const slots = assegnaSlot(slotRef.current, ids);
  useLayoutEffect(() => {
    slotRef.current = slots;
  });

  const pitch = dim + GAP_DADO;
  const lato = dim * 3 + GAP_DADO * 2;

  return (
    <div className={styles.dado} style={{ width: lato, height: lato }}>
      {votanti.map((v) => {
        const slot = slots[v.personaggioId] ?? 0;
        const [r, c] = SLOT_RC[slot];
        return (
          <div
            key={v.personaggioId}
            className={styles.dadoCella}
            style={{
              width: dim,
              height: dim,
              transform: `translate(${c * pitch}px, ${r * pitch}px)`,
              zIndex: slot === CENTER ? 2 : 1,
            }}
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

// Griglia dei votanti: fino a 3 voti layout compatto a 2 colonne; con 4 o 5
// voti diventa il "dado" (4 angoli + eventuale centro).
function GrigliaVotanti({
  votanti,
  folderPath,
  dim,
}: {
  votanti: PersonaggioMiniSnap[];
  folderPath: string;
  dim: number;
}) {
  if (votanti.length >= 4) {
    return <VotantiDado votanti={votanti} folderPath={folderPath} dim={dim} />;
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

  // Gap tra colonne: pochi pixel dinamici; il padding interno è ridotto per compensare.
  const gapPx = Math.max(8, Math.floor(w * 0.008));
  // colWidth esclude i gap così il totale resta dentro il 90% della larghezza
  const colWidth = Math.floor((w * 0.90 - (numChars - 1) * gapPx) / numChars);
  // Cerchietto principale. Quando c'è l'NPC riserviamo più spazio in verticale
  // (l'NPC ora ha la stessa taglia dei giocatori), quindi riduciamo il limite.
  const dimTarget = Math.min(
    Math.floor(colWidth * 0.87),
    Math.floor(h * (npcRiga ? 0.20 : 0.30)),
  );

  // Padding interno dei rettangoli personaggio: lascia "respirare" i voti
  // rispetto ai bordi del rettangolo.
  const padColonna = Math.max(10, Math.round(colWidth * 0.07));

  // Cerchietti votanti: dimensionati anche per far stare 3 in fila (dado)
  // dentro la colonna, con il padding interno.
  const dimVotante = Math.max(
    20,
    Math.min(
      Math.floor(dimTarget * 0.42),
      Math.floor((colWidth - 2 * padColonna - 2 * GAP_DADO) / 3),
    ),
  );

  // Manette
  const manetteSize = Math.max(Math.floor(dimTarget * 0.52), 40);
  const manetteGap = 8;

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

  // Altezza riservata all'area votanti = righe necessarie al più votato tra i
  // giocatori (così tutte le colonne hanno la stessa altezza e restano allineate).
  const maxVotiCol = players.reduce((m, r) => Math.max(m, r.votanti.length), 0);
  const righeVoti = maxVotiCol >= 4 ? 3 : maxVotiCol === 3 ? 2 : maxVotiCol >= 1 ? 1 : 0;
  const voterAreaH = righeVoti > 0 ? dimVotante * righeVoti + GAP_DADO * (righeVoti - 1) : 0;

  // Max voti su TUTTE le righe (giocatori + NPC): determina chi è "il più votato".
  const maxVoti = Math.max(...snapshot.righe.map((r) => r.votanti.length), 0);

  // NPC della stessa taglia dei giocatori (personaggio, voti e manette).
  const dimNpc = dimTarget;
  const dimVotanteNpc = dimVotante;
  const manetteNpcSize = manetteSize;

  // ── Posizionamento verticale animato ──
  // Blocco giocatori (in alto) e blocco NPC (in basso) sono posizionati in modo
  // assoluto e centrati come gruppo: misuriamo le loro altezze per calcolare gli
  // offset, così il padding dai bordi schermo (sopra/sotto) resta uguale e lo
  // spostamento dei giocatori verso l'alto (all'ingresso dell'NPC) è animato.
  const playersRef = useRef<HTMLDivElement>(null);
  const npcRef = useRef<HTMLDivElement>(null);
  const [misure, setMisure] = useState({ hp: 0, hn: 0 });
  useLayoutEffect(() => {
    const hp = playersRef.current?.offsetHeight ?? 0;
    const hn = npcRef.current?.offsetHeight ?? 0;
    setMisure((m) => (m.hp === hp && m.hn === hn ? m : { hp, hn }));
  });

  const gapVert = Math.max(16, Math.round(Math.min(w, h) * 0.03));
  // Centro del gruppo = centro schermo: i giocatori salgono di mezza altezza NPC
  // + mezzo gap, l'NPC scende di mezza altezza giocatori + mezzo gap.
  const offsetPlayers = npcRiga ? -((misure.hn + gapVert) / 2) : 0;
  const offsetNpc = (misure.hp + gapVert) / 2;

  function renderColonnaPlayer(r: RigaVotiSnap) {
    const isTop = maxVoti > 0 && r.votanti.length === maxVoti;
    return (
      <div
        key={r.target.personaggioId}
        className={`${styles.colonnaPersonaggio} ${isTop ? styles.colonnaTop : ""}`}
        style={{
          width: colWidth,
          minWidth: colWidth,
          boxSizing: "border-box",
          padding: `${Math.round(padColonna * 0.7)}px ${padColonna}px`,
        }}
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

  const npcIsTop = npcRiga ? maxVoti > 0 && npcRiga.votanti.length === maxVoti : false;

  return (
    <div className={styles.root}>
      {sfondoSrc && (
        <img src={sfondoSrc} className={styles.sfondo} alt="" aria-hidden="true" />
      )}
      {/* Velo scuro per leggibilità, come nella schermata countdown */}
      <div className={styles.overlay} aria-hidden="true" />

      <div className={styles.contenuto}>
        {/* Blocco giocatori: centrato come gruppo, scivola in alto se entra l'NPC */}
        <div
          ref={playersRef}
          className={styles.bloccoPersonaggi}
          style={{ gap: gapPx, transform: `translate(-50%, calc(-50% + ${offsetPlayers}px))` }}
        >
          {players.map(renderColonnaPlayer)}
        </div>

        {/* Blocco NPC: entra dal basso (animazione) e si posiziona sotto i giocatori */}
        {npcRiga && (
          <div
            ref={npcRef}
            className={styles.bloccoNpc}
            style={{ transform: `translate(-50%, calc(-50% + ${offsetNpc}px))` }}
          >
            <div className={`${styles.npcRiga} ${npcIsTop ? styles.npcRigaTop : ""}`}>
              {/* Manette a SINISTRA (sempre nel DOM, visibili solo se top) */}
              <span
                className={styles.manetteNpc}
                style={{ visibility: npcIsTop ? "visible" : "hidden", width: manetteNpcSize }}
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
          </div>
        )}
      </div>
    </div>
  );
}
