import { useEffect, useRef, useState } from "react";
import type { Personaggio } from "../lib/ambientazione";
import { risolviAsset } from "../lib/storage";
import { rettangoloContain } from "../lib/scena";
import Cerchietto from "./Cerchietto";
import styles from "./Scena.module.css";

interface Props {
  folderPath: string | null;
  mappaPath: string | null;
  personaggi: Personaggio[];
  nome: string | null;
}

const DIM_CERCHIETTO = 77;

export default function Scena({ folderPath, mappaPath, personaggi, nome }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [container, setContainer] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [imgDim, setImgDim] = useState<{ w: number; h: number } | null>(null);

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
  }, [mappaPath]);

  if (!folderPath || !mappaPath) {
    return (
      <div className={styles.root} ref={containerRef}>
        <div className={styles.placeholder}>{nome ?? "—"}</div>
      </div>
    );
  }

  const rett = imgDim
    ? rettangoloContain(imgDim.w, imgDim.h, container.w, container.h)
    : null;

  return (
    <div className={styles.root} ref={containerRef}>
      <img
        ref={imgRef}
        src={risolviAsset(folderPath, mappaPath)}
        alt=""
        className={styles.mappa}
        onLoad={(e) => {
          const t = e.currentTarget;
          setImgDim({ w: t.naturalWidth, h: t.naturalHeight });
        }}
        draggable={false}
      />
      {rett &&
        personaggi.map((p) => (
          <div
            key={p.id}
            className={styles.cerchiettoWrap}
            style={{
              left: rett.offsetX + p.posizione.x * rett.larghezza,
              top: rett.offsetY + p.posizione.y * rett.altezza,
            }}
          >
            <Cerchietto
              src={risolviAsset(folderPath, p.imgPath)}
              colore={p.colore}
              crop={p.crop}
              dimensione={DIM_CERCHIETTO}
              alt={p.nome}
            />
          </div>
        ))}
    </div>
  );
}
