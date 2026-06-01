# GDR Teambuilding Tool

Strumento desktop per condurre **dal vivo** sessioni di gioco di ruolo (GDR) semplificato in contesti di **teambuilding aziendale**.

Il conduttore ("regista") usa un laptop collegato a un proiettore: su una finestra (la **Regia**) ha tutti i controlli; sull'altra (la **Proiezione**, a tutto schermo sul proiettore) il pubblico vede solo la mappa con i personaggi, la ruota della fortuna o la classifica finale.

> L'app è pensata per essere usata da una **persona non tecnica**: interfaccia tutta in italiano, autoesplicativa e tollerante agli errori.

---

## Funzionalità

- **Scenari (ambientazioni)** — ogni scenario è una cartella autoconsistente su disco (mappa + personaggi + oggetti + posizioni + impostazioni). Si può copiare su una USB e riaprire altrove senza file mancanti. Schermata iniziale con scenari recenti, "Nuovo" e scenari pre-installati.
- **Due modalità di apertura**:
  - **Modifica scenario** (*edit*) — si costruisce/aggiorna lo scenario; le modifiche vengono salvate (autosave).
  - **Conduci sessione** (*play*) — **gioco effimero**: spostamenti, oggetti e annotazioni fatti dal vivo NON vengono salvati. Riaprendo, lo scenario torna sempre al setup.
- **Mappa + personaggi** — sfondo a immagine; personaggi come cerchietti con la faccia ritagliata (pan/zoom manuale dentro una maschera circolare), bordo del colore del personaggio, drag & drop libero. Posizioni normalizzate, sincronizzate in tempo reale sulla proiezione.
- **Personaggi NPC** — bordo tratteggiato, esclusi dalla classifica ma selezionabili nei conflitti.
- **Oggetti** — quadratini con angoli arrotondati, assegnabili 1-a-1 a un personaggio (compaiono attaccati al cerchietto). Possono fare da modificatore nella ruota.
- **Ruota della fortuna** — risolve i conflitti al posto dei dadi: fette pesate per personaggio, modificatori `+1`/`+2` (da oggetto o da descrizione testuale), animazione con decelerazione naturale, estrazione coerente con le probabilità, scoreboard e vincitore evidenziato. Tick audio nativo in sync con la freccia.
- **Timer** — countdown mostrato sulla proiezione, gestito dalla regia. Suoni: "Via!" all'avvio, avviso a 1 minuto, allarme intermittente allo scadere.
- **Leaderboard finale** — 3 obiettivi (i primi due sommano, il terzo è un **malus** −1), tabella + podio con corona e alone dorato per i vincitori (anche in parità).
- **Annotazioni sulla mappa** — simboli emoji (🚫 ⛔ ⚠️ 🔥 …) ed etichette di testo, posizionabili e ridimensionabili. Disponibili anche dal vivo.
- **Soundboard + sottofondo** — pulsanti audio rapidi e musica di sottofondo (file caricati dall'utente).
- **Animazione di vittoria/premiazione** a tutto schermo con audio.
- **Fullscreen proiezione** — pulsante in regia per mettere a tutto schermo la finestra trascinata sul secondo monitor; ESC per uscire. Il cursore sparisce dopo qualche secondo di inattività.

> **Audio**: la spec originale escludeva l'audio, ma su richiesta del committente sono stati aggiunti effetti sonori (tick ruota, timer, soundboard, sottofondo, vittoria). Il volume è quello del mixer del sistema operativo — l'app non fa routing né selezione del dispositivo di uscita.

---

## Stack tecnologico

- **[Tauri v2](https://tauri.app/)** — app desktop cross-platform (Ubuntu, Windows, macOS). Usa la WebView del sistema, non impacchetta un browser → binario leggero.
- **React 19 + TypeScript + [Vite](https://vitejs.dev/)** — frontend, build multi-page (una entry HTML per finestra).
- **[Zustand](https://zustand-demo.pmnd.rs/)** — stato condiviso (source of truth nella Regia).
- **CSS Modules** — styling (niente Tailwind).
- **Backend Rust** — core Tauri + `rodio` per i tick audio nativi della ruota (bassa latenza costante).
- Plugin Tauri: **`fs`** (lettura/scrittura cartelle scenario) e **`dialog`** (selettori file/cartella nativi).

### Architettura a due finestre

Due finestre Tauri distinte, ognuna con il proprio entry HTML:

| Finestra | Label | Entry | Contenuto |
|----------|-------|-------|-----------|
| **Regia** | `control` | `control.html` | Tutti i controlli (caricamento asset, movimento personaggi, ruota, timer, leaderboard…) |
| **Proiezione** | `stage` | `stage.html` | Sola lettura: mappa + personaggi, oppure ruota / leaderboard / vittoria quando attive |

La Regia è la **source of truth**. A ogni modifica emette un evento (`emit`) che la Proiezione riceve (`listen`) e riflette in sola lettura — via **sistema di eventi nativo Tauri** (non `BroadcastChannel`, inaffidabile tra WebView separate). Gli aggiornamenti di scena sono throttled con `requestAnimationFrame` per un drag fluido senza inondare il bus eventi.

---

## Struttura del progetto

```
src/
  control/          # UI Regia (App, viste, wizard, pannelli)
    views/          #   pannelli: personaggi, oggetti, conflitto, timer, leaderboard, soundboard, annotazioni…
    components/     #   maschera circolare crop, indicatore salvataggio
  stage/            # UI Proiezione (sola lettura)
  components/        # componenti display condivisi: Cerchietto, Quadratino, Ruota, Annotazione, podio, animazione vittoria…
  state/            # store Zustand: ambientazione, conflitto, timer, leaderboard, vittoria + hook autosave
  lib/              # logica pura e utility: ruota-math, storage, eventi, scena, colori, audio, recents…
  assets/suoni/     # beep timer (MP3 sintetizzati offline, versionati)
src-tauri/          # core Rust, config finestre, capabilities, audio tick nativo
scenari-bundled/    # scenari "factory" pre-installati nel bundle (es. "Treno deragliato")
scripts/gen_suoni.py # rigenera i beep MP3 del timer
docs/DECISIONS.md   # log decisioni architetturali e deviazioni dalla spec
CLAUDE.md           # specifica autoriale del progetto
```

### Formato di uno scenario su disco

```
NomeScenario/
  ambientazione.json     # manifest: tutto lo stato serializzabile (schemaVersion 1)
  mappa-<uuid>.<ext>     # immagine mappa
  personaggi/<uuid>.<ext>
  oggetti/<uuid>.<ext>
  audio/                 # eventuali clip soundboard / sottofondo
```

Le immagini selezionate vengono **copiate** dentro la cartella dello scenario (non solo referenziate), così lo scenario resta autoconsistente. Le posizioni dei personaggi sono normalizzate `0..1` rispetto alla mappa.

---

## Prerequisiti

- **Node.js** (≥ 20; testato su 24) e **npm**
- **Rust** (toolchain stabile; testato su 1.95) → [rustup](https://rustup.rs/)
- **Dipendenze di sistema Tauri v2** — vedi la [guida ufficiale](https://tauri.app/start/prerequisites/).
  - **Ubuntu/Debian** servono in particolare WebKitGTK 4.1 e ALSA (per l'audio nativo):
    ```bash
    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
      libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
      libasound2-dev
    ```
    > `libasound2-dev` (ALSA) è **necessario** per compilare `rodio` (tick ruota nativi).

---

## Sviluppo

```bash
# Installa le dipendenze frontend
npm install

# Avvia l'app in modalità sviluppo (apre Regia + Proiezione)
npm run tauri dev
```

Altri script:

```bash
npm run dev       # solo frontend Vite (senza shell Tauri)
npm run build     # type-check (tsc) + build frontend (vite)
```

### Build di produzione

```bash
npm run tauri build
```

Produce i pacchetti nativi in `src-tauri/target/release/bundle/` (formati a seconda della piattaforma: `.deb`/AppImage su Linux, `.msi`/`.exe` su Windows, `.dmg`/`.app` su macOS). Gli scenari in `scenari-bundled/` vengono inclusi come risorse del bundle.

### Rigenerare i suoni del timer

I beep del timer sono MP3 sintetizzati offline e versionati nel repo. Per rigenerarli serve `ffmpeg`:

```bash
python3 scripts/gen_suoni.py
```

---

## Note d'uso per il conduttore

1. **All'avvio** scegli uno scenario recente / pre-installato oppure creane uno nuovo.
2. Per **preparare** uno scenario apri in **Modifica scenario**: carica la mappa, crea i personaggi (ritaglio faccia, nome, colore), aggiungi oggetti, posiziona tutto e salva le posizioni iniziali. Tutto viene salvato in automatico (indicatore di salvataggio in toolbar).
3. Per **giocare** apri in **Conduci sessione**: trascina la finestra Proiezione sul proiettore e premi *Proiezione a tutto schermo*. Da qui muovi i personaggi, assegna oggetti, lancia conflitti con la ruota, gestisci il timer e la leaderboard. **Nulla di ciò che fai dal vivo viene salvato**: alla riapertura lo scenario riparte dal setup.

---

## Documentazione interna

- **`CLAUDE.md`** — specifica autoriale completa (requisiti, vincoli, UX).
- **`docs/DECISIONS.md`** — log datato delle decisioni architetturali, delle assunzioni e delle deviazioni dalla spec, milestone per milestone. È il punto di riferimento per capire *perché* le cose sono fatte così.

---

*Progetto sviluppato con [Tauri](https://tauri.app/) + React + TypeScript.*
