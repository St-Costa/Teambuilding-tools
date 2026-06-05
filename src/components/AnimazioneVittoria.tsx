import { useEffect, useRef } from "react";
import { listen, EVT, type BoomPayload, type VittoriaSnapshot } from "../lib/events";
import { risolviAsset } from "../lib/storage";
import { useViewport } from "../lib/useViewport";
import Cerchietto from "./Cerchietto";
import { IconaCorona } from "./Icone";
import styles from "./AnimazioneVittoria.module.css";

interface Props {
  snapshot: VittoriaSnapshot;
  folderPath: string;
}

// Cerchietto dei vincitori come frazione del lato minore (vmin) → scala col
// proiettore. Un solo vincitore = grande; più vincitori = via via più piccoli,
// con un minimo per restare visibili anche con molti pari merito.
function frazioneCerchietto(n: number): number {
  const f = 0.42 / Math.sqrt(Math.max(1, n));
  return Math.min(0.42, Math.max(0.1, f));
}

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  const h = hex.replace("#", "").trim();
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return [Number.isNaN(r) ? 255 : r, Number.isNaN(g) ? 215 : g, Number.isNaN(b) ? 0 : b];
}

function rgba([r, g, b]: RGB, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Schiarisce verso il bianco di un fattore t (0 = invariato, 1 = bianco).
function schiarisci([r, g, b]: RGB, t: number): RGB {
  return [
    Math.round(r + (255 - r) * t),
    Math.round(g + (255 - g) * t),
    Math.round(b + (255 - b) * t),
  ];
}

// Due tinte che si alternano sui raggi cinetici, in tema coi vincitori:
//  1 vincitore  → il suo colore + una sua sfumatura più chiara
//  2 vincitori  → i due colori dei bordi
//  >2 vincitori → oro + bianco (neutro ma vivace)
function tinteRaggi(colori: string[]): [string, string] {
  if (colori.length === 1) {
    const c = parseHex(colori[0]);
    return [rgba(c, 0.3), rgba(schiarisci(c, 0.55), 0.24)];
  }
  if (colori.length === 2) {
    return [rgba(parseHex(colori[0]), 0.3), rgba(parseHex(colori[1]), 0.3)];
  }
  return ["rgba(255, 215, 0, 0.3)", "rgba(255, 255, 255, 0.26)"];
}

interface Particella {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // residua, in secondi
  max: number; // durata totale, per il fade
  colore: string;
  size: number;
  rot: number;
  vr: number;
  tipo: "coriandolo" | "scintilla";
}

const CAP_PARTICELLE = 400; // tetto fps-safe su WebKitGTK / proiettori grandi
const GRAVITA = 480; // px/s² (su canvas in px logici)
const CORIANDOLI_AL_SEC = 70; // emissione continua dal bordo superiore

export default function AnimazioneVittoria({ snapshot, folderPath }: Props) {
  const { w, h } = useViewport();
  const vmin = Math.min(w, h);
  const n = snapshot.vincitori.length;
  const dim = Math.round(vmin * frazioneCerchietto(n));
  const dimCorona = Math.round(dim * 0.55);

  // Palette dei raggi cinetici, in tema coi vincitori. 12 beam alternati a due
  // colori (periodo 60°: beamA, gap, beamB, gap).
  const [tintaA, tintaB] = tinteRaggi(snapshot.vincitori.map((v) => v.colore));
  const raggiBackground = `repeating-conic-gradient(from 0deg, ${tintaA} 0deg 5deg, transparent 5deg 30deg, ${tintaB} 30deg 35deg, transparent 35deg 60deg)`;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Booms ricevuti dalla regia, in attesa di essere "esplosi" al prossimo frame.
  const boomPendenti = useRef<BoomPayload[]>([]);

  useEffect(() => {
    const unlistenP = listen(EVT.vittoriaBoom, (p) => {
      boomPendenti.current.push(p);
    });
    return () => {
      unlistenP.then((u) => u());
    };
  }, []);

  // Sistema di particelle su canvas (rAF, zero dipendenze).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctxMaybe = canvas.getContext("2d");
    if (!ctxMaybe) return;
    const ctx = ctxMaybe; // non-null stabile dentro le closure del loop

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.scale(dpr, dpr);

    const particelle: Particella[] = [];
    let raf = 0;
    let ultimo = performance.now();
    let accumuloCoriandoli = 0;

    function spawnCoriandolo() {
      if (particelle.length >= CAP_PARTICELLE) return;
      const tinte = ["#ffd700", "#ffffff", "#ff5252", "#40c4ff", "#69f0ae", "#ffab40", "#e040fb"];
      particelle.push({
        x: Math.random() * W,
        y: -12,
        vx: (Math.random() - 0.5) * 80,
        vy: 40 + Math.random() * 80,
        life: 4 + Math.random() * 2,
        max: 6,
        colore: tinte[Math.floor(Math.random() * tinte.length)],
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 8,
        tipo: "coriandolo",
      });
    }

    function esplodi(boom: BoomPayload) {
      const cx = boom.x * W;
      // Nella metà ALTA dello schermo (richiesta committente).
      const cy = H * (0.12 + Math.random() * 0.26);
      const colori = boom.colori.length ? boom.colori : ["#ffd700", "#ffffff"];
      const nScintille = 38;
      for (let i = 0; i < nScintille; i++) {
        if (particelle.length >= CAP_PARTICELLE) break;
        const ang = (Math.PI * 2 * i) / nScintille + Math.random() * 0.2;
        const vel = 140 + Math.random() * 170;
        particelle.push({
          x: cx,
          y: cy,
          vx: Math.cos(ang) * vel,
          vy: Math.sin(ang) * vel,
          life: 0.9 + Math.random() * 0.7,
          max: 1.6,
          colore: colori[Math.floor(Math.random() * colori.length)],
          size: 3 + Math.random() * 3,
          rot: 0,
          vr: 0,
          tipo: "scintilla",
        });
      }
    }

    function frame(ora: number) {
      const dt = Math.min(0.05, (ora - ultimo) / 1000);
      ultimo = ora;

      // Emissione continua coriandoli
      accumuloCoriandoli += dt * CORIANDOLI_AL_SEC;
      while (accumuloCoriandoli >= 1) {
        spawnCoriandolo();
        accumuloCoriandoli -= 1;
      }

      // Booms ricevuti dalla regia
      if (boomPendenti.current.length) {
        for (const b of boomPendenti.current) esplodi(b);
        boomPendenti.current = [];
      }

      ctx.clearRect(0, 0, W, H);
      for (let i = particelle.length - 1; i >= 0; i--) {
        const p = particelle[i];
        // Le scintille subiscono più gravità, i coriandoli planano.
        p.vy += GRAVITA * dt * (p.tipo === "scintilla" ? 1 : 0.35);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt;
        if (p.life <= 0 || p.y > H + 20) {
          particelle.splice(i, 1);
          continue;
        }
        const alpha = Math.min(1, p.life / (p.max * 0.5));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.colore;
        if (p.tipo === "coriandolo") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [w, h]);

  return (
    <div className={styles.root}>
      <div className={styles.raggi} style={{ background: raggiBackground }} aria-hidden="true" />
      <div className={styles.vincitori}>
        {snapshot.vincitori.map((v, i) => {
          const delayCerchio = i * 0.12;
          const delayCorona = delayCerchio + 0.35;
          return (
            <div key={v.personaggioId} className={styles.slot}>
              <div
                className={styles.coronaWrap}
                style={{
                  animationDelay: `${delayCorona}s`,
                  marginBottom: -Math.round(dimCorona * 0.42),
                }}
                aria-hidden="true"
              >
                <IconaCorona dimensione={dimCorona} />
              </div>
              <div className={styles.cerchioWrap} style={{ animationDelay: `${delayCerchio}s` }}>
                <Cerchietto
                  src={risolviAsset(folderPath, v.imgPath)}
                  colore={v.colore}
                  crop={v.crop}
                  dimensione={dim}
                  alt={v.nome}
                />
              </div>
            </div>
          );
        })}
      </div>
      <canvas ref={canvasRef} className={styles.particelle} aria-hidden="true" />
    </div>
  );
}
