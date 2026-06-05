import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import { useAmbientazioneStore } from "../state/ambientazioneStore";
import { useAutosave } from "../state/useAutosave";
import { aggiungiRecente, listaRecenti } from "../lib/recents";
import { apriAmbientazione, autorizzaCartella } from "../lib/storage";
import { abilitaAudioAlPrimoGesto } from "../lib/audio";
import SelezioneAmbientazione from "./views/SelezioneAmbientazione";
import AmbientazioneAperta from "./views/AmbientazioneAperta";

interface InstallResult {
  nome: string;
  path: string;
  copiato: boolean;
}

function joinPath(a: string, b: string): string {
  const sep = a.includes("\\") && !a.includes("/") ? "\\" : "/";
  return `${a.replace(/[/\\]+$/, "")}${sep}${b}`;
}

export default function App() {
  const current = useAmbientazioneStore((s) => s.current);
  useAutosave();

  // Sblocca l'audio sintetizzato (tick ruota, beep timer) al primo gesto:
  // necessario perché nel build di produzione l'AudioContext nasce sospeso e
  // resume() funziona solo dentro lo stack di un gesto utente.
  useEffect(() => abilitaAudioAlPrimoGesto(), []);

  useEffect(() => {
    void (async () => {
      // 1. In dev mode: indicizza automaticamente gli scenari trovati in
      //    <repo>/scenari-bundled/ aggiungendoli ai recenti se non già presenti.
      //    Così l'autore del tool li vede e li modifica direttamente, senza
      //    copy-paste manuale.
      try {
        const repoScenari = await invoke<string | null>("cartella_repo_scenari");
        if (repoScenari) {
          await autorizzaCartella(repoScenari).catch(() => undefined);
          const entries = await readDir(repoScenari);
          for (const e of entries) {
            if (!e.isDirectory) continue;
            const path = joinPath(repoScenari, e.name);
            try {
              await autorizzaCartella(path);
              const a = await apriAmbientazione(path);
              await aggiungiRecente(path, a.nome);
            } catch {
              // ignora cartelle non valide (es. README.md, .gitkeep, scenari corrotti)
            }
          }
        }
      } catch {
        // se il comando non risponde, skippiamo silenziosamente
      }

      // 2. In prod (release build): installa eventuali scenari factory
      //    bundlati nelle risorse del binario. Idempotente: lanci successivi
      //    ritornano [] dopo che il tracking è stato salvato.
      try {
        const installati = await invoke<InstallResult[]>("installa_scenari_factory");
        for (const r of installati) {
          try {
            const a = await apriAmbientazione(r.path);
            await aggiungiRecente(r.path, a.nome);
          } catch {
            // manifest corrotto: skip
          }
        }
      } catch {
        // command non disponibile
      }

      // 3. Restauro scope filesystem per le entries dei recenti già esistenti.
      try {
        const recenti = await listaRecenti();
        for (const r of recenti) {
          if (r.esiste) {
            await autorizzaCartella(r.path).catch(() => undefined);
          }
        }
      } catch {
        // se il restauro scope fallisce non blocchiamo: gli errori
        // verranno mostrati al primo tentativo di apertura
      }
    })();
  }, []);

  return current === null ? <SelezioneAmbientazione /> : <AmbientazioneAperta />;
}
