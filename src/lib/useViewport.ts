import { useEffect, useState } from "react";

/**
 * Dimensione corrente della finestra (CSS px), aggiornata al resize. Serve a
 * dimensionare in JS gli elementi che scalano con lo schermo (es. i cerchietti
 * della leaderboard in proiezione), evitando valori in pixel fissi che su un
 * proiettore ad alta risoluzione risultano minuscoli.
 */
export function useViewport(): { w: number; h: number } {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return vp;
}
