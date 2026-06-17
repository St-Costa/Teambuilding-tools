import { convertFileSrc } from "@tauri-apps/api/core";
import { cropIniziale, type Crop } from "./ambientazione";

const TIMEOUT_DEFAULT_MS = 5000;

/**
 * Calcola un crop di partenza (zoom "riempi il cerchio", offset centrato)
 * caricando l'immagine indicata. Risolve sempre, anche in caso di errore o di
 * caricamento bloccato: senza il timeout, un file mancante/non leggibile che
 * lascia `Image` in pending appenderebbe il wizard per sempre.
 */
export function cropDiPartenzaDaImmagine(
  path: string,
  timeoutMs: number = TIMEOUT_DEFAULT_MS,
): Promise<Crop> {
  return new Promise((resolve) => {
    let risolto = false;
    const finisci = (crop: Crop) => {
      if (risolto) return;
      risolto = true;
      clearTimeout(timer);
      resolve(crop);
    };

    const timer = setTimeout(() => finisci(cropIniziale()), timeoutMs);

    const img = new Image();
    img.onload = () => {
      const lato = Math.max(img.naturalWidth, img.naturalHeight);
      const latoCorto = Math.min(img.naturalWidth, img.naturalHeight);
      const zoomNaturale = latoCorto > 0 ? lato / latoCorto : 1;
      const zoom = Math.min(10, Math.max(0.5, zoomNaturale));
      finisci({ zoom, offsetX: 0, offsetY: 0 });
    };
    img.onerror = () => finisci(cropIniziale());
    img.src = convertFileSrc(path);
  });
}
