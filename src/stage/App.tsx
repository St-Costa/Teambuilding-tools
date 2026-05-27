import { useEffect, useState } from "react";
import { listen, EVT } from "../lib/events";
import styles from "./App.module.css";

export default function App() {
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    const unlistenP = listen(EVT.ambientazioneLoaded, ({ nome }) => setNome(nome));
    return () => {
      unlistenP.then((u) => u());
    };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.value}>{nome ?? "—"}</div>
    </div>
  );
}
