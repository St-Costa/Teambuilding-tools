import { useEffect, useRef, useState } from "react";
import type { PrigionieroSnapshot } from "../lib/events";
import { risolviAsset } from "../lib/storage";
import { useViewport } from "../lib/useViewport";
import styles from "./AnimazionePrigione.module.css";

interface Props {
  snapshot: PrigionieroSnapshot;
  folderPath: string;
  sfondoSrc: string | null;
}

const DELAY_SBARRE_MS = 0;
const DELAY_IMPATTO_MS = DELAY_SBARRE_MS + 1300;

// Le immagini dei personaggi sono in portrait: il riquadro di ogni prigioniero
// usa lo stesso rapporto (larghezza/altezza) così la foto riempie la cornice
// senza deformarsi.
const PORTRAIT_RATIO = 0.66;

interface Particella {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  colore: string;
  size: number;
}

const CAP_PARTICELLE = 500;

export default function AnimazionePrigione({ snapshot, folderPath, sfondoSrc }: Props) {
  const { w, h } = useViewport();
  const vmin = Math.min(w, h);
  const n = snapshot.prigionieri.length;
  // Riquadri portrait affiancati: l'altezza è limitata dal viewport, la
  // larghezza dallo spazio disponibile diviso per il numero di prigionieri.
  const gapPx = vmin * 0.05;
  const maxLarghezza = (w * 0.92 - (n - 1) * gapPx) / Math.max(1, n);
  const altezza = Math.round(Math.min(h * 0.66, maxLarghezza / PORTRAIT_RATIO));
  const larghezza = Math.round(altezza * PORTRAIT_RATIO);

  const [sbarre, setSbarre] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setSbarre(false);
    setFlash(false);

    // Flash al termine esatto di cerchioSu (550ms)
    const t0 = window.setTimeout(() => {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 120);
    }, 550);

    const t1 = window.setTimeout(() => setSbarre(true), DELAY_SBARRE_MS);
    const t2 = window.setTimeout(() => {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 120);
    }, DELAY_IMPATTO_MS);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [snapshot.trigger]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particelleRef = useRef<Particella[]>([]);
  const rafRef = useRef(0);

  useEffect(() => {
    particelleRef.current = [];
    cancelAnimationFrame(rafRef.current);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxMaybe = canvas.getContext("2d");
    if (!ctxMaybe) return;
    const ctx = ctxMaybe;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.scale(dpr, dpr);

    let rafId = 0;
    let ultimo = performance.now();

    function spawnPolvere() {
      const tinte = ["#b0a090", "#c8baa0", "#8a7a6a", "#d4c8b0", "#6a5a4a", "#e0d4be", "#9a8a78"];
      for (let i = 0; i < 180; i++) {
        if (particelleRef.current.length >= CAP_PARTICELLE) break;
        const x = Math.random() * W;
        particelleRef.current.push({
          x,
          y: H,                            // nascono dal fondo
          vx: (Math.random() - 0.5) * 220,
          vy: -(400 + Math.random() * 400), // 400–800 px/s verso l'alto
          life: 1.4 + Math.random() * 0.8,
          max: 2.2,
          colore: tinte[Math.floor(Math.random() * tinte.length)],
          size: 2 + Math.random() * 6,
        });
      }
    }

    function frame(ora: number) {
      const dt = Math.min(0.05, (ora - ultimo) / 1000);
      ultimo = ora;

      ctx.clearRect(0, 0, W, H);
      for (let i = particelleRef.current.length - 1; i >= 0; i--) {
        const p = particelleRef.current[i];
        p.vy += 620 * dt; // gravità realistica: arcano su e ricadono
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0 || p.y > H + 20) {
          particelleRef.current.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, p.life / (p.max * 0.35));
        ctx.fillStyle = p.colore;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    rafRef.current = rafId;

    const tPolvere = window.setTimeout(spawnPolvere, DELAY_IMPATTO_MS);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(tPolvere);
    };
  }, [snapshot.trigger, w, h]);

  return (
    <div className={styles.root}>
      {sfondoSrc && (
        <img src={sfondoSrc} className={styles.sfondo} alt="" aria-hidden="true" />
      )}

      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.vignette} aria-hidden="true" />

      {/* Personaggi: immagini in portrait (senza nomi né manette) */}
      <div className={styles.prigionieri} style={{ gap: gapPx }}>
        {snapshot.prigionieri.map((p, i) => (
          <div
            key={p.personaggioId}
            className={styles.slot}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div
              className={styles.ritrattoWrap}
              style={{
                width: larghezza,
                height: altezza,
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <img
                src={risolviAsset(folderPath, p.imgPath)}
                alt={p.nome}
                className={styles.ritratto}
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sbarre della prigione */}
      <div
        className={`${styles.grata} ${sbarre ? styles.grataCaduta : ""}`}
        aria-hidden="true"
      />

      {flash && <div className={styles.flashImpatto} aria-hidden="true" />}

      <canvas ref={canvasRef} className={styles.particelle} aria-hidden="true" />
    </div>
  );
}
