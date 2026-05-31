import { useEffect, useState } from "react";
import type { TimerSnapshot } from "../lib/events";
import { formatMmSs, remainingMs } from "../state/timerStore";
import styles from "./DisplayTimer.module.css";

interface Props {
  snapshot: TimerSnapshot;
  /** Chiamato quando il display rileva remaining ≤ 0 in fase running. */
  onEnded?: () => void;
}

export default function DisplayTimer({ snapshot, onEnded }: Props) {
  // Contatore di sola "spinta render": NON è il tempo. Il tempo residuo è
  // sempre ricalcolato da Date.now() a ogni render (vedi `ms` sotto), così
  // ogni ridisegno mostra il valore corretto — anche quelli innescati dalle
  // ri-emissioni 1/sec della regia, indipendentemente dallo stato del rAF.
  const [, forceRender] = useState(0);

  // requestAnimationFrame invece di setInterval per la fluidità: la finestra di
  // proiezione di norma NON ha il focus e WebKitGTK throttla pesantemente i
  // setInterval/setTimeout delle finestre non a fuoco (era la causa dello
  // "scatto" del timer ogni qualche secondo). Il rAF spinge i ridisegni finché
  // la finestra è visibile; se anche il rAF venisse rallentato, le ri-emissioni
  // 1/sec della regia garantiscono comunque l'aggiornamento.
  useEffect(() => {
    if (snapshot.stato !== "running") return;
    let raf = 0;
    const loop = () => {
      forceRender((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [snapshot.stato]);

  const ms = remainingMs(snapshot);

  useEffect(() => {
    if (snapshot.stato === "running" && ms <= 0) {
      onEnded?.();
    }
  }, [ms, snapshot.stato, onEnded]);

  // In idle, niente banner sulla proiezione (tiene la scena pulita finché il
  // regista non tocca il timer).
  if (snapshot.stato === "idle") return null;

  const etichetta =
    snapshot.stato === "running"
      ? "in corso"
      : snapshot.stato === "paused"
        ? "in pausa"
        : "tempo scaduto";

  return (
    <div
      className={`${styles.banner} ${snapshot.stato === "ended" ? styles.scaduto : ""}`}
    >
      <div className={styles.cifre}>{formatMmSs(ms)}</div>
      <div className={styles.etichetta}>{etichetta}</div>
    </div>
  );
}
