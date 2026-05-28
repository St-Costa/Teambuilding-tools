import { useEffect, useRef, useState } from "react";
import { oggettoDi, type Oggetto, type Personaggio } from "../lib/ambientazione";
import { risolviAsset } from "../lib/storage";
import { rettangoloContain } from "../lib/scena";
import Cerchietto from "./Cerchietto";
import Quadratino from "./Quadratino";
import styles from "./Scena.module.css";

interface Props {
  folderPath: string | null;
  mappaPath: string | null;
  personaggi: Personaggio[];
  oggetti: Oggetto[];
  nome: string | null;
}

const DIM_CERCHIETTO = 116;
const DIM_QUADRATINO = Math.round(DIM_CERCHIETTO * 0.8);
const CENTRO_CERCHIETTO = DIM_CERCHIETTO / 2;
// Stessa formula di AreaMappa: quadratino in basso-a-destra con sovrapposizione
// 10% del raggio cerchietto (angolo top-left a 0.9 × raggio dal centro).
const OFFSET_DIAG =
  0.9 * CENTRO_CERCHIETTO * Math.SQRT1_2 + DIM_QUADRATINO / 2;

export default function Scena({
  folderPath,
  mappaPath,
  personaggi,
  oggetti,
  nome,
}: Props) {
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

  // Safety net: dopo ogni render, se imgDim è null ma l'img è già caricata
  // (cache, race con onLoad in fullscreen toggle, ecc.), settalo dai
  // naturalWidth/Height. Senza questo, in alcuni scenari di re-render
  // sotto overlay i personaggi non rientrano sulla mappa.
  useEffect(() => {
    if (imgDim) return;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImgDim({ w: img.naturalWidth, h: img.naturalHeight });
    }
  });

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
        personaggi.map((p) => {
          const oggetto = oggettoDi(p, oggetti);
          return (
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
                    alt={oggetto.nome}
                  />
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
