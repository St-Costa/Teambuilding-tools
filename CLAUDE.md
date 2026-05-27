# GDR Teambuilding Tool — Specifica per Claude Code

> Documento di partenza per costruire il tool da zero. Leggilo interamente prima di scrivere codice. Le sezioni `## VINCOLI` e `## DA VERIFICARE PER PRIMO` contengono i punti che decidono l'architettura: rispettali.

---

## 0. Cos'è questo tool

Strumento per condurre dal vivo una sessione di gioco di ruolo (GDR) semplificato, usato in un contesto di teambuilding aziendale. Il conduttore ("regista") usa un laptop collegato a un proiettore. Sul proiettore va una **mappa** con i **personaggi** (cerchietti con la faccia) che il regista muove e a cui attacca **oggetti**. I conflitti tra personaggi si risolvono con una **ruota della fortuna** animata che sostituisce i dadi.

**Chi lo usa**: persona NON tecnica. L'interfaccia deve essere autoesplicativa, tollerante agli errori, senza terminologia da sviluppatore.

**Tre funzionalità principali**:
1. Gestione mappa + personaggi + oggetti
2. Ruota della fortuna (risoluzione conflitti)
3. ~~Gestione casse Bluetooth~~ **RIMOSSA** (vedi sotto)

### Audio: FUORI SCOPE
Il routing audio è stato rimosso dai requisiti. Il conduttore gestisce due casse manualmente da due dispositivi separati (laptop + telefono). **Il tool NON deve toccare l'audio in alcun modo.** Non implementare riproduzione MP3, selezione output device, né alcuna API audio. Se trovi avanzi di questo requisito altrove, ignorali.

---

## 1. Stack tecnologico (DECISO — non riproporre alternative)

- **Framework desktop**: **Tauri v2** (stabile, ultima v2.x). App desktop cross-platform per **Ubuntu, Windows, macOS**. Usa la WebView del sistema operativo, non impacchetta un browser. Binario leggero.
- **Frontend**: **React + TypeScript + Vite**.
- **Stato**: Zustand (semplice, adatto a stato condiviso tra finestre). Evita Redux (overkill).
- **Styling**: CSS modules o Tailwind, a tua scelta. Priorità: UI chiara per non-tecnici, non estetica elaborata.
- **Filesystem**: usa il **plugin `@tauri-apps/plugin-fs`** e `@tauri-apps/plugin-dialog` di Tauri v2 per leggere/scrivere le cartelle-ambientazione. NON usare la File System Access API del browser (non serve, hai accesso nativo).
- **Animazione ruota**: rotazione CSS con `transform: rotate()` + `transition` con `cubic-bezier` in decelerazione. Niente librerie pesanti.

### Perché Tauri e non altro (contesto, non da rimettere in discussione)
Electron è troppo pesante. Una web app pura romperebbe il salvataggio-cartelle su Firefox/Ubuntu (File System Access API è Chromium-only). Tauri dà cross-platform vero + filesystem nativo + UX da app installata per un non-tecnico. Questa scelta è già stata validata con il committente.

---

## 2. Architettura a due finestre

Due finestre Tauri distinte, gestite dal core Rust:

- **Finestra REGIA** (`control`): sul display del laptop. Contiene tutti i controlli. Qui si caricano asset, si muovono i personaggi, si assegnano oggetti, si lancia la ruota.
- **Finestra PROIEZIONE** (`stage`): trascinata dal regista sul proiettore (schermo esteso) e messa a tutto schermo. Mostra **solo** la mappa con i personaggi, oppure la ruota quando attiva. Nessun pulsante, nessuna UI di controllo.

### Comunicazione tra finestre
**DA VERIFICARE PER PRIMO** (vedi §9): in Tauri v2 usa il **sistema di eventi nativo** (`emit` / `listen` da `@tauri-apps/api/event`), NON `BroadcastChannel`. `BroadcastChannel` è inaffidabile tra WebView Tauri separate. Lo stato vive nella finestra regia (source of truth); ogni cambiamento viene emesso come evento e la proiezione lo riflette in sola lettura.

Flusso: REGIA modifica stato → `emit('stage:update', payload)` → STAGE riceve con `listen` → ridisegna.

### Comportamento finestra proiezione
- Default: mostra la mappa a schermo intero con i personaggi.
- Il **cursore del mouse scompare dopo qualche secondo di inattività** sopra la finestra proiezione (es. 3s), riappare al movimento. Implementa con timer + `cursor: none`.
- Quando il regista lancia un conflitto, la proiezione passa alla **vista ruota**; a conflitto risolto, torna alla mappa.
- Nessun elemento di controllo deve mai apparire qui.

---

## 3. AMBIENTAZIONI (salvataggio su cartella)

Un'**ambientazione** è un pacchetto completo: mappa + personaggi + oggetti + posizioni + assegnazioni. Costruiremo più ambientazioni diverse nel tempo.

- All'avvio, il tool mostra una schermata di **selezione ambientazione**: lista delle ambientazioni esistenti + pulsante "Nuova ambientazione".
- Ogni ambientazione è una **cartella su disco** scelta/creata dall'utente tramite dialog nativo.
- Struttura cartella proposta (adattala se hai motivi migliori, ma documentala):

```
NomeAmbientazione/
  ambientazione.json        # manifest: tutto lo stato serializzabile
  mappa.<ext>               # immagine mappa
  personaggi/
    <id>.<ext>              # immagine originale caricata per ogni personaggio
  oggetti/
    <id>.<ext>              # immagine di ogni oggetto
```

- `ambientazione.json` contiene: riferimenti ai file immagine, per ogni personaggio (nome, colore, parametri di ritaglio/centratura faccia: zoom + offset x/y, posizione sulla mappa x/y, oggetti assegnati), per ogni oggetto (nome, eventuale valore modificatore di default), e qualsiasi altro stato.
- **Salvataggio**: alla riapertura dell'ambientazione tutto deve tornare esattamente com'era (personaggi ritagliati, colori, posizioni, oggetti attaccati). Salva su modifica (autosave) o con pulsante esplicito "Salva" ben visibile — scegli tu, ma il non-tecnico non deve perdere lavoro. Consiglio: autosave + indicatore "salvato".

---

## 4. GESTIONE MAPPA + PERSONAGGI + OGGETTI

### 4.1 Mappa
- L'utente carica un'immagine (dialog nativo). Diventa lo sfondo della scena, sia in regia (in scala ridotta/scrollabile) sia in proiezione (a schermo intero).
- La mappa è l'elemento principale della proiezione: deve riempire la finestra in modo sensato (contain/cover configurabile; default `contain` per non tagliare contenuti).

### 4.2 Creazione personaggio
Quando si crea un personaggio, in REGIA:
1. **Carica immagine** del personaggio (dialog nativo).
2. **Centra la faccia nel cerchio**: l'immagine viene mostrata dentro una maschera circolare; l'utente regola **zoom** (slider o scroll) e **posizione** (drag dell'immagine dentro la maschera) finché la faccia è centrata. **Questo è pan/zoom manuale, NON rilevamento automatico del volto.** Salva i parametri (zoom, offsetX, offsetY) nel manifest così il ritaglio è ricostruibile.
3. **Assegna un nome**.
4. **Assegna un colore** (color picker). Vincolo: **personaggi diversi devono avere colori diversi** — valida e impedisci/avvisa sui duplicati. Questo colore è:
   - il **bordo del cerchietto** sulla mappa,
   - il colore della **fetta** del personaggio nella ruota della fortuna.

Il cerchietto risultante = immagine ritagliata in cerchio + anello colorato di bordo.

### 4.3 Oggetti
- Si caricano immagini di oggetti (in fase di setup ambientazione). Ogni oggetto ha un'immagine e un nome.
- **Assegnazione**: avviene SOLO nella finestra REGIA. Il regista assegna un oggetto a un personaggio → l'oggetto compare **attaccato al cerchietto** (es. piccola icona a lato/sopra il cerchio) sia in regia sia in proiezione, e ci resta finché il regista non lo rimuove.
- Un personaggio può avere più oggetti attaccati. Decidi un layout pulito per più oggetti attorno al cerchio (es. in fila sotto/accanto). Documenta la scelta.
- Gli oggetti possono fungere da **modificatori** nella ruota (vedi §5).

### 4.4 Movimento
- I cerchietti si muovono con **drag and drop** libero sulla mappa.
- Il drag avviene in REGIA; la posizione si riflette in tempo reale sulla PROIEZIONE via eventi.
- Gli oggetti attaccati si muovono insieme al cerchietto.

---

## 5. RUOTA DELLA FORTUNA

Sostituisce i dadi. Risolve un **conflitto** (contenzioso) tra 2 o più personaggi.

### 5.1 Creazione del conflitto
1. Il regista apre la ruota e **seleziona quali personaggi** sono in conflitto (2 o più).
2. Di default, ogni personaggio selezionato ha **uguale probabilità** → fette di uguale ampiezza. Es. 2 personaggi = 50%/50%; 3 = 33.3% ciascuno; ecc.
3. Ogni fetta mostra **al suo interno la faccia del personaggio** (il cerchietto ritagliato) ed è colorata con il **colore del personaggio**.

### 5.2 Modificatori
Le probabilità si possono alterare con modificatori. **Solo due tipi**: `+1` e `+2`.

**Regola di calcolo (CRITICA, leggi con attenzione):**
- `+1` = aumenta del **20% della fetta originale** del personaggio.
- `+2` = aumenta del **40% della fetta originale** del personaggio.
- "Fetta originale" = la quota di base data dall'uguale ripartizione, PRIMA dei modificatori.
- Esempi:
  - 2 personaggi (base 50% ciascuno). `+1` a uno = +20% di 50% = +10 punti → quel personaggio sale, e **le probabilità vanno poi rinormalizzate** in modo che il totale resti 100%.
  - 3 personaggi (base 33.3% ciascuno). `+1` = +20% di 33.3% ≈ +6.67 punti su quella fetta, poi rinormalizza.
  - `+2` con 3 personaggi = +40% di 33.3% ≈ +13.3 punti, poi rinormalizza.

> **NOTA DI IMPLEMENTAZIONE**: il "+20%/+40% della fetta originale" definisce di quanto cresce la fetta del personaggio modificato. Dopo aver applicato gli incrementi, **rinormalizza tutte le fette perché la somma faccia 100%** (la ruota è un cerchio pieno). Rendi esplicito nel codice e con un commento come gestisci la rinormalizzazione, perché è il punto più facile da sbagliare. Se più personaggi hanno modificatori, applica tutti gli incrementi assoluti e poi rinormalizza una sola volta.

**Origine del modificatore** — due casi:
- **Modificatore da OGGETTO**: il regista trascina/assegna un oggetto come fonte del bonus. La **fetta di incremento mostra l'immagine dell'oggetto** al suo interno.
- **Modificatore NON da oggetto**: il regista inserisce un **testo** che giustifica il bonus (es. "superiorità numerica"). Quel **testo va mostrato dentro la fetta di incremento**.

> Interpretazione da confermare (vedi §10): la "fetta di incremento" è una porzione visivamente distinta della fetta del personaggio (es. una sotto-fetta adiacente, con il colore del personaggio ma marcata con l'icona-oggetto o il testo), così a colpo d'occhio si capisce da dove viene il vantaggio. Se hai un'idea migliore per renderlo leggibile sulla ruota, proponila prima di implementare.

### 5.3 Animazione e risoluzione
- La ruota **gira con animazione**: accelera, poi **rallenta e si ferma** su un vincitore (decelerazione naturale, `cubic-bezier`). Questo momento di tensione è il cuore della meccanica davanti al pubblico, curalo.
- L'estrazione del vincitore deve essere **coerente con le probabilità** (il punto in cui si ferma corrisponde davvero alle fette pesate). Implementa scegliendo prima il vincitore pesato, poi calcolando l'angolo di arresto dentro la sua fetta (così l'animazione non "bara").
- A fine giro, evidenzia chiaramente il vincitore.
- La ruota appare sulla **PROIEZIONE** quando lanciata; i controlli (selezione personaggi, modificatori, pulsante "Gira") stanno in **REGIA**.

---

## 6. UX e principi di interfaccia

- **Linguaggio in italiano**, semplice, zero gergo tecnico (no "JSON", "asset", "render"; usa "ambientazione", "personaggio", "salva").
- Tolleranza agli errori: conferme prima di azioni distruttive (eliminare personaggio, sovrascrivere). Nessuna azione irreversibile silenziosa.
- Feedback visivo costante: cosa è selezionato, cosa è salvato, quale finestra è la proiezione.
- La finestra REGIA può essere densa di controlli; la PROIEZIONE deve restare pulitissima.
- Pulsante evidente per **aprire/posizionare la finestra proiezione** e metterla a tutto schermo sul secondo monitor.

---

## 7. Struttura progetto suggerita

```
src/
  windows/
    control/        # UI regia
    stage/          # UI proiezione (sola lettura)
  components/
    Map/            # mappa + cerchietti + oggetti attaccati
    CharacterCreator/  # caricamento img, pan/zoom maschera circolare, colore, nome
    ObjectManager/
    Wheel/          # ruota: geometria fette, modificatori, animazione, estrazione pesata
  state/            # store Zustand (source of truth in regia)
  lib/
    events.ts       # wrapper su emit/listen Tauri
    storage.ts      # load/save ambientazione (plugin-fs + plugin-dialog)
    wheel-math.ts   # calcolo fette, modificatori, rinormalizzazione, vincitore pesato
src-tauri/          # core Rust, config finestre, plugin
```

---

## 8. Ordine di costruzione consigliato

1. Scaffold Tauri v2 + React + Vite. Verifica build su almeno una piattaforma.
2. Due finestre (regia + proiezione) + comunicazione a eventi funzionante (un contatore sincronizzato come prova).
3. Selezione/creazione ambientazione + salvataggio/caricamento su cartella (filesystem).
4. Mappa + creazione personaggio (pan/zoom maschera circolare, colore, nome) + drag and drop + sync su proiezione.
5. Oggetti + assegnazione/attacco al cerchietto.
6. Ruota: geometria fette pesate → modificatori + rinormalizzazione → animazione decelerante → estrazione pesata coerente → vista su proiezione.
7. Rifinitura UX: cursore che sparisce, fullscreen proiezione, conferme, autosave.

Procedi per milestone verificabili; non scrivere tutto in un colpo.

---

## 9. DA VERIFICARE PER PRIMO (rischi tecnici noti)

1. **Eventi tra finestre Tauri v2**: conferma che `emit`/`listen` propaghino lo stato tra finestra regia e finestra proiezione. Costruisci una prova minima (contatore) prima di andare avanti. NON affidarti a `BroadcastChannel`.
2. **Rendering ruota su WebKitGTK (Ubuntu)**: la WebView Linux può avere micro-differenze di fluidità nell'animazione CSS rispetto a Windows/Mac. Testa l'animazione della ruota su Ubuntu presto. Se scattosa, valuta `requestAnimationFrame` con rotazione manuale invece della pura `transition` CSS.
3. **Permessi plugin-fs in Tauri v2**: la v2 usa un sistema di capabilities/permessi per l'accesso al filesystem. Configura correttamente i permessi per leggere/scrivere nelle cartelle scelte dall'utente, altrimenti il salvataggio fallisce silenziosamente.
4. **Secondo monitor / fullscreen**: verifica l'API Tauri per spostare e mettere a fullscreen la finestra proiezione sul display esteso. Se non c'è controllo programmatico affidabile del posizionamento, fai trascinare manualmente la finestra all'utente e offri solo il toggle fullscreen.

---

## 10. PUNTI DA CONFERMARE COL COMMITTENTE (chiedi prima di assumere)

1. **Resa grafica della "fetta di incremento"** nella ruota (§5.2): come va mostrata visivamente la porzione di bonus con icona-oggetto o testo? Proponi un mockup prima di implementarla.
2. **Più oggetti attaccati a un personaggio** (§4.3): layout preferito attorno al cerchietto.
3. **Autosave vs salvataggio manuale** (§3): default proposto autosave; conferma.
4. **Dopo la risoluzione del conflitto**: la ruota va archiviata, o si conserva uno storico degli esiti? (Assunzione: nessuno storico, torna alla mappa.)
5. **Eliminazione personaggio in conflitto già impostato**: comportamento atteso (assunzione: il conflitto si ricalcola).

> Se un punto resta ambiguo in fase di codice, scegli l'opzione più semplice e reversibile, e segnala l'assunzione fatta.
