import { useEffect, useRef, useState } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { risolviAsset } from "../../lib/storage";
import {
  clamp01,
  dimensioneCerchietto,
  fontSizeAnnotazione,
  RAPPORTO_QUADRATINO,
  RIENTRO_QUADRATINO,
  rettangoloContain,
} from "../../lib/scena";
import Cerchietto from "../../components/Cerchietto";
import Quadratino from "../../components/Quadratino";
import AnnotazioneView from "../../components/Annotazione";
import ChatMomenti from "./ChatMomenti";
import { oggettoDi } from "../../lib/ambientazione";
import styles from "./AreaMappa.module.css";

export default function AreaMappa() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const selezionatoId = useAmbientazioneStore((s) => s.selezionatoId);
  const seleziona = useAmbientazioneStore((s) => s.selezionaPersonaggio);
  const sposta = useAmbientazioneStore((s) => s.spostaPersonaggio);
  const annotazioneSelezionataId = useAmbientazioneStore((s) => s.annotazioneSelezionataId);
  const annotazioneInModificaId = useAmbientazioneStore((s) => s.annotazioneInModificaId);
  const selezionaAnn = useAmbientazioneStore((s) => s.selezionaAnnotazione);
  const setInModifica = useAmbientazioneStore((s) => s.setAnnotazioneInModifica);
  const spostaAnn = useAmbientazioneStore((s) => s.spostaAnnotazione);
  const ridimensionaAnn = useAmbientazioneStore((s) => s.ridimensionaAnnotazione);
  const ruotaAnn = useAmbientazioneStore((s) => s.ruotaAnnotazione);
  const modificaTestoAnn = useAmbientazioneStore((s) => s.modificaTestoAnnotazione);
  const eliminaAnn = useAmbientazioneStore((s) => s.eliminaAnnotazione);

  // Bozza locale del testo in modifica inline: si scrive qui e si committa solo
  // all'uscita (blur/Escape), così non finiscono stati intermedi vuoti nel
  // manifest (che li boccerebbe al caricamento).
  const [bozza, setBozza] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [container, setContainer] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [imgDim, setImgDim] = useState<{ w: number; h: number } | null>(null);
  const [mappaErrore, setMappaErrore] = useState(false);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPos = useRef<{ x: number; y: number } | null>(null);
  // Drag (spostamento) di un'annotazione.
  const dragAnnRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const pendingAnnPos = useRef<{ x: number; y: number } | null>(null);
  const rafAnnRef = useRef<number | null>(null);
  // Resize (ridimensionamento uniforme dal centro) di un'annotazione.
  const resizeRef = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    startDist: number;
    startDimensione: number;
  } | null>(null);
  const pendingDim = useRef<number | null>(null);
  const rafDimRef = useRef<number | null>(null);
  // Rotazione di un'annotazione (maniglia in alto, stile Canva).
  const rotateRef = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    startAngolo: number; // angolo puntatore↔centro all'inizio (gradi)
    startRotazione: number; // rotazione dell'annotazione all'inizio
  } | null>(null);
  const pendingRot = useRef<number | null>(null);
  const rafRotRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const cb = (entries?: ResizeObserverEntry[]) => {
      const r = entries?.[0]?.contentRect ?? el.getBoundingClientRect();
      setContainer({ w: r.width, h: r.height });
    };
    setContainer({ w: el.clientWidth, h: el.clientHeight });
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(cb);
      ro.observe(el);
      return () => ro.disconnect();
    }
    const onResize = () => cb();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setImgDim(null);
    setMappaErrore(false);
  }, [current?.mappaPath]);

  useEffect(() => {
    if (imgDim) return;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImgDim({ w: img.naturalWidth, h: img.naturalHeight });
    }
  });

  // Entrando in modifica inline: inizializza la bozza col testo corrente e dà il
  // focus alla textarea, selezionando tutto (così si può sovrascrivere "Testo").
  useEffect(() => {
    if (!annotazioneInModificaId) return;
    const ann = current?.annotazioni.find((a) => a.id === annotazioneInModificaId);
    if (!ann) return;
    setBozza(ann.contenuto);
    // focus dopo il mount della textarea
    const t = window.setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.select();
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [annotazioneInModificaId]);

  // Tasto Canc/Backspace: elimina l'annotazione SELEZIONATA, ma solo se non si
  // sta modificando un testo (in quel caso il tasto cancella un carattere) e il
  // focus non è in un campo di input.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (annotazioneInModificaId) return; // sto editando: lascia gestire al campo
      const sel = annotazioneSelezionataId;
      if (!sel) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) {
        return; // il focus è in un campo editabile altrove
      }
      e.preventDefault();
      eliminaAnn(sel);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [annotazioneSelezionataId, annotazioneInModificaId, eliminaAnn]);

  if (!current || !folderPath) return null;

  if (!current.mappaPath) {
    return (
      <main className={styles.placeholder} ref={containerRef}>
        <p>Nessuna mappa impostata.</p>
        <p className={styles.placeholderHint}>
          Usa "Imposta mappa…" nella barra in alto per caricare un'immagine.
        </p>
      </main>
    );
  }

  if (mappaErrore) {
    return (
      <main className={styles.placeholder} ref={containerRef}>
        <p>Immagine della mappa non trovata.</p>
        <p className={styles.placeholderHint}>
          Il file potrebbe essere stato spostato o eliminato. Reimposta la mappa dalla barra in
          alto.
        </p>
      </main>
    );
  }

  const mappaUrl = risolviAsset(folderPath, current.mappaPath);
  const rett = imgDim ? rettangoloContain(imgDim.w, imgDim.h, container.w, container.h) : null;

  // Dimensioni scalate sulla mappa renderizzata, IDENTICHE alla proiezione
  // (stessa frazione in lib/scena) → stessa dimensione relativa alla mappa.
  const dimCerchietto = rett ? dimensioneCerchietto(rett) : 0;
  const dimQuadratino = Math.round(dimCerchietto * RAPPORTO_QUADRATINO);
  const centroCerchietto = dimCerchietto / 2;
  const offsetDiag = 0.9 * centroCerchietto * Math.SQRT1_2 + dimQuadratino / 2;
  const rientro = dimCerchietto * RIENTRO_QUADRATINO;

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    setImgDim({ w: img.naturalWidth, h: img.naturalHeight });
  }

  function flushPendingMove() {
    if (!dragRef.current || !pendingPos.current) {
      rafRef.current = null;
      return;
    }
    const { id } = dragRef.current;
    const { x, y } = pendingPos.current;
    pendingPos.current = null;
    sposta(id, { x, y });
    rafRef.current = null;
  }

  function rettInScreen() {
    // Rettangolo dell'immagine renderizzata in coordinate viewport, calcolato
    // dal container + object-fit contain.
    const cont = containerRef.current;
    if (!cont || !rett) return null;
    const contRect = cont.getBoundingClientRect();
    return {
      left: contRect.left + rett.offsetX,
      top: contRect.top + rett.offsetY,
      width: rett.larghezza,
      height: rett.altezza,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!rett) return;
    seleziona(id);
    const personaggio = current!.personaggi.find((p) => p.id === id);
    if (!personaggio) return;
    const screen = rettInScreen();
    if (!screen) return;
    const centroX = screen.left + personaggio.posizione.x * screen.width;
    const centroY = screen.top + personaggio.posizione.y * screen.height;
    dragRef.current = {
      id,
      offsetX: e.clientX - centroX,
      offsetY: e.clientY - centroY,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const screen = rettInScreen();
    if (!screen) return;
    const x = (e.clientX - dragRef.current.offsetX - screen.left) / screen.width;
    const y = (e.clientY - dragRef.current.offsetY - screen.top) / screen.height;
    pendingPos.current = { x: clamp01(x), y: clamp01(y) };
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPendingMove);
    }
  }

  function handlePointerUp() {
    if (dragRef.current && pendingPos.current) {
      flushPendingMove();
    }
    dragRef.current = null;
    pendingPos.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  // --- Annotazioni: spostamento (stesso pattern dei personaggi) ---

  function flushPendingAnnMove() {
    if (!dragAnnRef.current || !pendingAnnPos.current) {
      rafAnnRef.current = null;
      return;
    }
    const { id } = dragAnnRef.current;
    const { x, y } = pendingAnnPos.current;
    pendingAnnPos.current = null;
    spostaAnn(id, { x, y });
    rafAnnRef.current = null;
  }

  function handleAnnPointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!rett) return;
    selezionaAnn(id);
    const ann = current!.annotazioni.find((a) => a.id === id);
    if (!ann) return;
    const screen = rettInScreen();
    if (!screen) return;
    const centroX = screen.left + ann.posizione.x * screen.width;
    const centroY = screen.top + ann.posizione.y * screen.height;
    dragAnnRef.current = {
      id,
      offsetX: e.clientX - centroX,
      offsetY: e.clientY - centroY,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handleAnnPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragAnnRef.current) return;
    const screen = rettInScreen();
    if (!screen) return;
    const x = (e.clientX - dragAnnRef.current.offsetX - screen.left) / screen.width;
    const y = (e.clientY - dragAnnRef.current.offsetY - screen.top) / screen.height;
    pendingAnnPos.current = { x: clamp01(x), y: clamp01(y) };
    if (rafAnnRef.current === null) {
      rafAnnRef.current = requestAnimationFrame(flushPendingAnnMove);
    }
  }

  function handleAnnPointerUp() {
    if (dragAnnRef.current && pendingAnnPos.current) {
      flushPendingAnnMove();
    }
    dragAnnRef.current = null;
    pendingAnnPos.current = null;
    if (rafAnnRef.current !== null) {
      cancelAnimationFrame(rafAnnRef.current);
      rafAnnRef.current = null;
    }
  }

  // --- Annotazioni: resize uniforme dal centro tramite maniglie d'angolo ---

  function flushPendingDim() {
    if (!resizeRef.current || pendingDim.current === null) {
      rafDimRef.current = null;
      return;
    }
    const { id } = resizeRef.current;
    const dim = pendingDim.current;
    pendingDim.current = null;
    ridimensionaAnn(id, dim);
    rafDimRef.current = null;
  }

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!rett) return;
    const ann = current!.annotazioni.find((a) => a.id === id);
    if (!ann) return;
    const screen = rettInScreen();
    if (!screen) return;
    const centerX = screen.left + ann.posizione.x * screen.width;
    const centerY = screen.top + ann.posizione.y * screen.height;
    const startDist = Math.max(1, Math.hypot(e.clientX - centerX, e.clientY - centerY));
    resizeRef.current = {
      id,
      centerX,
      centerY,
      startDist,
      startDimensione: ann.dimensione,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handleResizePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current) return;
    const { centerX, centerY, startDist, startDimensione } = resizeRef.current;
    const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
    // Ridimensionamento uniforme: la nuova dimensione scala col rapporto fra la
    // distanza puntatore↔centro corrente e quella iniziale. Clamp nello store.
    pendingDim.current = startDimensione * (dist / startDist);
    if (rafDimRef.current === null) {
      rafDimRef.current = requestAnimationFrame(flushPendingDim);
    }
  }

  function handleResizePointerUp() {
    if (resizeRef.current && pendingDim.current !== null) {
      flushPendingDim();
    }
    resizeRef.current = null;
    pendingDim.current = null;
    if (rafDimRef.current !== null) {
      cancelAnimationFrame(rafDimRef.current);
      rafDimRef.current = null;
    }
  }

  // --- Annotazioni: rotazione tramite maniglia in alto (stile Canva) ---

  function flushPendingRot() {
    if (!rotateRef.current || pendingRot.current === null) {
      rafRotRef.current = null;
      return;
    }
    const { id } = rotateRef.current;
    const rot = pendingRot.current;
    pendingRot.current = null;
    ruotaAnn(id, rot);
    rafRotRef.current = null;
  }

  function handleRotatePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!rett) return;
    const ann = current!.annotazioni.find((a) => a.id === id);
    if (!ann) return;
    const screen = rettInScreen();
    if (!screen) return;
    const centerX = screen.left + ann.posizione.x * screen.width;
    const centerY = screen.top + ann.posizione.y * screen.height;
    // atan2 in gradi dell'asse puntatore↔centro. La maniglia parte in alto
    // (−90°): sottraendolo, trascinare la maniglia ovunque mappa 1:1 sull'angolo
    // dell'annotazione partendo dalla sua rotazione corrente.
    const startAngolo = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
    rotateRef.current = {
      id,
      centerX,
      centerY,
      startAngolo,
      startRotazione: ann.rotazione,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handleRotatePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!rotateRef.current) return;
    const { centerX, centerY, startAngolo, startRotazione } = rotateRef.current;
    const angolo = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;
    let rot = startRotazione + (angolo - startAngolo);
    // Scatto a multipli di 15° tenendo premuto Shift (come Canva).
    if (e.shiftKey) rot = Math.round(rot / 15) * 15;
    pendingRot.current = rot;
    if (rafRotRef.current === null) {
      rafRotRef.current = requestAnimationFrame(flushPendingRot);
    }
  }

  function handleRotatePointerUp() {
    if (rotateRef.current && pendingRot.current !== null) {
      flushPendingRot();
    }
    rotateRef.current = null;
    pendingRot.current = null;
    if (rafRotRef.current !== null) {
      cancelAnimationFrame(rafRotRef.current);
      rafRotRef.current = null;
    }
  }

  // Conclude la modifica inline del testo: se vuoto elimina l'annotazione (un
  // campo di testo vuoto non avrebbe senso e non è salvabile), altrimenti salva.
  function concludiModificaTesto() {
    const id = annotazioneInModificaId;
    if (!id) return;
    if (bozza.trim() === "") {
      eliminaAnn(id);
    } else {
      modificaTestoAnn(id, bozza);
    }
    setInModifica(null);
  }

  return (
    <main
      className={styles.root}
      ref={containerRef}
      onClick={() => {
        seleziona(null);
        selezionaAnn(null);
      }}
    >
      <img
        ref={imgRef}
        src={mappaUrl}
        alt="Mappa"
        className={styles.mappa}
        onLoad={handleImgLoad}
        onError={() => setMappaErrore(true)}
        draggable={false}
      />
      {rett &&
        current.personaggi.map((p) => {
          const oggetto = oggettoDi(p, current!.oggetti);
          return (
            <div
              key={p.id}
              className={styles.cerchiettoWrap}
              style={{
                left: rett.offsetX + p.posizione.x * rett.larghezza,
                top: rett.offsetY + p.posizione.y * rett.altezza,
              }}
              onPointerDown={(e) => handlePointerDown(e, p.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onClick={(e) => e.stopPropagation()}
              title={oggetto ? `${p.nome} (${oggetto.nome})` : p.nome}
            >
              <Cerchietto
                src={risolviAsset(folderPath, p.imgPath)}
                colore={p.colore}
                crop={p.crop}
                dimensione={dimCerchietto}
                selezionato={selezionatoId === p.id}
                npc={p.npc}
                alt={p.nome}
              />
              {oggetto && (
                <div
                  className={styles.quadratinoWrap}
                  style={{
                    left: `${centroCerchietto + offsetDiag - rientro}px`,
                    top: `${centroCerchietto + offsetDiag - rientro}px`,
                  }}
                >
                  <Quadratino
                    src={risolviAsset(folderPath, oggetto.imgPath)}
                    crop={oggetto.crop}
                    dimensione={dimQuadratino}
                    coloreBordo={p.colore}
                    alt={oggetto.nome}
                  />
                </div>
              )}
            </div>
          );
        })}
      {rett &&
        current.annotazioni.map((a) => {
          const selezionata = annotazioneSelezionataId === a.id;
          const inModifica = annotazioneInModificaId === a.id && a.tipo === "testo";
          const latoMaggiore = Math.max(rett.larghezza, rett.altezza);
          const wrapClass = `${styles.annotazioneWrap}${
            selezionata && !inModifica ? ` ${styles.annotazioneSelezionata}` : ""
          }`;
          // Handler di drag attivi solo quando NON si sta editando il testo:
          // in modifica la textarea deve ricevere i click per la selezione.
          const dragHandlers = inModifica
            ? {}
            : {
                onPointerDown: (e: React.PointerEvent<HTMLDivElement>) =>
                  handleAnnPointerDown(e, a.id),
                onPointerMove: handleAnnPointerMove,
                onPointerUp: handleAnnPointerUp,
                onPointerCancel: handleAnnPointerUp,
              };
          return (
            <div
              key={a.id}
              className={wrapClass}
              style={{
                left: rett.offsetX + a.posizione.x * rett.larghezza,
                top: rett.offsetY + a.posizione.y * rett.altezza,
                transform: `translate(-50%, -50%) rotate(${a.rotazione}deg)`,
              }}
              {...dragHandlers}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (a.tipo === "testo") setInModifica(a.id);
              }}
              title={a.tipo === "testo" ? "Doppio click per modificare il testo" : "Simbolo"}
            >
              {inModifica ? (
                <textarea
                  ref={textareaRef}
                  className={styles.editorTesto}
                  value={bozza}
                  rows={Math.max(1, bozza.split("\n").length)}
                  cols={Math.max(3, ...bozza.split("\n").map((r) => r.length))}
                  style={{ fontSize: fontSizeAnnotazione(a.dimensione, latoMaggiore) }}
                  onChange={(e) => setBozza(e.target.value)}
                  onBlur={concludiModificaTesto}
                  onKeyDown={(e) => {
                    // Invio = a-capo (default textarea). Escape = conferma ed esci.
                    if (e.key === "Escape") {
                      e.preventDefault();
                      concludiModificaTesto();
                    }
                    // Non far propagare Canc/Backspace al listener globale.
                    e.stopPropagation();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                />
              ) : (
                <AnnotazioneView annotazione={a} latoMaggiore={latoMaggiore} />
              )}
              {selezionata && !inModifica && (
                <>
                  {(["nw", "ne", "se", "sw"] as const).map((angolo) => (
                    <div
                      key={angolo}
                      className={`${styles.maniglia} ${styles[`maniglia_${angolo}`]}`}
                      onPointerDown={(e) => handleResizePointerDown(e, a.id)}
                      onPointerMove={handleResizePointerMove}
                      onPointerUp={handleResizePointerUp}
                      onPointerCancel={handleResizePointerUp}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ))}
                  {/* Maniglia di rotazione sopra al riquadro (stile Canva).
                      Shift mentre si trascina = scatti di 15°. */}
                  <div
                    className={styles.manigliaRotazione}
                    onPointerDown={(e) => handleRotatePointerDown(e, a.id)}
                    onPointerMove={handleRotatePointerMove}
                    onPointerUp={handleRotatePointerUp}
                    onPointerCancel={handleRotatePointerUp}
                    onClick={(e) => e.stopPropagation()}
                    title="Trascina per ruotare (Shift = scatti di 15°)"
                  />
                </>
              )}
            </div>
          );
        })}
      {/* Chat momenti meme: centrata sul bordo inferiore della mappa (solo regia) */}
      <ChatMomenti />
    </main>
  );
}
