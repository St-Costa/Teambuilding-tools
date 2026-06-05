import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { leggiBytesPresentazione } from "../lib/storage";

// Worker pdf.js: configurato una sola volta a livello di modulo. Con `?url`
// Vite emette l'asset nel bundle e ne fornisce l'URL; con csp:null non è
// bloccato. Usiamo .min.mjs (entry presente in pdfjs-dist v6).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Quante pagine (immagini) teniamo in cache. Basta a coprire la corrente più
// qualche vicina nei due sensi di navigazione.
const MAX_CACHE = 8;
// Limite al devicePixelRatio per la nitidezza: oltre 2 l'immagine diventa
// enorme e lenta da produrre, senza guadagno percepibile su un proiettore.
const MAX_DPR = 2;

// CACHE DEL DOCUMENTO a livello di modulo (una per finestra/WebView). Il PDF
// viene aperto UNA SOLA VOLTA per sessione e NON viene mai distrutto alla
// chiusura: su WebKitGTK distruggere documento + worker pdf.js a ogni chiusura
// fa crashare la WebView alla riapertura. Tenendolo vivo la riapertura è anche
// immediata (niente re-lettura/re-parsing).
const docCache = new Map<string, Promise<PDFDocumentProxy>>();

function chiaveDoc(folderPath: string, relPath: string): string {
  return `${folderPath} ${relPath}`;
}

function caricaDocumento(folderPath: string, relPath: string): Promise<PDFDocumentProxy> {
  const chiave = chiaveDoc(folderPath, relPath);
  let promessa = docCache.get(chiave);
  if (!promessa) {
    promessa = (async () => {
      const bytes = await leggiBytesPresentazione(folderPath, relPath);
      return pdfjs.getDocument({ data: bytes }).promise;
    })();
    promessa.catch(() => docCache.delete(chiave));
    docCache.set(chiave, promessa);
  }
  return promessa;
}

interface Props {
  folderPath: string;
  presentazionePath: string;
  pagina: number; // 1-based
  // Notificato quando il PDF è stato aperto e si conosce il numero di pagine.
  onNumPagine?: (n: number) => void;
  // Notificato in caso di errore di apertura/lettura del PDF.
  onErrore?: (messaggio: string) => void;
}

// Componente riusabile: mostra UNA pagina del PDF, adattata (contain) al proprio
// contenitore. Usato sia a tutto schermo sulla proiezione sia in piccolo come
// anteprima nella regia.
//
// STRATEGIA ANTI-FLASH: ogni pagina viene renderizzata UNA volta (pdf.js →
// canvas fuori schermo → blob → object URL) e mostrata come <img>. Il cambio
// pagina è un semplice scambio di OPACITÀ fra due <img> sovrapposte e già
// decodificate: pura operazione di compositing, nessun canvas toccato al
// momento del cambio → niente lampo (il compositor di WebKitGTK mostra un frame
// vuoto se si manipola un <canvas> visibile, ma non con immagini statiche).
export default function Presentazione({
  folderPath,
  presentazionePath,
  pagina,
  onNumPagine,
  onErrore,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // Doppio buffer DOM con due <img> sovrapposte, entrambe sempre dipinte:
  // carichiamo la pagina nuova in quella dietro e poi la portiamo davanti con
  // lo z-index (così nessuna texture viene scartata → niente flash).
  const imgARef = useRef<HTMLImageElement | null>(null);
  const imgBRef = useRef<HTMLImageElement | null>(null);
  const frontRef = useRef<0 | 1>(0); // quale <img> (A=0 / B=1) è davanti
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [docPronto, setDocPronto] = useState(0); // bump per ri-renderizzare al load
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const [pronto, setPronto] = useState(false); // prima pagina mostrata?

  // Cache pagina → object URL dell'immagine, e dedup dei render in corso.
  const urlCacheRef = useRef<Map<number, string>>(new Map());
  const inflightRef = useRef<Map<number, Promise<string | null>>>(new Map());
  // RenderTask in corso: cancellabili senza rischi (a differenza della distruzione
  // del documento). Cancellati su smontaggio o cambio scala.
  const renderTasksRef = useRef<Set<RenderTask>>(new Set());
  // Firma della scala (dimensioni + dpr): se cambia, le immagini in cache non
  // sono più alla risoluzione giusta e vanno rigenerate.
  const firmaScalaRef = useRef<string>("");

  // Callback stabili tramite ref: fuori dalle dipendenze degli effetti.
  const onNumPagineRef = useRef(onNumPagine);
  const onErroreRef = useRef(onErrore);
  onNumPagineRef.current = onNumPagine;
  onErroreRef.current = onErrore;

  function annullaRenderInCorso() {
    for (const t of renderTasksRef.current) {
      try {
        t.cancel();
      } catch {
        // cancel() può lanciare se il task è già concluso: ignoriamo.
      }
    }
    renderTasksRef.current.clear();
    inflightRef.current.clear();
  }

  function svuotaCacheImmagini() {
    for (const url of urlCacheRef.current.values()) URL.revokeObjectURL(url);
    urlCacheRef.current.clear();
  }

  // Misura del contenitore, per scegliere la risoluzione di render.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const aggiorna = () =>
      setDim({ w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) });
    aggiorna();
    const ro = new ResizeObserver(aggiorna);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ottiene il documento dalla cache di modulo (aperto una sola volta).
  useEffect(() => {
    let annullato = false;
    setDocPronto(0);
    setPronto(false);
    annullaRenderInCorso();
    svuotaCacheImmagini();
    firmaScalaRef.current = "";
    // Nuovo documento: riparti con A davanti (z-index 1), B dietro (0). Le <img>
    // vengono svuotate; l'overlay "Caricamento…" (fondo nero) copre tutto finché
    // non c'è la prima pagina.
    frontRef.current = 0;
    if (imgARef.current) {
      imgARef.current.removeAttribute("src");
      imgARef.current.removeAttribute("data-page");
      imgARef.current.style.zIndex = "1";
    }
    if (imgBRef.current) {
      imgBRef.current.removeAttribute("src");
      imgBRef.current.removeAttribute("data-page");
      imgBRef.current.style.zIndex = "0";
    }
    void (async () => {
      try {
        const doc = await caricaDocumento(folderPath, presentazionePath);
        if (annullato) return;
        docRef.current = doc;
        onNumPagineRef.current?.(doc.numPages);
        setDocPronto((n) => n + 1);
      } catch (e) {
        if (!annullato) {
          onErroreRef.current?.(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      annullato = true;
      docRef.current = null;
      // Cancella i render in volo (sicuro) e libera le immagini. NON distrugge il
      // documento: resta nella cache di modulo per tutta la sessione.
      annullaRenderInCorso();
      svuotaCacheImmagini();
    };
  }, [folderPath, presentazionePath]);

  // Mostra la pagina corrente e pre-carica le vicine. Si riesegue al cambio di
  // pagina, documento o dimensioni.
  useEffect(() => {
    const doc = docRef.current;
    if (!doc || dim.w === 0 || dim.h === 0) return;
    let annullato = false;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const firma = `${dim.w}x${dim.h}@${dpr}`;
    // Cambiata la scala: immagini in cache non più valide, render in corso inutili.
    if (firmaScalaRef.current !== firma) {
      annullaRenderInCorso();
      svuotaCacheImmagini();
      firmaScalaRef.current = firma;
    }

    // Renderizza una pagina e ne restituisce l'object URL (con cache e dedup).
    async function preparaUrl(num: number): Promise<string | null> {
      if (num < 1 || num > doc!.numPages) return null;
      const cached = urlCacheRef.current.get(num);
      if (cached) return cached;
      const giaInCorso = inflightRef.current.get(num);
      if (giaInCorso) return giaInCorso;

      const promessa = (async () => {
        const page = await doc!.getPage(num);
        const base = page.getViewport({ scale: 1 });
        const fit = Math.min(dim.w / base.width, dim.h / base.height);
        const viewport = page.getViewport({ scale: fit * dpr });
        const off = document.createElement("canvas");
        off.width = Math.max(1, Math.floor(viewport.width));
        off.height = Math.max(1, Math.floor(viewport.height));
        const task = page.render({ canvas: off, viewport });
        renderTasksRef.current.add(task);
        try {
          await task.promise;
        } finally {
          renderTasksRef.current.delete(task);
        }
        // JPEG (non PNG): a piena risoluzione di proiezione la codifica PNG è
        // lenta e fa arrivare la pagina in ritardo rispetto alla regia. Il JPEG
        // si produce e decodifica molto più in fretta; su slide di regole la
        // differenza di qualità è impercettibile.
        const blob = await new Promise<Blob | null>((res) =>
          off.toBlob(res, "image/jpeg", 0.9),
        );
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        urlCacheRef.current.set(num, url);
        sfoltisciCache(num);
        return url;
      })();
      inflightRef.current.set(num, promessa);
      try {
        return await promessa;
      } finally {
        inflightRef.current.delete(num);
      }
    }

    // Mantiene in cache solo le MAX_CACHE pagine più vicine alla corrente,
    // revocando gli object URL evitati (l'<img> che li mostra è già decodificata,
    // quindi resta visibile anche dopo la revoca).
    function sfoltisciCache(corrente: number) {
      if (urlCacheRef.current.size <= MAX_CACHE) return;
      const ordinate = [...urlCacheRef.current.keys()].sort(
        (a, b) => Math.abs(b - corrente) - Math.abs(a - corrente),
      );
      for (const k of ordinate) {
        if (urlCacheRef.current.size <= MAX_CACHE) break;
        if (k === corrente) continue;
        const url = urlCacheRef.current.get(k);
        if (url) URL.revokeObjectURL(url);
        urlCacheRef.current.delete(k);
      }
    }

    const num = Math.min(Math.max(1, pagina), doc.numPages);
    void (async () => {
      try {
        const url = await preparaUrl(num);
        if (annullato || !url) return;
        const front = frontRef.current === 0 ? imgARef.current : imgBRef.current;
        const back = frontRef.current === 0 ? imgBRef.current : imgARef.current;
        if (!front || !back) return;
        // Carica nell'<img> dietro (invisibile) e attende la decodifica, così lo
        // scambio mostra subito la bitmap pronta — niente lampo.
        if (back.getAttribute("data-page") !== String(num)) {
          back.src = url;
          back.setAttribute("data-page", String(num));
          try {
            await back.decode();
          } catch {
            // decode() può fallire se l'immagine viene rimpiazzata: ignoriamo.
          }
        }
        if (annullato) return;
        // Porta davanti l'<img> appena pronta (z-index): entrambe restano sempre
        // dipinte (opacity 1), quindi nessuna texture viene scartata/ricaricata
        // → niente flash. Pura operazione di compositing.
        back.style.zIndex = "1";
        front.style.zIndex = "0";
        frontRef.current = frontRef.current === 0 ? 1 : 0;
        setPronto(true);
        // Pre-carica le vicine (avanti per primo: senso più probabile), con un
        // po' di margine in avanti così la proiezione è pronta anche se navighi
        // veloce e non resta indietro rispetto alla regia.
        void preparaUrl(num + 1);
        void preparaUrl(num - 1);
        void preparaUrl(num + 2);
      } catch (e) {
        const nome = e instanceof Error ? e.name : "";
        if (!annullato && nome !== "RenderingCancelledException") {
          onErroreRef.current?.(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      annullato = true;
    };
  }, [pagina, docPronto, dim.w, dim.h]);

  // Le due <img> sovrapposte e centrate; object-fit: contain le adatta da sole
  // al contenitore mantenendo le proporzioni. NB: opacità e z-index NON sono in
  // questo stile (li gestiamo in modo imperativo), così i re-render di React non
  // li sovrascrivono ridando il flash.
  const stileImg: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <img ref={imgARef} alt="" draggable={false} style={stileImg} />
      <img ref={imgBRef} alt="" draggable={false} style={stileImg} />
      {!pronto && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.7)",
            fontSize: "1rem",
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          }}
        >
          Caricamento…
        </div>
      )}
    </div>
  );
}
