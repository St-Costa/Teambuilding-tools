import { useEffect, useState } from "react";
import type { TimerSnapshot } from "../lib/events";
import { formatMmSs, remainingMs } from "../state/timerStore";
import styles from "./ScenaCountdownFullscreen.module.css";

interface Props {
  snapshot: TimerSnapshot;
  sfondoSrc: string | null;
}

export default function ScenaCountdownFullscreen({ snapshot, sfondoSrc }: Props) {
  const [, forceRender] = useState(0);

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
  const mostraTimer = snapshot.stato !== "idle";

  return (
    <div className={styles.root}>
      {sfondoSrc && (
        <img src={sfondoSrc} alt="" className={styles.sfondo} />
      )}
      <div className={styles.overlay} />
      {mostraTimer && (
        <div className={`${styles.cifre} ${snapshot.stato === "ended" ? styles.scaduto : ""}`}>
          {formatMmSs(ms)}
        </div>
      )}
    </div>
  );
}
