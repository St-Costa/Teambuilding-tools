import { useRef } from "react";
import type { Crop } from "../../lib/ambientazione";
import styles from "./MaschereCircolare.module.css";

interface Props {
  src: string;
  colore: string;
  crop: Crop;
  onChange: (crop: Crop) => void;
  dimensione?: number;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 10;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function maxOffset(zoom: number): number {
  return Math.max(1, (zoom - 1) / 2 + 0.5);
}

function clampOffset(o: number, zoom: number): number {
  const max = maxOffset(zoom);
  return Math.min(max, Math.max(-max, o));
}

export default function MaschereCircolare({
  src,
  colore,
  crop,
  onChange,
  dimensione = 260,
}: Props) {
  const dragRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startOffsetX: crop.offsetX,
      startOffsetY: crop.offsetY,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startMouseX) / dimensione;
    const dy = (e.clientY - dragRef.current.startMouseY) / dimensione;
    onChange({
      ...crop,
      offsetX: clampOffset(dragRef.current.startOffsetX + dx, crop.zoom),
      offsetY: clampOffset(dragRef.current.startOffsetY + dy, crop.zoom),
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const fattore = e.deltaY < 0 ? 1.1 : 0.9;
    const nuovoZoom = clampZoom(crop.zoom * fattore);
    onChange({
      zoom: nuovoZoom,
      offsetX: clampOffset(crop.offsetX, nuovoZoom),
      offsetY: clampOffset(crop.offsetY, nuovoZoom),
    });
  }

  function reset() {
    onChange({ zoom: 1, offsetX: 0, offsetY: 0 });
  }

  return (
    <div className={styles.root}>
      <div
        className={styles.mask}
        style={{
          width: dimensione,
          height: dimensione,
          borderColor: colore,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className={styles.img}
          style={{
            transform: `translate(${crop.offsetX * 100}%, ${crop.offsetY * 100}%) scale(${crop.zoom})`,
          }}
        />
      </div>
      <div className={styles.controlli}>
        <label className={styles.slider}>
          <span>Zoom</span>
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.05}
            value={crop.zoom}
            onChange={(e) => {
              const z = clampZoom(Number(e.target.value));
              onChange({
                zoom: z,
                offsetX: clampOffset(crop.offsetX, z),
                offsetY: clampOffset(crop.offsetY, z),
              });
            }}
          />
          <span className={styles.valoreZoom}>{crop.zoom.toFixed(2)}×</span>
        </label>
        <button type="button" className={styles.btnReset} onClick={reset}>
          Ricomincia
        </button>
      </div>
      <p className={styles.suggerimento}>
        Trascina l'immagine per spostarla, usa la rotellina del mouse o lo slider per
        ingrandire o rimpicciolire.
      </p>
    </div>
  );
}
