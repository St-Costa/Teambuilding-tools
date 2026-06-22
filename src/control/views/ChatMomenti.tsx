import { useRef, useState } from "react";
import { useMemeStore } from "../../state/memeStore";
import styles from "./ChatMomenti.module.css";

// Chat dei "momenti meme": vive sulla mappa in regia (mai in proiezione),
// centrata in basso. Il riquadro è ridimensionabile: bordo alto = altezza,
// bordi laterali = larghezza (simmetrica, il centro resta fermo).

const LARGHEZZA_DEFAULT = 560;
const ALTEZZA_DEFAULT = 220;
const MIN_W = 340;
const MIN_H = 150;

type ModoResize = "top" | "left" | "right";

interface DragState {
  modo: ModoResize;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export default function ChatMomenti() {
  const aggiungi = useMemeStore((s) => s.aggiungi);
  const markdown = useMemeStore((s) => s.markdown);
  const ultimo = useMemeStore((s) => s.momenti[s.momenti.length - 1]);

  const [larghezza, setLarghezza] = useState(LARGHEZZA_DEFAULT);
  const [altezza, setAltezza] = useState(ALTEZZA_DEFAULT);
  const [bozza, setBozza] = useState("");
  const [anteprima, setAnteprima] = useState(false);

  const dragRef = useRef<DragState | null>(null);

  function invia() {
    if (bozza.trim() === "") return;
    aggiungi(bozza);
    setBozza("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Invio = invia (Shift+Invio = a capo).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      invia();
    }
  }

  function handleResizeDown(e: React.PointerEvent<HTMLDivElement>, modo: ModoResize) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      modo,
      startX: e.clientX,
      startY: e.clientY,
      startW: larghezza,
      startH: altezza,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const maxW = Math.max(MIN_W, window.innerWidth * 0.95);
    const maxH = Math.max(MIN_H, window.innerHeight * 0.8);
    if (d.modo === "top") {
      // Il riquadro è ancorato in basso: trascinando in alto cresce in altezza.
      const nuova = d.startH + (d.startY - e.clientY);
      setAltezza(Math.min(maxH, Math.max(MIN_H, nuova)));
    } else {
      // Larghezza simmetrica dal centro: spostando un bordo, l'altro si muove
      // della stessa quantità → la larghezza cambia del doppio del delta.
      const delta = d.modo === "right" ? e.clientX - d.startX : d.startX - e.clientX;
      const nuova = d.startW + delta * 2;
      setLarghezza(Math.min(maxW, Math.max(MIN_W, nuova)));
    }
  }

  function handleResizeUp() {
    dragRef.current = null;
  }

  return (
    <div
      className={styles.riquadro}
      style={{ width: larghezza, height: altezza }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Maniglie di ridimensionamento sui bordi */}
      <div
        className={`${styles.maniglia} ${styles.manigliaTop}`}
        onPointerDown={(e) => handleResizeDown(e, "top")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        onPointerCancel={handleResizeUp}
        title="Trascina per cambiare l'altezza"
      />
      <div
        className={`${styles.maniglia} ${styles.manigliaLeft}`}
        onPointerDown={(e) => handleResizeDown(e, "left")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        onPointerCancel={handleResizeUp}
        title="Trascina per cambiare la larghezza"
      />
      <div
        className={`${styles.maniglia} ${styles.manigliaRight}`}
        onPointerDown={(e) => handleResizeDown(e, "right")}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
        onPointerCancel={handleResizeUp}
        title="Trascina per cambiare la larghezza"
      />

      <div className={styles.contenuto}>
        <div className={styles.chat}>
          <div className={styles.intestazione}>😂 Momenti meme</div>
          {!anteprima && ultimo && (
            <div className={styles.ultimo} title={ultimo.testo}>
              <span className={styles.ultimoOra}>{ultimo.ora}</span> {ultimo.testo}
            </div>
          )}
          <div className={styles.inputRiga}>
            {anteprima ? (
              <pre className={styles.anteprima}>{markdown()}</pre>
            ) : (
              <textarea
                className={styles.input}
                value={bozza}
                placeholder="Scrivi un momento e premi Invio…"
                onChange={(e) => setBozza(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            )}
            <div className={styles.bottoni}>
              <button
                type="button"
                className={styles.btnPreview}
                onClick={() => setAnteprima((v) => !v)}
                title="Mostra il contenuto dei momenti meme raccolti"
              >
                {anteprima ? "Modifica" : "Preview"}
              </button>
              <button
                type="button"
                className={styles.btnInvia}
                onClick={invia}
                disabled={anteprima}
                title="Salva momento"
              >
                Invia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
