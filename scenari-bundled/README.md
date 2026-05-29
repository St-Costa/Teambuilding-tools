# Scenari pre-installati nel bundle

Ogni sottocartella di questa cartella è uno scenario "ufficiale" che viene
incluso nel pacchetto di installazione del tool (`.deb` / AppImage / `.msi` / `.dmg`)
e installato automaticamente nella cartella dati dell'utente al primo avvio.

## Come aggiungere uno scenario factory

1. Crea o modifica uno scenario col tool normalmente (`Selezione → Nuova ambientazione`).
2. Localizza la cartella generata (il path completo è visibile nell'header della
   regia, sotto il nome dell'ambientazione aperta).
3. Copia la cartella intera dentro `scenari-bundled/` mantenendo lo stesso
   nome (es. `scenari-bundled/Treno deragliato/`).
4. Verifica che la struttura sia:
   - `ambientazione.json` (manifest)
   - `personaggi/<uuid>.<ext>` (immagini personaggi)
   - `oggetti/<uuid>.<ext>` (immagini oggetti)
   - `mappa-<uuid>.<ext>` (immagine mappa, se presente)
5. `git add scenari-bundled/<NomeScenario>/` + commit.
6. `npm run tauri build` produce un binario che lo includerà.

## Cosa NON fare

- Non modificare a mano i path nel `ambientazione.json` (sono relativi alla cartella).
- Non spostare file fuori dalle subdir attese.
- Non usare nomi di cartella con caratteri speciali (`/`, `\`, `:`, ecc.).

## Comportamento all'avvio

Il binario al primo lancio:
- Legge l'elenco di sottocartelle in questa cartella (tramite la resource
  directory del bundle).
- Le copia in `<appDataDir>/Scenari/<NomeScenario>/` se non già presenti.
- Aggiunge ciascuna alla lista "ambientazioni recenti" del tool.
- Mantiene un tracking file `<appDataDir>/factory-installed.json` con i nomi
  installati.

I lanci successivi NON ricopiano gli scenari già tracciati. L'utente può quindi:
- Modificare uno scenario factory (autosave salva nelle SUE copie, lasciando
  intoccato il bundle).
- Eliminare uno scenario factory (NON viene ripristinato al riavvio).
- Cliccare "Ripristina scenari pre-installati" nella schermata di selezione
  per forzare la sovrascrittura con la versione del bundle.

## Aggiornamenti tra versioni del tool

Se rilasci una nuova versione del tool con uno scenario factory modificato,
gli utenti che hanno già installato la versione precedente NON ricevono
l'aggiornamento automaticamente. Devono usare "Ripristina scenari pre-installati"
manualmente (sovrascrive le loro modifiche).
