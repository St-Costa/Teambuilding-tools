import { useEffect, useState } from "react";
import type { TimerSnapshot } from "../lib/events";
import { formatMmSs, remainingMs } from "../state/timerStore";
import styles from "./DisplayTimer.module.css";

interface Props {
  snapshot: TimerSnapshot;
  /** Chiamato quando il display rileva remaining ≤ 0 in fase running. */
  onEnded?: () => void;
}

const TICK_MS = 100;

export default function DisplayTimer({ snapshot, onEnded }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (snapshot.stato !== "running") return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [snapshot.stato]);

  const ms = remainingMs(snapshot, now);

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
