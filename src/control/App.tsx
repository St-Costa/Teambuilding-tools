import { useState } from "react";
import { emit, EVT } from "../lib/events";
import styles from "./App.module.css";

export default function App() {
  const [count, setCount] = useState(0);

  const update = (next: number) => {
    setCount(next);
    void emit(EVT.counter, { value: next });
  };

  return (
    <div className={styles.root}>
      <h1>Regia</h1>
      <p className={styles.hint}>
        Prova di sincronizzazione: il numero qui sotto viene replicato sulla
        finestra di proiezione.
      </p>
      <div className={styles.counter}>
        <button onClick={() => update(count - 1)} aria-label="Decrementa">−</button>
        <span className={styles.value}>{count}</span>
        <button onClick={() => update(count + 1)} aria-label="Incrementa">+</button>
      </div>
      <button className={styles.reset} onClick={() => update(0)}>Azzera</button>
    </div>
  );
}
