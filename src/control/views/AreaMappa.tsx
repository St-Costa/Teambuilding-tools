import { useEffect, useRef, useState } from "react";
import { useAmbientazioneStore } from "../../state/ambientazioneStore";
import { risolviAsset } from "../../lib/storage";
import { clamp01 } from "../../lib/scena";
import Cerchietto from "../../components/Cerchietto";
import styles from "./AreaMappa.module.css";

const DIM_CERCHIETTO = 68;

export default function AreaMappa() {
  const current = useAmbientazioneStore((s) => s.current);
  const folderPath = useAmbientazioneStore((s) => s.folderPath);
  const selezionatoId = useAmbientazioneStore((s) => s.selezionatoId);
  const seleziona = useAmbientazioneStore((s) => s.selezionaPersonaggio);
  const sposta = useAmbientazioneStore((s) => s.spostaPersonaggio);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgDim, setImgDim] = useState<{ w: number; h: number } | null>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setImgDim(null);
  }, [current?.mappaPath]);

  if (!current || !folderPath) return null;

  if (!current.mappaPath) {
    return (
      <main className={styles.placeholder}>
        <p>Nessuna mappa impostata.</p>
        <p className={styles.placeholderHint}>
          Usa "Imposta mappa…" nella barra in alto per caricare un'immagine.
        </p>
      </main>
    );
  }

  const mappaUrl = risolviAsset(folderPath, current.mappaPath);

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

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!imgDim) return;
    seleziona(id);
    const personaggio = current!.personaggi.find((p) => p.id === id);
    if (!personaggio) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const centroX = rect.left + personaggio.posizione.x * rect.width;
    const centroY = rect.top + personaggio.posizione.y * rect.height;
    dragRef.current = {
      id,
      offsetX: e.clientX - centroX,
      offsetY: e.clientY - centroY,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - dragRef.current.offsetX - rect.left) / rect.width;
    const y = (e.clientY - dragRef.current.offsetY - rect.top) / rect.height;
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
    <main className={styles.root} onClick={() => seleziona(null)}>
      <div className={styles.scroll}>
        <div className={styles.contenitore}>
          <img
            ref={imgRef}
            src={mappaUrl}
            alt="Mappa"
            className={styles.mappa}
            onLoad={handleImgLoad}
            draggable={false}
          />
          {imgDim &&
            current.personaggi.map((p) => (
              <div
                key={p.id}
                className={styles.cerchiettoWrap}
                style={{
                  left: `${p.posizione.x * 100}%`,
                  top: `${p.posizione.y * 100}%`,
                }}
                onPointerDown={(e) => handlePointerDown(e, p.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={(e) => e.stopPropagation()}
                title={p.nome}
              >
                <Cerchietto
                  src={risolviAsset(folderPath, p.imgPath)}
                  colore={p.colore}
                  crop={p.crop}
                  dimensione={DIM_CERCHIETTO}
                  selezionato={selezionatoId === p.id}
                  alt={p.nome}
                />
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}
