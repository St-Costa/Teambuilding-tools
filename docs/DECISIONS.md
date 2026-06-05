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

## M4 — Mappa + personaggi (pan/zoom + drag&drop + sync proiezione) (2026-05-27)

### D-018 — Schema Personaggio esteso e validato campo-per-campo
`Personaggio` ora è `{id, nome, colore, imgPath, crop, posizione}` con validazione campo-per-campo (incluso check hex `^#[0-9A-Fa-f]{6}$` sul colore). Le posizioni sono **normalizzate 0..1 rispetto alla mappa**, così sopravvivono a un cambio di mappa o a finestre/proiezioni di dimensioni diverse. Il validatore è strict: ambientazioni con personaggi malformati (es. quelli stub M3 con solo `{id}`) verrebbero bocciate, ma le ambientazioni M3 reali avevano `personaggi: []` quindi sono compatibili.

### D-019 — Asset protocol Tauri abilitato, scope dinamico via custom command
`tauri.conf.json` abilita `app.security.assetProtocol = { enable: true, scope: [] }`; il feature `protocol-asset` è on in `Cargo.toml`. Lo scope è esteso a runtime: `allow_ambientazione_folder` (Rust) ora estende sia `fs_scope` sia `asset_protocol_scope` per la cartella scelta. Senza il feature, `convertFileSrc` ritornerebbe URL non navigabili dalla WebView e le immagini sarebbero invisibili silenziosamente.

### D-020 — Copia file immagini nella cartella ambientazione
Le immagini selezionate da dialog non sono solo *referenziate*: vengono **copiate** in `<ambientazione>/personaggi/<uuid>.<ext>` (per i personaggi) o `<ambientazione>/<mappa-uuid>.<ext>` (per le mappe). Motivo: l'ambientazione è autoconsistente — il conduttore può copiarla su una USB e riportarla altrove senza file mancanti. `copyFile` di `plugin-fs`; il dialog plugin già auto-autorizza il file scelto sia per fs che per asset protocol, quindi la copia funziona senza scope manuale extra. `fs:allow-copy-file` aggiunto in capabilities.

### D-021 — Palette curata di 12 colori (no picker libero)
Scelta confermata dall'utente in plan mode. Implementata in `src/lib/colori.ts`. UI del wizard mostra i 12 colori; quelli già usati da altri personaggi sono `disabled` con tooltip "(già usato)". Default = primo libero. Vincolo di unicità del colore garantito strutturalmente, niente validazione runtime extra (impossibile selezionarne uno duplicato).

### D-022 — Cerchietto = `object-fit: contain` + transform, NON `cover`
**Bug grosso scoperto dall'utente in M4**: con `object-fit: cover` sull'img dentro la maschera, i pixel fuori dalla parte centrale erano *già* croppati prima del transform → impossibile recuperarli con drag/pan. Cambiato a `contain` ovunque (Cerchietto, MaschereCircolare, preview wizard). Default iniziale del crop al momento del caricamento dell'immagine: zoom auto-calcolato come `max(W,H)/min(W,H)` (clamped a `[ZOOM_MIN, ZOOM_MAX]`) — così l'utente vede la faccia che riempie la maschera "come un Instagram crop" dal primo momento, ma con la libertà di zoomare fuori per recuperare i bordi.

### D-023 — Pan limit dinamico in funzione dello zoom
Il limite di pan iniziale `±1.5` era troppo restrittivo a zoom alti (non si arrivava ai bordi). Implementato `maxOffset(zoom) = max(1, (zoom-1)/2 + 0.5)`: a zoom 5x ammette ±2.5, a zoom 10x ±5.0. Su cambio di zoom (slider o wheel) gli offset vengono ri-clampati. Range zoom: **0.5x – 10x** (alzato da 4x → 5x → 10x su richiesta dell'utente in due iterazioni: alcuni avatar hanno aspect ratio > 4:1).

### D-024 — Evento `scena:update` con throttle rAF
`EVT.ambientazioneLoaded` rimosso; sostituito da `EVT.scenaUpdate` con payload `{folderPath, mappaPath, personaggi, nome}` — la proiezione ha tutto quello che le serve. L'emit dallo store è **rAF-throttled** (`requestAnimationFrame`): il drag fluido genera ~60 update/s in regia ma al massimo 1 emit/frame alla proiezione, evitando flooding del bus eventi. Lo stage all'arrivo di un nuovo `folderPath` riautorizza la cartella prima di renderizzare le immagini (necessario al primo apri dopo restart, dato che lo scope è in-memory).

### D-025 — Layout REGIA: toolbar + sidebar personaggi + area mappa scrollabile
`AmbientazioneAperta` rifatto da capo: toolbar in alto con nome + "Imposta mappa…" + "Proiezione a tutto schermo" + indicatore salvataggio + "Chiudi", sidebar `PannelloPersonaggi` a sinistra (lista con mini-cerchietto, menu ⋯ con rinomina/modifica ritaglio/cambia colore/elimina), area mappa al centro `overflow: auto` con la mappa a dimensione reale. Il pulsante "Rinomina (test M3)" è stato rimosso (non più necessario, ora ci sono modifiche reali).

### D-026 — Proiezione: matematica `object-fit: contain` manuale
La proiezione mostra la mappa con `object-fit: contain` (no crop, mai), ma i cerchietti devono essere posizionati nello spazio della mappa, non dell'intera finestra. Helper `rettangoloContain` in `src/lib/scena.ts` calcola il rettangolo effettivo della mappa contenuta; i cerchietti sono `position: absolute` con `left/top` ricavati da `posizione.{x,y}` × rettangolo. ResizeObserver aggiorna il rettangolo se la finestra cambia size (es. fullscreen toggle).

### D-027 — Fullscreen proiezione: pulsante in regia + ESC sullo stage
Implementata richiesta utente "tipo F11 sul browser". Tauri v2: `WebviewWindow.getByLabel("stage").setFullscreen(bool)`. Bottone toggle nella toolbar regia ("Proiezione a tutto schermo" / "Esci da tutto schermo"). Listener `keydown` su stage esce con ESC. Permessi aggiunti: `core:window:allow-set-fullscreen`, `core:window:allow-is-fullscreen`. Lo stato del bottone è sincronizzato a mount via `isFullscreen()`.

### D-028 — Dimensioni cerchietti: 68 (regia mappa), 77 (proiezione)
Iniziali 56/64; bumpate del +20% su richiesta utente (visibilità migliore per il pubblico). Bordo cerchietto: `max(3, round(dim*0.14))` (raddoppiato da 0.07 → 0.14, sempre su richiesta utente). Numeri non configurabili da UI, da rivedere se in futuro emerge la necessità di cerchietti più/meno grandi a seconda dell'ambientazione.

### D-029 — Editor ritaglio post-creazione (modifica)
Nuovo modale `EditorRitaglioPersonaggio` aperto dal menu ⋯ ("Modifica ritaglio…"). Riapre `MaschereCircolare` sull'immagine già copiata nella cartella, salva il nuovo `crop` nel manifest. L'immagine sorgente non viene ricopiata (il file resta lo stesso). Cambiare immagine sorgente di un personaggio esistente NON è ancora supportato (richiederebbe un'altra UI; eventualmente in milestone successiva se serve).

### Punti di attenzione risolti / aperti
- **§9.2 (drag fluido su WebKitGTK Ubuntu)**: drag throttled via rAF, performance ottime sulla macchina di sviluppo Ubuntu 24.04. Niente scattosità rilevata. Per ora non serve passare a `requestAnimationFrame` con rotazione manuale come piano B suggeriva.
- **§9.4 (fullscreen secondo monitor)**: la finestra proiezione viene posizionata manualmente dall'utente sul secondo monitor, poi messa fullscreen via il bottone in regia. Funziona senza API di posizionamento programmatico.
- StrictMode in dev: il primo wizard aveva un `useEffect` che apriva il file picker on-mount, ma StrictMode lo eseguiva 2x → file picker doppio. Rimosso l'auto-open: ora step 1 mostra un bottone "Scegli immagine…" che l'utente clicca esplicitamente. UX più chiara, niente bug.

### Verificato
- `npx tsc --noEmit` + `npx vite build` clean.
- `cargo check` clean (con feature `protocol-asset`).
- `tauri dev`: mappa load OK (con copia in folder), wizard 3-step OK con palette + crop pan/zoom 10x, drag personaggi smooth con sync proiezione in tempo reale, edit ritaglio OK, fullscreen toggle OK (button regia + ESC stage), persistenza OK cross-restart. Confermato visivamente dall'utente in 5+ cicli di feedback.

---

## M5 — Oggetti + assegnazione 1-a-1 (2026-05-27)

### D-030 — Vincolo 1-a-1: un personaggio ha al massimo un oggetto
Scelta esplicita dell'utente in fase di plan, più stretta dello spec §4.3 (che ammetteva "più oggetti attaccati"). `Personaggio.oggettoId: string | null` invece di un array. Vantaggi: UI molto più semplice (niente layout di più oggetti attorno al cerchio, §10.2 superato), nessuna ambiguità su quale oggetto fa da modificatore nella ruota M6. Limita anche le interazioni ai casi che il conduttore davvero gestirà dal vivo. Se in futuro emerge la necessità di multi-oggetto, si torna a un array con migrazione di schema.

### D-031 — Vincolo anche all'inverso: un oggetto su un solo personaggio
`assegnaOggettoAPersonaggio(persId, oggId)` libera automaticamente l'eventuale precedente proprietario dell'oggetto. Riassegnazione = trasferimento (no clonazione). Rende l'oggetto un'entità "fisica" del mondo, non solo una statistica. UX: in "Oggetto" del menu ⋯ del personaggio target, l'oggetto già assegnato a un altro è visibile con etichetta "(di Anna)" — riassegnare non richiede conferma esplicita (è una scelta consapevole del conduttore).

### D-032 — Validazione referenziale "guaritrice", non bocciante
`Personaggio.oggettoId` che punta a un id inesistente (es. oggetto eliminato fuori-app, file editato a mano) viene ripulito a `null` durante la validazione del manifest, **senza errore**. Motivo: meglio aprire un'ambientazione lievemente "amnesica" che bloccare il conduttore davanti a un crash. Compat: `Personaggio` senza `oggettoId` (manifest M4) viene letto come `oggettoId: null` — niente migrazione di schema.

### D-033 — Forma visiva degli oggetti: quadratino con angoli arrotondati
Componente `Quadratino` (`src/components/`) speculare a `Cerchietto` ma `border-radius: 22%`. Stesso modello crop (object-fit: contain + transform), stesso bordo proporzionale. **Niente colore proprio**: bordo grigio neutro (`#3a3a3c`). Gli oggetti si distinguono dai personaggi per forma, non per colore. Posizione nella scena: in basso-a-destra del cerchietto, in diagonale 45°, con sovrapposizione leggera (angolo top-left del quadratino dentro al cerchietto al 10% del raggio, poi spostato di -10px su entrambi gli assi per affinamento visivo richiesto dall'utente).

### D-034 — Riuso `MaschereCircolare` per il crop degli oggetti
Anche se l'oggetto finale è un quadratino, il crop UI nel wizard usa la stessa maschera circolare dei personaggi. La differenza visiva di angoli arrotondati vs cerchio in fase di pan/zoom è trascurabile, e duplicare la componente non avrebbe valore. La preview "finale" dell'oggetto (es. nella sidebar dopo creazione) è col quadratino vero.

### D-035 — `EditorRitaglio` generalizzato (rinominato)
`EditorRitaglioPersonaggio` → `EditorRitaglio` con props `{nome, imgPath, cropIniziale, colore?, folderPath, callbacks}`. Funziona sia per personaggi (con colore del bordo) che per oggetti (colore neutro). Niente specializzazione superflua.

### D-036 — Wizard oggetto: 2 step (vs 3 del personaggio)
`WizardOggetto.tsx` ha "Immagine" + "Ritaglio e nome". Nome inline nel passo crop perché non c'è palette colori da mostrare separatamente. Stesso auto-zoom iniziale al caricamento (cover-like) e stesso clamp pan dinamico.

### D-037 — Sidebar a due sezioni: Personaggi + Oggetti
`PannelloPersonaggi` ora è un container thin di `SezionePersonaggi` e `SezioneOggetti`, ognuna `flex: 1` con header sticky e lista scrollabile indipendente. Larghezza sidebar bumpata da 260 a 280px per accogliere il contenuto leggermente più denso. Ho mantenuto il filename `PannelloPersonaggi.tsx` per evitare un rename invasivo cross-file.

### D-038 — Assegnazione oggetto dal menu ⋯ del personaggio
L'azione di assegnazione vive sul personaggio, non sull'oggetto. Motivo dell'utente: "è un'azione che farei nella finestra NON proiettata" — concettualmente è il regista che dà l'oggetto al personaggio, non l'oggetto che cerca un proprietario. Menu ⋯ del personaggio in coda alle altre voci: sezione "Oggetto" con lista di tutti gli oggetti (mini-quadratini), etichetta "(di Anna)" per quelli già assegnati, voce "Nessuno (rimuovi oggetto)" se il personaggio ne ha uno. Niente drag-and-drop oggetto → cerchietto (esplicitamente scartato dall'utente).

### D-039 — Cerchietti +50%, posizione quadratino raffinata in iterazioni
Cerchietto regia: 68 → 102px. Cerchietto proiezione: 77 → 116px. Quadratino: 80% del cerchietto (82/93px). Bordi raddoppiati restano `dim * 0.14`. Il quadratino è posizionato lungo la diagonale bottom-right del cerchietto: la formula iniziale aveva il quadratino col centro proprio sul bordo del cerchietto → metà invadeva il volto. Refactor in due iterazioni: prima formula geometrica (angolo top-left del quadratino al 90% del raggio dal centro del cerchietto), poi offset manuale `-10, -10` per affinamento estetico. Risultato finale: leggera sovrapposizione angolare percepita come "giusta" dall'utente.

### Verificato
- `npx tsc --noEmit` + `npx vite build` clean.
- `tauri dev`: creazione oggetto OK, assegnazione/riassegnazione/distacco dal menu ⋯ OK, quadratino renderizzato in basso-a-destra del cerchietto con sovrapposizione minima sia in regia che in proiezione, drag del personaggio porta dietro il quadratino senza glitch, eliminazione oggetto/personaggio con detach automatico, persistenza cross-restart OK (incluse ambientazioni M4 senza `oggettoId`).

---

## M6 — Ruota della fortuna (2026-05-27)

### D-040 — Regola modificatori `+1`/`+2`: incremento ASSOLUTO, non proporzionale
CLAUDE.md §5.2 specificava "+20% della fetta originale". L'utente in fase di test ha precisato che voleva l'incremento assoluto: **+1 = +0.20 (20 punti percentuali) aggiunti alla baseFrazione, +2 = +0.40**. Quindi per 2 personaggi 50/50, un +1 dà raw 0.7/0.5 → normalizzato 58.3%/41.7% (e non 54.5%/45.5% come darebbe l'interpretazione "+20% di 50%"). Deviazione esplicita dalla spec, documentata in `src/lib/ruota.ts`.

### D-041 — Math isolata e pure functions in `src/lib/ruota.ts`
`calcolaFette`, `scegliVincitorePesato`, `angoloDiArresto` sono pure functions, niente DOM, testabili dalla devtools console. Convenzione angolare: 0° = top, senso orario (coerente con CSS rotate). `angoloDiArresto` aggiunge `K × 360°` di "spin pieno" per visualizzare la rotazione (K=6 default). Il margine di 10% sul bordo della fetta vincente evita di fermarsi sui confini.

### D-042 — Conflitto come store separato + provider pattern per emit
`conflittoStore` indipendente dall'`ambientazioneStore`: il conflitto è effimero, non tocca il manifest. Per evitare import circolari nell'emit verso la proiezione, `ambientazioneStore.payloadCorrente()` chiama un provider registrato da `conflittoStore` al module load (`registraConflittoSnapshotProvider`). Lo stage decide cosa mostrare da `payload.conflitto !== null`.

### D-043 — Fase "pronto" per ruota ferma sulla proiezione
Spec §5 voleva la ruota apparire "quando lanciata", ma l'utente ha chiesto di vederla anche prima dello spin (con scoreboard) per dare anticipazione al pubblico. Aggiunta `fase "pronto"` (separata da `"setup"`) che entra quando il regista clicca "Avanti" da Step 2: la proiezione mostra la ruota statica + scoreboard. Click "Gira" → fase girando. `tornaSetup()` per andare Indietro e cambiare modificatori (pulisce la ruota dalla proiezione).

### D-044 — Snapshot immutabile in `snapshotPartecipanti` per consistenza durante lo spin
Quando il conflitto entra in pronto/girando, le info dei partecipanti (nome, colore, imgPath, crop) sono copiate dentro `ConflittoSnapshot.partecipanti`. Se il regista rinomina/cambia colore/elimina un personaggio durante l'animazione, la ruota mostra ancora lo stato consistente al momento dello spin. CLAUDE.md §10.5 "ricalcolo" applicato solo in fase setup.

### D-045 — Render ruota: SVG + clipPath user-space per facce, gradient pointer
- Slices: `<path>` con `arcPath` calcolato a runtime (no librerie SVG).
- Facce personaggio: `<image>` con `preserveAspectRatio="xMidYMid meet"` (NON `slice` — altrimenti il crop calcolato per `contain` doppia lo zoom), `clipPath` user-space con `<circle>` alla posizione assoluta della faccia. Una clipPath per fetta (definita inside l'<g> rotante in `<defs>` per ruotare con la ruota).
- Bonus oggetto: stesso pattern con `<rect rx=22%>`.
- **Pointer**: linear gradient bianco→argento, drop-shadow SVG via `<filter>` con `<feGaussianBlur>` + `<feOffset>`. Forma a slim teardrop.
- Vincitore: drop-shadow filter via CSS (bianco + giallo) per glow.

### D-046 — Animazione spin: CSS transition + double rAF
Per attivare la CSS transition al primo render, doppio `requestAnimationFrame` tra mount con `angoloFinale=0` e set a `angoloFinale` reale. Senza, il browser commit lo stato finale subito e nessuna transition fires. Total 5s, `cubic-bezier(0.17, 0.67, 0.32, 1)` (lieve accelerazione, lunga decelerazione fluida). `onTransitionEnd` filtrato per `propertyName === "transform"` (SVG può propagare altri eventi).

### D-047 — Bonus visivo come "estensione", non come fetta separata
Su feedback utente: la fetta totale (base + bonus) renderizzata come **un solo path**, niente separatore bianco interno. Una linea sottile semi-trasparente `rgba(255,255,255,0.55)` strokeWidth `0.35` segna il confine base/bonus senza spezzare visivamente la fetta. Il bonus appare come "aggiunta" alla metà ruota, non come terzo slice.

### D-048 — Testo bonus radiale + adattivo
Testo lungo il raggio (rotate `midAngolo - 90`, flip 180° per metà sinistra). `textLength` + `lengthAdjust="spacingAndGlyphs"` forza il fit nello spazio disponibile (rInizio=12, rFine=R-3). Font size calcolato (~lunghezza/0.55 × N char), clamp [2.5, 9]. Truncate `…` oltre 28 char.

### D-049 — Sorgente modificatore: scelta manuale + filtraggio all'oggetto attaccato
Per ogni partecipante:
- Radio `Nessuno / +1 / +2`.
- Se mod ≠ Nessuno: radio `Oggetto / Descrizione libera`. Il radio "Oggetto" mostra direttamente il nome dell'oggetto attaccato al personaggio (selezione singola, no dropdown), disabilitato se il personaggio non ha oggetti. "Descrizione libera" = input testuale max 40 char.
- L'utente in pronto/spin può vedere la fonte renderizzata nella sotto-fetta (icona oggetto o testo radiale).

### D-050 — Deroga audio: tick sonoro durante lo spin (eccezione a CLAUDE.md §0)
**§0 vieta esplicitamente audio**. L'utente ha confermato in M6 di volere un tick alla traversata dei confini delle sotto-regioni. Implementato con **Web Audio API** sintetizzato in-process (niente file MP3, niente routing custom — il volume va al mixer dell'OS): triangolare 950Hz, attack 4ms, release 40ms, ampiezza 0.22. Suonato **solo dalla regia** (`suonaTick={true}` nel `PannelloConflitto`, `false` nello stage) per autoplay: l'utente ha cliccato "Gira" → user gesture valido per attivare AudioContext. Lo stage non riceve user input → AudioContext sarebbe suspended. Documentato qui come deroga consapevole.

### D-051 — Wobble freccia: keyed remount + CSS animation (NON Web Animations API)
Pattern usato: `<g key={wobbleCount}>` con classe `puntaWobble` (CSS @keyframes 150ms ease-out, 0° → -11° → 0°). Ad ogni tick, `setWobbleCount(c+1)` cambia la key → React rimonta il g → l'animazione CSS riparte da capo. WAAPI con `element.animate()` su SVG path NON funzionava in modo affidabile su WebKitGTK (`transform-box: fill-box` non rispettato). `transform-origin` in user-space SVG coords `50px 1.5px` direttamente sull'elemento. Wobble attivo su ENTRAMBE le finestre (regia + proiezione) — separato dal sound che resta solo regia.

### D-052 — Scoreboard sulla proiezione
Sopra la ruota nel layout della proiezione: riga di card per ogni partecipante con cerchietto-faccia (~110px), nome (1.5rem), percentuale grande (~2.2rem bold) nel colore del personaggio. Card vincitrice ha bordo personaggio + glow giallo dopo lo spin. Layout: flex row centrata, gap 2rem. La ruota sotto è scalata a `min(0.72*innerWidth, 0.7*innerHeight)` per fare spazio.

### D-053 — Scena sempre montata + Ruota in overlay (proiezione)
Prima versione: `if (conflict) return <Ruota>; else return <Scena>;`. Problema: `<Scena>` unmounta/remonta perdendo `imgDim` → personaggi sparivano dalla mappa al ritorno (fix #3 ultimo round). Soluzione: **Scena sempre montata**, Ruota in `<div position:fixed inset:0>` overlay quando il conflitto è attivo. Più safety: `useEffect` extra in Scena/AreaMappa che ricava `imgDim` da `img.complete + naturalWidth` se per qualche motivo è ancora null (cache, race fullscreen toggle).

### §10 spec, stato finale
- §10.1 (resa fetta incremento): risolta con sotto-fetta inline (D-047) + tick visivo D-051.
- §10.2 (multi-oggetto): superata da M5 (vincolo 1-a-1).
- §10.3 (autosave): risolta in M3.
- §10.4 (storico esiti): nessuno storico, conferma manuale. Documentato qui esplicitamente.
- §10.5 (eliminazione personaggio in conflitto): cleanup automatico in setup (subscribe in conflittoStore), snapshot freeze in pronto/girando/risultato (D-044).

### Verificato
- `npx tsc --noEmit` + `npx vite build` clean.
- `tauri dev`: ruota in regia ferma + scoreboard, click "Gira" → animazione 5s con decelerazione naturale, suono tick alle sotto-regioni, wobble della freccia in sync, vincitore evidenziato con glow + scoreboard card highlighted. Proiezione mostra tutto sincronizzato. "Chiudi e torna alla mappa" riporta alla mappa con personaggi visibili (no flicker). Confermato visivamente dall'utente in 8+ cicli di feedback iterativo.

---

## M8.1 — Timer in proiezione gestito dalla regia (2026-05-27)

### D-054 — Timer effimero (non persistito)
Il timer non viene salvato nel manifest `ambientazione.json`. Vive solo in memoria nel `timerStore`. Sopravvive al cambio di mappa/ambientazione (lo store è top-level) ma muore alla chiusura dell'app. Scelta: la durata configurata e lo stato di esecuzione sono "live state" di una partita, non parte dell'ambientazione stessa.

### D-055 — Modello "epoch ms" per evitare drift
Il timerStore tiene `targetEndAt: number | null` (epoch ms quando running) e `pausedRemainingMs: number` (ms residui congelati in pausa). Il display calcola `remainingMs = targetEndAt - Date.now()` in real-time, niente `setInterval` che decrementa un contatore — drift zero anche su sleep/wake del laptop. Provider pattern verso `ambientazioneStore.payloadCorrente` come `conflittoStore` (no import circolari).

### D-056 — Stati: idle / running / paused / ended
Quattro stati netti. `start()` da idle → running; da paused → resume (alias). `pause()` da running → paused. `reset()` torna a idle conservando `durationSec`. `markEnded()` chiamato dal display in regia quando `remaining ≤ 0` in fase running. Modifiche a `durationSec` consentite solo in idle/ended (UI disabilita gli input in running/paused).

### D-057 — Banner sulla proiezione, no in idle, no durante conflitto
- `idle`: banner nascosto → proiezione pulita finché il regista non tocca il timer.
- `running/paused/ended`: banner visibile in alto al centro, `position: fixed; z-index: 1500` (sopra il wheel overlay z-index 1000 sarebbe stato — ma vedi sotto).
- **Durante conflitto**: banner **nascosto** per scelta utente (richiesta esplicita M8.1). La scena ruota è una "sequenza speciale" che non deve essere distratta dal timer. Il timer continua a contare in background (audio incluso) — solo la visibilità sulla proiezione cambia. Implementato come `{!mostraRuota && <DisplayTimer …>}`.

### D-058 — Pannello regia compatto in toolbar
Widget integrato nella toolbar di `AmbientazioneAperta` tra "Conflitto" e `IndicatoreSalvataggio`. Layout orizzontale: display mm:ss + Start/Pausa/Riprendi (toggle che cambia label e colore) + Reset + due input `number` per min/sec. Input disabilitati quando running/paused (visivamente grigi + tooltip). `setInterval(200ms)` per il display locale in regia (più rapido del 100ms del DisplayTimer perché l'utente vede direttamente il widget e percepisce la fluidità).

### D-059 — Audio: 1-min warning + scaduto intermittente (deroga §0 estesa)
Estensione esplicita della deroga audio (D-050 / M6) confermata dall'utente:
- **1-min warning**: beep lungo (~500ms, 620Hz sine, gain 0.3) UNA volta quando `running` passa sotto i 60s. Tracking via `useRef` resettato a ogni transizione fuori da `running`.
- **Scaduto**: beep breve (~180ms, 820Hz square, gain 0.32) subito allo `stato === "ended"`, poi ogni 2s tramite `setInterval(2000)` finché `ended` rimane. Cleanup su transizione di stato.

Entrambi suonati **SOLO dalla regia** (PannelloTimer è regia-only). Sintesi Web Audio API in-process, niente file. Il regista ha cliccato "Avvia" → user gesture valido per attivare AudioContext.

### Verificato
- `npx tsc --noEmit` clean.
- `tauri dev`: avvio/pausa/riprendi/reset OK, cambio durata OK con disable in running, banner visibile in proiezione tranne in idle e durante conflitto, beep lungo a 60s, beep intermittente da 00:00. Confermato visivamente dall'utente.

---

## M8.2 — Posizioni iniziali dei personaggi (2026-05-27)

### D-060 — `posizioneIniziale` campo opzionale nel manifest
Aggiunto `Personaggio.posizioneIniziale: Posizione | null` (default null). Validator accetta `undefined` o `null` su lettura → manifest M5/M6 esistenti restano validi (compat naturale, niente schema bump).

### D-061 — Solo controllo globale, no per-personaggio
Su feedback utente (prima iterazione M8.2 aveva entrambi): tolte le voci dal menu ⋯ del personaggio. **L'unico controllo è in toolbar**: dropdown "Posizioni ▾" con "Salva tutte come iniziali" e "Ripristina tutte alle iniziali". Le azioni store per-personaggio (`salvaPosizioneInizialePersonaggio` ecc.) restano nello store ma non sono più esposte in UI.

### D-062 — Apertura ambientazione resetta automaticamente alle iniziali
Su feedback utente: aprire l'ambientazione deve riportare TUTTI i personaggi alle loro posizioni iniziali (se ce le hanno). Implementato in `apri()`: dopo il load del manifest, mutazione in-memory di `posizione = posizioneIniziale` per chi ne ha una. `saveStatus` resta `"saved"` → niente autosave forzato, l'on-disk resta intatto con le "ultime posizioni" finché l'utente non sposta davvero qualcuno. Idempotente: se nessuno tocca niente, l'on-disk non cambia mai. Se l'utente sposta, autosave salva le posizioni nuove come "ultime" — sostituite di nuovo alla prossima apertura.

Effetto pratico: ogni "sessione" della partita parte sempre dalla situazione di setup, indipendentemente da dove sono finiti i personaggi alla fine della sessione precedente.

### Verificato
- Compat: aperto ambientazione M6 (senza `posizioneIniziale`) → letta come null, niente errore.
- Salva tutte → autosave fa scrivere il campo nel manifest. Chiudi/riapri → personaggi nelle iniziali.
- Sposta + chiudi + riapri → personaggi tornano alle iniziali (non alle "ultime"). Confermato dall'utente.

---

## M8.3 — Leaderboard finale con 3 obiettivi + podio (2026-05-27)

### D-063 — `obiettivi: [string, string, string]` nel manifest
Aggiunto al manifest dell'Ambientazione. Default `["", "", ""]`. Compat naturale (manifest M5-M8.2 senza il campo → letti come default). Editabili dalla regia tramite la sezione obiettivi del pannello leaderboard; persistiti con autosave standard.

### D-064 — Terzo obiettivo come MALUS (−1 sul totale)
Su richiesta utente in iterazione UX: il 3° obiettivo non somma, **sottrae** dal totale. Math: `totale = (t[0] ? 1 : 0) + (t[1] ? 1 : 0) - (t[2] ? 1 : 0)`. Range possibile: −1..+2. Visualmente:
- Label "Malus" (no badge "−1" — toglie chiarezza visiva, il colore basta).
- Header colonna in rosso.
- Cella attiva: sfondo rosso + simbolo **✗** rosso (non ✓).
- Numero totale in rosso se < 0.

### D-065 — Leaderboard effimera (come ruota)
`leaderboardStore` con snapshot dei personaggi al momento di `apri()` (consistenza se l'utente modifica il manifest durante la leaderboard). `tick: Record<id, [bool, bool, bool]>` mutabile, NON persistito. Su `chiudi()` tutto svuotato. Provider pattern verso `ambientazioneStore.payloadCorrente` come `conflittoSnapshotProvider`.

### D-066 — Mutua esclusione con conflitto
Leaderboard e Ruota sono entrambe overlay full-screen sulla proiezione (z-index 1000). Mutua esclusione gestita dai bottoni regia: "Conflitto" disabled se leaderboard aperta e viceversa. Il banner timer viene nascosto in proiezione durante entrambi i casi overlay (`!mostraRuota && !mostraLeaderboard`).

### D-067 — Tabella in regia con ordine fisso + Podio ordinato sotto
Su feedback utente in iterazione: la tabella mostra le righe in ordine di creazione (stabile, evita jumps durante i tick). **Sotto** la tabella, su entrambi gli schermi, un nuovo componente `ClassificaPodio` mostra una riga orizzontale di cerchietti ordinati per totale desc. Tie-break per ordine d'inserimento (stable sort).

### D-068 — Vincitori (anche multipli): corona + alone dorato
Sul podio, i personaggi con `totale === maxTotale` ricevono:
- Emoji 👑 sopra il cerchietto (CSS animation "coronaIn" 400ms ease-out su entrata).
- Drop-shadow giallo-oro a tre livelli sul cerchietto stesso (`drop-shadow(0 0 10px) (0 0 22px) (0 0 36px)`).
- `translateY(-4px)` per "alzare" leggermente il vincitore.

Più vincitori in parità → tutti ricevono il trattamento.

### D-069 — Dimensioni font proporzionali al cerchietto
`ClassificaPodio` è riutilizzato in regia (cerchietto 64px) e proiezione (cerchietto 140px). I font (nome, punteggio, corona) sono calcolati inline come frazioni della `dimensioneCerchietto` → look identico, dimensioni scalate. Evita media query complesse.

### Verificato
- `npx tsc --noEmit` clean.
- `tauri dev`: bottone "Leaderboard" in toolbar regia, modale full-screen con sezione obiettivi editabili (autosave) + tabella tick + podio. Proiezione mostra tabella + podio sincronizzati. Click su cella malus → ✗ rossa, totale aggiornato (-1). Podio si riordina in tempo reale, vincitore con corona + alone dorato (anche in parità). Mutua esclusione con conflitto verificata. Confermato dall'utente.

---

## M12 — Fix post-test su proiettore reale (2026-05-31)

Problemi riscontrati provando il build su uno schermo da ~100": elementi troppo
piccoli, timer "a scatti", suoni di gioco muti nel build (ma presenti in dev).

### D-070 — Dimensioni scalate, non in pixel fissi
Cerchietti, timer e leaderboard usavano valori in px fissi (o `clamp()` con
`max` troppo bassi): su un proiettore ad alta risoluzione risultavano minuscoli.
- **Cerchietti in proiezione** (`Scena.tsx`): diametro = `FRAZIONE_CERCHIETTO`
  (0.085) × lato maggiore della mappa renderizzata. Scalano con la mappa/schermo.
  Il "rientro" del quadratino oggetto, prima `-10px` fisso, è ora proporzionale.
  La regia (`AreaMappa`) resta in px: è solo l'anteprima di controllo, le
  posizioni sono relative quindi il mismatch di dimensione non rompe nulla.
- **Timer** (`DisplayTimer.module.css`): `clamp(3rem, 11vmin, 22rem)` (era
  `clamp(3rem, 8vw, 6rem)` → il max 6rem bloccava la crescita).
- **Leaderboard** (`ScenaLeaderboard`): cerchietti = frazione di `vmin` via
  nuovo hook `useViewport`; font/box in CSS passati a `vmin` con max più alti.

### D-071 — Sblocco audio al primo gesto (fix suoni muti nel build)
I suoni sintetizzati (tick ruota, campanello/sveglia timer) erano muti nel build
ma funzionavano in dev. Causa: nel WebView di produzione l'`AudioContext` nasce
`suspended` e `resume()` chiamata da un timer/effetto (fuori dallo stack di un
gesto utente) viene ignorata dalla policy autoplay. La sintesi Web Audio NON usa
codec/GStreamer, quindi non era un problema di formato.
Fix: modulo unico `lib/audio.ts` con un solo `AudioContext` condiviso, sbloccato
al primo `pointerdown`/`keydown` nella regia (`abilitaAudioAlPrimoGesto`,
agganciato in `control/App.tsx`). `Ruota` e `PannelloTimer` ora importano da qui.

### D-072 — Suono "Via!" all'avvio del timer
Nuovo `playInizioTimer` (due note ascendenti). Suona quando il timer entra in
`running` (da idle o ripresa), per segnalare a tutti che il tempo scorre.

### D-073 — Timer fluido in proiezione (no più "scatti")
La finestra proiezione non ha il focus → WebKitGTK throttla i suoi
`setInterval` (causa dello scatto ogni ~secondi). Fix combinato:
- `DisplayTimer` usa `requestAnimationFrame` per spingere i ridisegni e
  ricalcola il residuo da `Date.now()` a ogni render (non da uno stato `now`
  potenzialmente vecchio).
- La regia (a fuoco, non throttlata) ri-emette lo stato 1 volta/sec mentre il
  timer scorre (`PannelloTimer`), garantendo l'aggiornamento anche se il rAF
  della proiezione venisse rallentato. Lo `stage` autorizza la cartella solo al
  cambio di path, per non lanciare un invoke Tauri ogni secondo.

### Verificato
- `npx tsc --noEmit` clean; `npm run build` ok.
- Da validare sul proiettore reale al prossimo test dell'utente.

## M13 — Audio definitivo + rifiniture ruota/leaderboard (2026-05-31)

Iterazione dopo i test su PC reale. La parte audio di M12 (sintesi Web Audio API)
è SUPERATA: in produzione (WebKitGTK) l'uscita Web Audio è muta.

### D-074 — Beep timer come file MP3 via blob (non Web Audio)
Web Audio = muto nel build; funziona solo la riproduzione di file media, e in
particolare da `blob:` in memoria (il protocollo dell'app non risponde alle
Range request dei media element → play fallisce). I beep timer (inizio/1-min/
scaduto) sono MP3 sintetizzati offline (`scripts/gen_suoni.py`, in
`src/assets/suoni/`, versionati via eccezione in `.gitignore`), caricati con
`fetch → Blob → objectURL`, e sbloccati al primo gesto utente
(`lib/audio.ts::abilitaAudioAlPrimoGesto`). Nuovo suono "Via!" all'avvio del timer.

### D-075 — Tick ruota: AUDIO NATIVO (Rust/rodio), non webview
L'audio del webview ha latenza alta e VARIABILE → i tick andavano sempre fuori
sync (tentati: tick per-attraversamento, treno WAV pre-renderizzato, gating
sull'evento 'playing', compensazione latenza misurata — tutti insoddisfacenti).
Soluzione: i tick passano dal backend. Un thread Rust possiede l'`OutputStream`
di `rodio` e suona un click sintetizzato a ogni comando `play_tick` (Tauri
command; mittente `mpsc` in `Mutex` nello state). Il frontend chiama `play_tick`
sull'attraversamento REALE rilevato a schermo (`Ruota.tsx`, rAF su
`getComputedStyle.transform`) → latenza bassa e costante, click in sync col
passaggio della freccia. Dipendenza build su Linux: `libasound2-dev` (ALSA).
`rodio` con `default-features = false` (sintetizziamo i campioni, niente decoder).

### D-076 — Timer fluido in proiezione
`DisplayTimer` ricalcola il residuo da `Date.now()` a ogni render (rAF) e la
regia ri-emette lo stato a ~4 Hz mentre scorre (la finestra proiezione non a
fuoco subisce throttling dei timer locali da WebKitGTK).

### D-077 — Cerchietti: stessa dimensione relativa su regia e proiezione
Frazione condivisa `FRAZIONE_CERCHIETTO = 0.072` del lato maggiore della mappa
renderizzata (`lib/scena.ts`), usata identica da `AreaMappa` (regia) e `Scena`
(proiezione). Timer e leaderboard scalati in `vmin` con cap alti (prima i `max`
dei `clamp()` li tenevano piccoli su schermi grandi). Podio leaderboard: rimossi
i nomi sotto i cerchietti (restano in tabella).

### Verificato
- `npx tsc --noEmit` clean; `npm run tauri build` ok (rodio/cpal compilati).
- Su PC: tick ruota in sync e affidabili (confermato dall'utente). Beep timer
  udibili nel build. Dimensioni dinamiche ok.

---

## M13 — Annotazioni sulla mappa (simboli emoji + testo) (2026-06-01)

### D-078 — Annotazioni: simboli emoji + etichette di testo, posizionabili e ridimensionabili
Richiesta dell'utente: durante una sessione dal vivo serviva segnare sulla mappa
una zona resa inaccessibile da una scelta di gioco, ma non c'era modo di farlo.
Nuovo tipo `Annotazione { id, tipo: "simbolo"|"testo", contenuto, posizione,
dimensione, colore }` in `lib/ambientazione.ts`. I **simboli sono emoji**
(nessun file immagine: scalano come testo, stesso approccio della soundboard);
lista in `lib/scena.ts::EMOJI_ANNOTAZIONI` (~15: 🚫 ⛔ ⚠️ ❌ ✅ frecce 🔥 💀 🚩 ⭐ 🔒 ❓).
`dimensione` è una **frazione del lato maggiore** della mappa renderizzata (come
`FRAZIONE_CERCHIETTO`), così `font-size = dimensione × latoMaggiore` è identico in
regia e proiezione (D-077). Disponibili **sia in edit sia in play** (il pulsante
in toolbar è gated solo su `mappaPath`), perché il bisogno nasce dal vivo.

### D-079 — Interazione: riuso del pattern drag dei personaggi + resize uniforme dal centro
Drag con PointerEvents + `setPointerCapture` + batching `requestAnimationFrame`,
stesso pattern di `AreaMappa` per i personaggi. Selezione tenuta **separata** da
quella dei personaggi (`annotazioneSelezionataId`): selezionare l'una deseleziona
l'altra, per non avere due handle attivi insieme. Resize tramite 4 maniglie
d'angolo: ridimensionamento **uniforme** (un solo scalare `dimensione`, niente
deformazione asimmetrica — adatto a emoji/testo), calcolato dal rapporto fra la
distanza puntatore↔centro corrente e quella iniziale. Componente display puro
condiviso `components/Annotazione.tsx` (come `Cerchietto`/`Quadratino`), usato
read-only in `Scena` (proiezione) e con overlay maniglie in `AreaMappa` (regia).

### D-080 — Persistenza nel manifest, retrocompatibile senza bump di schemaVersion
`annotazioni: Annotazione[]` aggiunto a `Ambientazione` e a `ScenaPayload`
(sync). Letto come **array opzionale** in `validaAmbientazione` (default `[]`):
le ambientazioni precedenti si aprono senza errori — stesso criterio usato per
`obiettivi`/`soundboard`, quindi `schemaVersion` resta 1. Le annotazioni
persistono (non sono temporanee) e si rimuovono a mano; il reset posizioni
iniziali non le tocca.

> NOTA: D-080 è stato **superato** da D-085 (gioco effimero): le annotazioni
> aggiunte in modalità "play" NON vengono più salvate; persistono solo quelle
> fatte in "edit". Vedi M14.

### Verificato
- `npx tsc --noEmit` clean; `npm run build` ok.

---

## M14 — Rifiniture annotazioni, gioco effimero, NPC (2026-06-01)

### D-081 — Annotazioni testo: doppio-click per modificare in-place, multilinea
Il testo si modifica con **doppio click direttamente sulla mappa** (textarea
inline in `AreaMappa`, stato `annotazioneInModificaId` nello store), non da una
barra esterna. Invio = a-capo (`white-space: pre`, multilinea es. "Cabina
chiusa\na chiave"); Esc/blur conferma. La bozza è locale e si committa solo
all'uscita: un testo vuoto elimina l'annotazione (un `contenuto` vuoto non è
salvabile — `validaAnnotazione` lo boccerebbe al caricamento).

### D-082 — Testo rosso fisso con bordo bianco; eliminazione con Canc
Colore del testo **non modificabile**: rosso acceso (`#ff2222`) con contorno
bianco 2px (`-webkit-text-stroke` + `paint-order: stroke fill`). Rimozione di
simbolo/testo selezionato con il tasto **Canc/Backspace** (listener globale in
`AreaMappa`, disattivato mentre si edita un testo o il focus è in un campo) —
niente più pulsante cestino. Pulsanti toolbar a ICONA: "T" per il testo, icona
immagine per il menu simboli; label "Soundboard:" sostituita dall'icona volume.

### D-085 — GIOCO EFFIMERO: in "play" non si salva nulla
Decisione del committente: una sessione di gioco non deve mai alterare lo
scenario salvato. `modifica()` marca "dirty" (→ autosave) **solo in modalità
"edit"**; in "play" aggiorna stato in memoria + proiezione ma NON scrive su
disco. Così spostamenti, oggetti e annotazioni fatti dal vivo sono effimeri:
riaprendo, lo scenario torna al setup. Supera D-080. Lo scenario permanente si
costruisce solo in "edit". (Causa del bug originale: l'autosave era globale e le
posizioni tornavano al setup solo se esisteva una `posizioneIniziale` salvata.)

### D-086 — Autosave robusto + flush alla chiusura
`useAutosave` ora ri-programma il salvataggio debounced a OGNI stato "dirty"
(non solo sul fronte saved→dirty) e si auto-recupera se monta con modifiche
pendenti → l'indicatore non resta più bloccato su "in attesa". `chiudi()` fa il
**flush** del salvataggio in sospeso prima di scartare lo stato (niente perdita
di modifiche chiudendo la sessione).

### D-087 — Personaggio NPC
Nuovo flag `npc: boolean` su `Personaggio` (opzionale, default `false` per
scenari precedenti). Gli NPC sono **esclusi dalla classifica/leaderboard**
(`leaderboardStore.apri` filtra `!p.npc`) ma restano **selezionabili nei
conflitti** (ruota, nessun filtro). Sulla mappa hanno il **bordo tratteggiato**:
disegnato come anello SVG con `stroke-dasharray` controllato (il `border: dashed`
CSS dava trattini enormi ~ allo spessore del bordo). `Cerchietto` ristrutturato
in wrapper non-ritagliato (anello + alone selezione) + cerchio interno ritagliato
(immagine). Checkbox NPC nel wizard di creazione e nel menu ⋯ del personaggio.

### Verificato
- `npx tsc --noEmit` clean; `npm run build` ok. Provato dal vivo dall'utente.

---

## Qualità — test, tooling, hardening (2026-06-05)

Intervento trasversale di qualità del repository, a **funzionalità invariata**.
Aree concordate con l'utente: test automatici, tooling & CI, sicurezza/robustezza,
refactor & performance (refactor moderati a comportamento invariato).

### D-088 — Test automatici con Vitest sulla logica pura
Introdotto **Vitest** (config dedicata `vitest.config.ts`, ambiente `node`) con
53 test, senza mock né dipendenze Tauri/DOM, sulla logica pura:
- `lib/ruota.ts` (wheel-math): rinormalizzazione fette, incrementi `+1`/`+2`
  assoluti **prima** della rinormalizzazione, vincitore pesato ai confini e in
  distribuzione, angolo di arresto dentro la fetta vincente. Copertura ~97%.
- `lib/scena.ts`, `lib/ambientazione.ts` (validazione + backward-compat D-032),
  `state/timerStore.ts` (`remainingMs`, `formatMmSs`).
Le funzioni accettavano già un `rand` iniettabile / erano deterministiche: nessun
cambiamento al codice di produzione per renderle testabili. Script: `npm test`,
`npm run coverage`.

### D-089 — ESLint (flat config) + Prettier
Aggiunti ESLint 9 (flat config: `typescript-eslint`, `react-hooks`,
`react-refresh`, `eslint-config-prettier`) e Prettier (`.prettierrc.json`).
Le regole **"React Compiler"** introdotte da `eslint-plugin-react-hooks` v7
(`purity` / `set-state-in-effect` / `refs`) sono declassate a **warning**:
segnalano pattern che in questo codice funzionano, e promuoverle a error
richiederebbe refactor di rendering fuori scope. `npm run lint` esce pulito
(0 error, alcuni warning informativi). Correzioni a basso rischio applicate:
`no-useless-escape` (rimosso `\/` ridondante in classi di caratteri) e una
assegnazione morta in `recents.ts`. Script: `lint`, `format`, `format:check`.

### D-090 — CI GitHub Actions
`.github/workflows/ci.yml`: job **frontend** (lint, format:check, tsc, test,
build) e job **Rust** (`cargo fmt --check`, `clippy -D warnings`, build) con le
dipendenze di sistema WebKitGTK/ALSA e cache di cargo/target. Trigger su push e
PR verso `main`.

### D-091 — Hardening Rust (avvio + autorizzazione cartelle)
- `allow_ambientazione_folder`: ora **valida** il percorso con
  `fs::canonicalize` (risolve symlink, normalizza, fallisce se inesistente) e
  richiede che sia una directory **prima** di allargare lo scope fs/asset. Per
  non rompere lo scope matching del front-end (che usa il path originale), si
  autorizzano sia il path originale sia quello canonico.
- `copia_dir_ricorsiva`: documentato che `DirEntry::file_type()` non segue i
  symlink → niente ricorsione ciclica.
- `run()`: niente `expect()`/panic muto in release — in caso di errore d'avvio
  logga su stderr ed esce con codice 1.

### D-092 — CSP: lasciata `null`, irrobustimento rinviato a verifica GUI
La spec di rischio (CLAUDE.md §9) e l'idea iniziale prevedevano una Content
Security Policy restrittiva. **Decisione: per ora `security.csp` resta `null`.**
Motivi:
1. Il worker di **pdf.js** è caricato come asset bundled e
   [Presentazione.tsx](../src/components/Presentazione.tsx) annota esplicitamente
   che funziona *grazie* a `csp:null`; una CSP errata può rompere il rendering
   del PDF. Anche immagini (asset protocol), audio (blob) e pagine PDF
   (canvas→blob) dipendono da scheme specifici.
2. L'app è **locale**: carica solo file locali e asset bundled, nessun contenuto
   remoto; le annotazioni di testo sono renderizzate da React (già escaped).
   La superficie XSS è quindi minima e il guadagno marginale.
3. Una CSP che tocca questi percorsi va **verificata dal vivo su Ubuntu**
   (proiezione + PDF + audio), cosa non possibile in CI/headless.
Candidato da testare quando si potrà provare la GUI:
`default-src 'self'; img-src 'self' asset: http://asset.localhost data: blob:;
media-src 'self' asset: http://asset.localhost blob:; script-src 'self' blob:;
worker-src 'self' blob:; style-src 'self' 'unsafe-inline';
connect-src 'self' ipc: http://ipc.localhost asset: http://asset.localhost`.
Se pdf.js richiedesse `'unsafe-eval'`, valutare se il beneficio residuo
giustifica l'eccezione o se restare su `null`.

### D-093 — Messaggi d'errore leggibili all'apertura scenario
`stringifyErr` in `SelezioneAmbientazione` riconosce `CartellaNonValida`,
`AmbientazioneCorrotta` e `IOError` e mostra un messaggio chiaro in italiano
(dettaglio tecnico tra parentesi). La UI già catturava e mostrava gli errori
senza bloccarsi: qui si migliora solo la comprensibilità per il conduttore.

### D-094 — DOMMatrix per l'angolo dello spin
In `Ruota.tsx` il parsing a regex di `getComputedStyle().transform` è sostituito
da `DOMMatrix` (gestisce `matrix`/`matrix3d`/`none`). L'angolo 2D resta
`atan2(b, a)`: wobble della freccia e tick audio invariati.

### D-095 — Estratto il registro snapshot-provider; split di PannelloConflitto NON fatto
Il wiring cross-store (provider di conflitto/timer/leaderboard/vittoria/
presentazione + `leggiSnapshot`) è estratto da `ambientazioneStore.ts` a
`state/snapshotProviders.ts`, separando il wiring dalla logica dello store; le
`registra*` sono ri-esportate da `ambientazioneStore` (API invariata). **Non**
si è spezzato `PannelloConflitto.tsx` (456 righe): dividere un componente
stateful (wizard a 3 step) non è verificabile senza GUI e il guadagno è solo di
conteggio righe — rischio sproporzionato per un tool usato dal vivo. Eventuale
follow-up quando si potrà provare la GUI.

### D-096 — Crash con audio multipli su WebKitGTK: dipendenza GStreamer + riuso elementi
**Sintomo:** avviando insieme più suoni (2 soundboard + sottofondo) l'**intera
app si chiudeva di colpo** su Ubuntu. **Causa:** mancava
`gstreamer1.0-plugins-bad`, che fornisce l'elemento `fakevideosink` usato da
WebKitGTK per i media **solo-audio**; senza, la pipeline GStreamer fallisce e il
WebProcess del webview crasha portando giù il processo Tauri. NON era un
problema di codec (`avdec_mp3`/`libav` erano presenti) né del codice applicativo.
**Interventi (riduzione del rischio a più livelli):**
1. Documentata la dipendenza runtime nei **prerequisiti del README**
   (`gstreamer1.0-plugins-good/-bad`, `gstreamer1.0-libav`) con la spiegazione
   del sintomo.
2. Dichiarata come **dipendenza del pacchetto** `.deb` in `tauri.conf.json`
   (`bundle.linux.deb.depends`): le installazioni finali la tirano in automatico,
   così l'utente non-tecnico non incontra il crash.
3. **Irrobustito il codice** della soundboard
   ([PannelloSoundboard.tsx](../src/control/views/PannelloSoundboard.tsx)): riusa
   un solo `HTMLAudioElement` per slot invece di crearne uno nuovo a ogni click,
   evitando l'accumulo di pipeline GStreamer (defense-in-depth, oltre al
   pacchetto). I beep del timer ([audio.ts](../src/lib/audio.ts)) già riusavano
   gli elementi.

### Verificato (intervento qualità)
- `npm test` (53 passati), `npm run coverage` (ruota.ts ~97%).
- `npm run lint` (0 error), `npm run format:check` pulito, `npx tsc --noEmit` ok,
  `npm run build` ok.
- `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo build` ok.
- NON verificato dal vivo via GUI (ambiente headless): le modifiche a
  comportamento invariato vanno riprovate dall'utente in una sessione reale
  (apertura scenario, ruota con `+1`/`+2`, PDF, audio, timer, leaderboard).
