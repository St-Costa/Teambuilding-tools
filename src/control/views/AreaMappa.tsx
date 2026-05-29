import { useEffect, useRef, useState } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { risolviAsset } from "../../lib/storage";
import { clamp01, rettangoloContain } from "../../lib/scena";
import Cerchietto from "../../components/Cerchietto";
import Quadratino from "../../components/Quadratino";
import { oggettoDi } from "../../lib/ambientazione";
import styles from "./AreaMappa.module.css";

const DIM_CERCHIETTO = 102;
const DIM_QUADRATINO = Math.round(DIM_CERCHIETTO * 0.8);
const CENTRO_CERCHIETTO = DIM_CERCHIETTO / 2;
// Il quadratino in basso-a-destra del cerchietto con leggera sovrapposizione.
const OFFSET_DIAG =
  0.9 * CENTRO_CERCHIETTO * Math.SQRT1_2 + DIM_QUADRATINO / 2;

export default function AreaMappa() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const selezionatoId = useAmbientazioneStore((s) => s.selezionatoId);
  const seleziona = useAmbientazioneStore((s) => s.selezionaPersonaggio);
  const sposta = useAmbientazioneStore((s) => s.spostaPersonaggio);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [container, setContainer] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [imgDim, setImgDim] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setContainer({ w: r.width, h: r.height });
    });
    ro.observe(el);
    setContainer({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setImgDim(null);
  }, [current?.mappaPath]);

  useEffect(() => {
    if (imgDim) return;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImgDim({ w: img.naturalWidth, h: img.naturalHeight });
    }
  });

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

  const mappaUrl = risolviAsset(folderPath, current.mappaPath);
  const rett = imgDim
    ? rettangoloContain(imgDim.w, imgDim.h, container.w, container.h)
    : null;

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

  return (
    <main className={styles.root} ref={containerRef} onClick={() => seleziona(null)}>
      <img
        ref={imgRef}
        src={mappaUrl}
        alt="Mappa"
        className={styles.mappa}
        onLoad={handleImgLoad}
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
                dimensione={DIM_CERCHIETTO}
                selezionato={selezionatoId === p.id}
                alt={p.nome}
              />
              {oggetto && (
                <div
                  className={styles.quadratinoWrap}
                  style={{
                    left: `${CENTRO_CERCHIETTO + OFFSET_DIAG - 10}px`,
                    top: `${CENTRO_CERCHIETTO + OFFSET_DIAG - 10}px`,
                  }}
                >
                  <Quadratino
                    src={risolviAsset(folderPath, oggetto.imgPath)}
                    crop={oggetto.crop}
                    dimensione={DIM_QUADRATINO}
                    coloreBordo={p.colore}
                    alt={oggetto.nome}
                  />
                </div>
              )}
            </div>
          );
        })}
    </main>
  );
}
