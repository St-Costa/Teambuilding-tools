# DECISIONS.md — log delle scelte di progetto

Questo documento traccia le decisioni architetturali, le assunzioni fatte (CLAUDE.md §10) e le deviazioni dalla spec. È aggiornato a fine di ogni milestone. La spec autoriale resta `CLAUDE.md` in root; questo file le sta accanto e ne segue l'evoluzione concreta.

Formato: una sezione per milestone, decisioni numerate e datate. Le decisioni superate vanno barrate (`~~testo~~`) con riferimento alla decisione che le sostituisce, non cancellate.

---

## M1 + M2 — Scaffold e prova di comunicazione tra finestre (2026-05-27)

### D-001 — Stack: Tauri v2 + React + TS + Vite + Zustand
Confermato da spec §1. Toolchain installata: Rust 1.95.0, Node 24.15.0, Tauri 2.11.2, plugin-fs 2.5.1, plugin-dialog 2.7.1. Webkit2gtk-4.1 su Ubuntu 24.04.

### D-002 — Due finestre Tauri con entry HTML separati
La spec §2 chiede due finestre (`control` Regia, `stage` Proiezione). Scelti **due entry HTML distinti** (`control.html`, `stage.html`) con Vite multi-page invece di un singolo `index.html` con routing interno. Motivo: ogni finestra carica solo il codice che le serve, la Proiezione non importa per sbaglio componenti della Regia (più robusto rispetto alla regola "nessun controllo sulla proiezione" della spec §2).

### D-003 — Comunicazione cross-window via `emit`/`listen` Tauri (NON BroadcastChannel)
Rischio §9.1 verificato end-to-end con contatore sincronizzato Regia → Proiezione: emit/listen propaga tra le due WebView Tauri in tempo reale. Implementato in `src/lib/events.ts` con wrapper tipizzato (`EVT.<nome>` + mappa `EventPayloads`).

### D-004 — Styling con CSS modules (no Tailwind)
Confermato dall'utente in plan mode. Motivo: UI funzionale per non-tecnico, non vetrina di design; meno strumentazione = meno superficie di errore. Convenzione: `Component.module.css` co-locato col componente, più CSS globali per reset/typography per finestra (`control.css`, `stage.css`).

### D-005 — Plugin Tauri abilitati: `fs` + `dialog`. Rimosso `opener`
`tauri-plugin-opener` (parte dello scaffold di default) non serve a questo tool e introduce dipendenza inutile, rimosso da `Cargo.toml` e `package.json`. Aggiunti `tauri-plugin-fs` e `tauri-plugin-dialog` (serviranno da M3 per la gestione cartelle ambientazione).

### D-006 — Capabilities condivise tra control e stage
`src-tauri/capabilities/default.json` applica `core:default` + `core:event:default` + `core:window:default` + `dialog:default` + `fs:default` a **entrambe** le finestre. Rationale: la Proiezione non ha pulsanti ma deve ricevere eventi; lo Stage potrebbe in futuro avere bisogno di window control (fullscreen). Se in futuro emerge la necessità di restringere, splittiamo in capability files per-window.

### D-007 — Lingua: italiano in UI + commit messages in italiano-ish
UI in italiano (spec §6). Commit message restano tecnici (mix it/en), perché letti soprattutto da me e da Claude. Codice e identificatori in inglese (convenzione internazionale).

### D-008 — Identifier app: `com.teambuilding.gdr`
Scelto al momento dello scaffold. Cambiabile prima del primo rilascio se serve.

### Assunzioni aperte da §10 di CLAUDE.md
Nessuna toccata in M1+M2. Saranno trattate quando rilevanti:
- §10.1 (resa "fetta di incremento"): da M6 (ruota).
- §10.2 (layout multi-oggetto attorno al cerchio): da M5 (oggetti).
- §10.3 (autosave vs manuale): **autosave** confermato. Verrà implementato in M3.
- §10.4 (storico esiti conflitti): da M6.
- §10.5 (eliminazione personaggio in conflitto): da M6.

### Verificato
- `npm run build` + `cargo check` clean.
- `tauri dev` apre 2 finestre, contatore Regia → Proiezione sincrono in tempo reale (confermato visivamente dall'utente).

---

## M3 — Selezione/creazione ambientazione + autosave (2026-05-27)

### D-009 — Schema manifest con `schemaVersion: 1`
`ambientazione.json` parte dalla versione 1 esplicita, validazione manuale leggera in `src/lib/ambientazione.ts` (`validaAmbientazione`). Niente Zod o altre lib: la superficie del manifest è piccola e il controllo è esplicito. Mismatch di versione → eccezione tipata `AmbientazioneCorrotta`, gestita nella UI con messaggio italiano. La struttura per migrazioni futuristiche c'è (switch su `schemaVersion`) ma non implementata finché non avremo una v2 reale.

### D-010 — Write atomico per `ambientazione.json` e `recents.json`
Tutti i write di manifest passano per `<file>.tmp` + `rename` atomico. Motivo: se l'app crasha a metà write, il file finale resta coerente con la versione precedente. Costo trascurabile (un syscall in più). Applicato anche al file dei recenti.

### D-011 — Scope filesystem dinamico via custom command Rust
Implementato `#[tauri::command] allow_ambientazione_folder(path)` in `src-tauri/src/lib.rs`. JS lo invoca subito dopo ogni dialog folder picker e all'avvio per ogni voce nei recenti. Lo scope è in-memory (perso al riavvio), riautorizzato lazy. Alternative scartate:
- Static scope ampio (`$HOME/**`): troppo lasco, e i path delle ambientazioni possono stare ovunque (es. cloud drive, USB).
- `tauri-plugin-fs` auto-scope da dialog: non documentato come stabile in 2.x.

In `capabilities/default.json` aggiunti i permessi granulari `fs:allow-{read-text-file,write-text-file,mkdir,exists,read-dir,rename,remove}` + `fs:allow-appconfig-{read,write}-recursive` per il file dei recenti. **Attenzione**: i nomi corretti sono `appconfig` (senza trattino), non `app-config` — il primo tentativo è fallito su `fs:allow-app-config-read-recursive` e ho dovuto correggerlo.

### D-012 — Recents in `appConfigDir/recents.json`, max 10 voci
Persistenza cross-launch tramite plugin-fs con `BaseDirectory.AppConfig` (gestito dal sistema operativo). Max 10 voci, ordine: più recente prima. Cartelle mancanti restano in lista con stato `esiste: false` per dare al conduttore la possibilità di "rimuovere dalla lista" (non eliminare dal disco, distinzione importante per non-tecnici).

### D-013 — Store Zustand singleton + autosave hook
`useAmbientazioneStore` come single source of truth lato regia. `modifica(fn)` usa clone-then-apply (JSON.parse/stringify) invece di immer per non aggiungere deps. Triggera transizione `dirty` → `saving` → `saved` via `useAutosave` (subscribe-based, debounce **500ms**, con stale-flag per modifiche durante save in volo).

### D-014 — Routing condizionale, niente react-router
`src/control/App.tsx` sceglie tra `SelezioneAmbientazione` e `AmbientazioneAperta` in base a `current === null`. Due viste sole, condizione semplice — un router sarebbe overhead.

### D-015 — UI testuale in italiano, conferme su azioni semi-distruttive
- "Apri esistente" / "Nuova ambientazione" / "Chiudi ambientazione".
- Chiusura con `saveStatus !== 'saved'` chiede conferma.
- Creazione su cartella esistente chiede conferma di sovrascrittura del manifest.
- Errori tradotti in italiano con messaggio comprensibile a non-tecnico (es. "L'ambientazione è corrotta: …" invece di stack trace).

### D-016 — Pulsante "Rinomina (test M3)" temporaneo
In `AmbientazioneAperta.tsx` c'è un bottone tratteggiato di test per provare l'autosave senza aspettare M4 (mappa/personaggi). **Rimuovere** quando arriverà la prima modifica reale (M4).

### D-017 — Proiezione: nome ambientazione + font auto-fit
La proiezione mostra il nome dell'ambientazione (o "—") con `font-size: clamp(3rem, min(12vw, 60vh), 18rem)` e `word-break`. Il primo tentativo con `clamp(8rem, 30vw, 40rem)` era pensato per contenuti corti (cifre del contatore) e tagliava nomi lunghi tipo "Treno deragliato" — feedback diretto dell'utente. La formula attuale scala con il minore tra larghezza/altezza del display e ha break-word di sicurezza.

### Assunzioni aperte da §10 (aggiornamento)
- §10.3 autosave: **risolto** in M3, implementato come da preferenza confermata.
- Altri punti invariati rispetto a M2.

### Verificato
- `npx tsc --noEmit` + `npx vite build` clean.
- `cargo check` clean (dopo fix nome capability `appconfig`).
- `tauri dev`: landing OK, creazione cartella + manifest su disco OK, autosave con indicatore `dirty → saving → saved` OK, recents persistenti cross-restart, errore manifest corrotto mostrato in italiano. Confermato visivamente dall'utente.

---
