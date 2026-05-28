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
