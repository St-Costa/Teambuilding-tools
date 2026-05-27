import { useEffect, useState } from "react";
import { listen, EVT } from "../lib/events";
import styles from "./App.module.css";

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const unlistenP = listen(EVT.counter, ({ value }) => setCount(value));
    return () => {
      unlistenP.then((u) => u());
    };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.value}>{count}</div>
    </div>
  );
}
