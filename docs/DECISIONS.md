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
