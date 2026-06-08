use rodio::Source;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::mpsc::{self, Sender};
use std::sync::Mutex;
use std::thread;
use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;

// ───────────────────────── Audio nativo (tick ruota) ────────────────────────
// L'uscita audio del webview (WebKitGTK) ha latenza alta e variabile: i tick
// della ruota risultavano sempre fuori sync. Qui li suoniamo dal backend con
// rodio (bassa latenza costante). Il front-end chiama `play_tick` su ogni
// attraversamento di fetta rilevato a schermo, così il click coincide col
// passaggio della freccia. Il campione del click è sintetizzato in Rust.

enum AudioCmd {
    Tick,
}

// Il mittente verso il thread audio. Mutex perché lo stato Tauri dev'essere
// Sync (mpsc::Sender non lo è). Option: None se l'audio non è disponibile.
struct AudioState(Mutex<Option<Sender<AudioCmd>>>);

fn genera_click(sample_rate: u32) -> Vec<f32> {
    // Click corto: 950 Hz, ~35 ms, decadimento esponenziale veloce.
    let durata = 0.035f32;
    let n = (durata * sample_rate as f32) as usize;
    (0..n)
        .map(|i| {
            let t = i as f32 / sample_rate as f32;
            let env = (-t / 0.008).exp();
            0.6 * env * (2.0 * std::f32::consts::PI * 950.0 * t).sin()
        })
        .collect()
}

// Avvia un thread dedicato che possiede l'OutputStream (non è Send) e suona un
// click a ogni messaggio. Gli stream sovrapposti sono gestiti dal mixer di
// rodio, quindi tick ravvicinati non si tagliano.
fn avvia_thread_audio() -> Option<Sender<AudioCmd>> {
    let (tx, rx) = mpsc::channel::<AudioCmd>();
    thread::spawn(move || {
        let (_stream, handle) = match rodio::OutputStream::try_default() {
            Ok(v) => v,
            Err(_) => return, // nessun dispositivo audio: thread esce, send() falliranno in silenzio
        };
        let sample_rate = 22_050u32;
        let click = genera_click(sample_rate);
        while let Ok(cmd) = rx.recv() {
            match cmd {
                AudioCmd::Tick => {
                    let src = rodio::buffer::SamplesBuffer::new(1, sample_rate, click.clone());
                    let _ = handle.play_raw(src);
                }
            }
        }
    });
    Some(tx)
}

#[tauri::command]
fn play_tick(state: tauri::State<AudioState>) {
    if let Ok(guard) = state.0.lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send(AudioCmd::Tick);
        }
    }
}

// ─────────────────────── Audio nativo (sottofondo) ──────────────────────────
// Stessa motivazione del tick: WebKitGTK + GStreamer è instabile e causa crash
// del WebProcess. Il sottofondo gira in un thread dedicato con rodio, che usa
// ALSA/PipeWire direttamente senza passare per il webview.

enum SottofondoCmd {
    Avvia { path: String, volume: f32 },
    Ferma,
    SetVolume(f32),
    Pausa,
    Riprendi,
}

struct SottofondoState(Mutex<Option<Sender<SottofondoCmd>>>);

fn avvia_thread_sottofondo() -> Option<Sender<SottofondoCmd>> {
    let (tx, rx) = mpsc::channel::<SottofondoCmd>();
    thread::spawn(move || {
        let (_stream, handle) = match rodio::OutputStream::try_default() {
            Ok(v) => v,
            Err(_) => return,
        };
        let mut sink: Option<rodio::Sink> = None;
        let mut path_corrente: Option<String> = None;
        let mut in_pausa = false;

        loop {
            // Svuota tutti i comandi pendenti prima di gestire il loop.
            loop {
                match rx.try_recv() {
                    Ok(SottofondoCmd::Avvia { path, volume }) => {
                        sink = None; // drop → stop automatico del vecchio sink
                        path_corrente = None;
                        in_pausa = false;
                        if let Ok(s) = rodio::Sink::try_new(&handle) {
                            s.set_volume(volume);
                            if let Ok(f) = fs::File::open(&path) {
                                if let Ok(dec) =
                                    rodio::Decoder::new(std::io::BufReader::new(f))
                                {
                                    s.append(dec);
                                    sink = Some(s);
                                    path_corrente = Some(path);
                                }
                            }
                        }
                    }
                    Ok(SottofondoCmd::Ferma) => {
                        sink = None;
                        path_corrente = None;
                        in_pausa = false;
                    }
                    Ok(SottofondoCmd::SetVolume(v)) => {
                        if let Some(ref s) = sink {
                            s.set_volume(v);
                        }
                    }
                    Ok(SottofondoCmd::Pausa) => {
                        if let Some(ref s) = sink {
                            s.pause();
                            in_pausa = true;
                        }
                    }
                    Ok(SottofondoCmd::Riprendi) => {
                        if let Some(ref s) = sink {
                            s.play();
                            in_pausa = false;
                        }
                    }
                    Err(mpsc::TryRecvError::Empty) => break,
                    Err(mpsc::TryRecvError::Disconnected) => return,
                }
            }

            // Loop automatico: quando il sink si svuota, ricarica il file.
            // Il gap è al massimo 10 ms (durata del sleep), impercettibile per
            // un sottofondo musicale.
            if !in_pausa {
                if let (Some(ref s), Some(ref path)) = (&sink, &path_corrente) {
                    if s.empty() {
                        if let Ok(f) = fs::File::open(path) {
                            if let Ok(dec) =
                                rodio::Decoder::new(std::io::BufReader::new(f))
                            {
                                s.append(dec);
                            }
                        }
                    }
                }
            }

            thread::sleep(std::time::Duration::from_millis(10));
        }
    });
    Some(tx)
}

fn invia_sott(state: &tauri::State<SottofondoState>, cmd: SottofondoCmd) {
    if let Ok(guard) = state.0.lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send(cmd);
        }
    }
}

#[tauri::command]
fn avvia_sottofondo(
    path: String,
    volume: f32,
    state: tauri::State<SottofondoState>,
) -> Result<(), String> {
    // Valida il file prima di inviare al thread: così l'errore torna subito al
    // frontend invece di sparire silenziosamente nel thread.
    let meta = fs::metadata(&path).map_err(|_| "File audio non trovato.".to_string())?;
    if !meta.is_file() {
        return Err("Il percorso non punta a un file audio.".into());
    }
    // Prova ad aprire e riconoscere il formato: fallisce subito se non supportato.
    let f = fs::File::open(&path).map_err(|e| e.to_string())?;
    rodio::Decoder::new(std::io::BufReader::new(f))
        .map_err(|e| format!("Formato audio non supportato: {e}"))?;
    invia_sott(&state, SottofondoCmd::Avvia { path, volume });
    Ok(())
}

#[tauri::command]
fn ferma_sottofondo(state: tauri::State<SottofondoState>) {
    invia_sott(&state, SottofondoCmd::Ferma);
}

#[tauri::command]
fn imposta_volume_sottofondo(volume: f32, state: tauri::State<SottofondoState>) {
    invia_sott(&state, SottofondoCmd::SetVolume(volume));
}

#[tauri::command]
fn pausa_sottofondo(state: tauri::State<SottofondoState>) {
    invia_sott(&state, SottofondoCmd::Pausa);
}

#[tauri::command]
fn riprendi_sottofondo(state: tauri::State<SottofondoState>) {
    invia_sott(&state, SottofondoCmd::Riprendi);
}

// ───────────────────────── Audio nativo (suoni di gioco) ───────────────────
// Beep timer, vittoria e soundboard: stessa motivazione del tick e del
// sottofondo — WebKitGTK + GStreamer è instabile. Tutto l'audio di gioco gira
// in un thread dedicato con rodio. I file bundled sono incorporati nel
// binario a compile time (include_bytes!), così non ci sono percorsi con hash
// Vite né problemi di resource_dir in dev vs release.

static BEEP_INIZIO_BYTES: &[u8] = include_bytes!("../../public/suoni/timer-inizio.mp3");
static CAMPANA_BYTES: &[u8] = include_bytes!("../../public/suoni/timer-1min.mp3");
static SVEGLIA_BYTES: &[u8] = include_bytes!("../../public/suoni/timer-scaduto.mp3");
static VITTORIA_BYTES: &[u8] = include_bytes!("../../public/suoni/vittoria.mp3");
static APPLAUSO_BYTES: &[u8] = include_bytes!("../../public/suoni/applauso.mp3");
static FUOCO_BYTES: &[u8] = include_bytes!("../../public/suoni/fuoco.mp3");

enum SuoniGiocoCmd {
    BeepInizio,
    Campana,
    StopCampana,
    Sveglia,
    StopSveglia,
    FermaTimer,
    Vittoria,
    Applauso,
    StopVittoria,
    Fuoco,
    Soundboard { path: String, volume: f32 },
}

struct SuoniGiocoState(Mutex<Option<Sender<SuoniGiocoCmd>>>);

fn avvia_thread_suoni_gioco() -> Option<Sender<SuoniGiocoCmd>> {
    let (tx, rx) = mpsc::channel::<SuoniGiocoCmd>();
    thread::spawn(move || {
        let (_stream, handle) = match rodio::OutputStream::try_default() {
            Ok(v) => v,
            Err(_) => return,
        };

        // Suoni con ciclo di vita controllato: campana, sveglia (loop),
        // vittoria e applauso (stoppabili prima della fine naturale).
        // I one-shot brevi (beep inizio, fuoco, soundboard) usano play_raw
        // senza Sink: la riproduzione prosegue fino a fine sorgente.
        let mut campana_sink: Option<rodio::Sink> = None;
        let mut sveglia_sink: Option<rodio::Sink> = None;
        let mut vittoria_sink: Option<rodio::Sink> = None;
        let mut applauso_sink: Option<rodio::Sink> = None;

        loop {
            loop {
                match rx.try_recv() {
                    Ok(SuoniGiocoCmd::BeepInizio) => {
                        let cur = std::io::Cursor::new(BEEP_INIZIO_BYTES);
                        if let Ok(dec) = rodio::Decoder::new(cur) {
                            let _ = handle.play_raw(dec.convert_samples());
                        }
                    }
                    Ok(SuoniGiocoCmd::Campana) => {
                        let _ = campana_sink.take(); // ferma eventuale campana precedente
                        if let Ok(s) = rodio::Sink::try_new(&handle) {
                            if let Ok(dec) =
                                rodio::Decoder::new(std::io::Cursor::new(CAMPANA_BYTES))
                            {
                                s.append(dec);
                                campana_sink = Some(s);
                            }
                        }
                    }
                    Ok(SuoniGiocoCmd::StopCampana) => {
                        let _ = campana_sink.take();
                    }
                    Ok(SuoniGiocoCmd::Sveglia) => {
                        let _ = sveglia_sink.take();
                        if let Ok(s) = rodio::Sink::try_new(&handle) {
                            if let Ok(dec) =
                                rodio::Decoder::new(std::io::Cursor::new(SVEGLIA_BYTES))
                            {
                                s.append(dec);
                                sveglia_sink = Some(s);
                            }
                        }
                    }
                    Ok(SuoniGiocoCmd::StopSveglia) => {
                        let _ = sveglia_sink.take();
                    }
                    Ok(SuoniGiocoCmd::FermaTimer) => {
                        let _ = campana_sink.take();
                        let _ = sveglia_sink.take();
                    }
                    Ok(SuoniGiocoCmd::Vittoria) => {
                        let _ = vittoria_sink.take();
                        if let Ok(s) = rodio::Sink::try_new(&handle) {
                            if let Ok(dec) =
                                rodio::Decoder::new(std::io::Cursor::new(VITTORIA_BYTES))
                            {
                                s.set_volume(0.18);
                                s.append(dec);
                                vittoria_sink = Some(s);
                            }
                        }
                    }
                    Ok(SuoniGiocoCmd::Applauso) => {
                        let _ = applauso_sink.take();
                        if let Ok(s) = rodio::Sink::try_new(&handle) {
                            if let Ok(dec) =
                                rodio::Decoder::new(std::io::Cursor::new(APPLAUSO_BYTES))
                            {
                                s.append(dec);
                                applauso_sink = Some(s);
                            }
                        }
                    }
                    Ok(SuoniGiocoCmd::StopVittoria) => {
                        let _ = vittoria_sink.take();
                        let _ = applauso_sink.take();
                    }
                    Ok(SuoniGiocoCmd::Fuoco) => {
                        let cur = std::io::Cursor::new(FUOCO_BYTES);
                        if let Ok(dec) = rodio::Decoder::new(cur) {
                            let _ = handle.play_raw(dec.amplify(0.7_f32).convert_samples());
                        }
                    }
                    Ok(SuoniGiocoCmd::Soundboard { path, volume }) => {
                        if let Ok(f) = fs::File::open(&path) {
                            if let Ok(dec) =
                                rodio::Decoder::new(std::io::BufReader::new(f))
                            {
                                let _ =
                                    handle.play_raw(dec.amplify(volume).convert_samples());
                            }
                        }
                    }
                    Err(mpsc::TryRecvError::Empty) => break,
                    Err(mpsc::TryRecvError::Disconnected) => return,
                }
            }

            // Loop automatico sveglia: quando il Sink si svuota ricarichiamo il file.
            // Gap massimo 10 ms, impercettibile come beep di allarme.
            if let Some(ref s) = sveglia_sink {
                if s.empty() {
                    if let Ok(dec) =
                        rodio::Decoder::new(std::io::Cursor::new(SVEGLIA_BYTES))
                    {
                        s.append(dec);
                    }
                }
            }

            thread::sleep(std::time::Duration::from_millis(10));
        }
    });
    Some(tx)
}

fn invia_gioco(state: &tauri::State<SuoniGiocoState>, cmd: SuoniGiocoCmd) {
    if let Ok(guard) = state.0.lock() {
        if let Some(tx) = guard.as_ref() {
            let _ = tx.send(cmd);
        }
    }
}

#[tauri::command]
fn play_beep_inizio(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::BeepInizio);
}

#[tauri::command]
fn play_campana(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::Campana);
}

#[tauri::command]
fn stop_campana(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::StopCampana);
}

#[tauri::command]
fn play_sveglia(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::Sveglia);
}

#[tauri::command]
fn stop_sveglia(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::StopSveglia);
}

#[tauri::command]
fn ferma_timer_suoni(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::FermaTimer);
}

#[tauri::command]
fn play_vittoria_suono(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::Vittoria);
}

#[tauri::command]
fn play_applauso(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::Applauso);
}

#[tauri::command]
fn stop_vittoria_suoni(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::StopVittoria);
}

#[tauri::command]
fn play_fuoco(state: tauri::State<SuoniGiocoState>) {
    invia_gioco(&state, SuoniGiocoCmd::Fuoco);
}

#[tauri::command]
fn play_soundboard_slot(
    path: String,
    volume: f32,
    state: tauri::State<SuoniGiocoState>,
) -> Result<(), String> {
    let meta = fs::metadata(&path).map_err(|_| "File audio non trovato.".to_string())?;
    if !meta.is_file() {
        return Err("Il percorso non punta a un file audio.".into());
    }
    invia_gioco(&state, SuoniGiocoCmd::Soundboard { path, volume });
    Ok(())
}

#[tauri::command]
fn allow_ambientazione_folder(app: AppHandle, path: String) -> Result<(), String> {
    // Validazione prima di allargare lo scope: `canonicalize` risolve i symlink
    // e normalizza i componenti relativi, e fallisce se il percorso non esiste.
    // Richiediamo inoltre che sia una directory. Così un percorso inesistente,
    // un file o un symlink non risolvibile viene rifiutato con un errore chiaro
    // invece di autorizzare silenziosamente qualcosa di inatteso.
    let canonico =
        fs::canonicalize(&path).map_err(|e| format!("percorso non valido ({}): {}", path, e))?;
    if !canonico.is_dir() {
        return Err(format!("non è una cartella: {}", canonico.display()));
    }
    // Autorizziamo sia il percorso originale — con cui il front-end legge/scrive
    // i file dell'ambientazione — sia quello canonico, così lo scope combacia
    // anche quando l'utente arriva alla cartella attraverso un symlink.
    for p in [Path::new(&path), canonico.as_path()] {
        app.fs_scope()
            .allow_directory(p, true)
            .map_err(|e| e.to_string())?;
        app.asset_protocol_scope()
            .allow_directory(p, true)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct InstallResult {
    nome: String,
    path: String,
    copiato: bool,
}

#[derive(Default, Debug, Serialize, Deserialize)]
struct TrackingFactory {
    installati: Vec<String>,
}

fn risorse_scenari_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let res = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource_dir: {}", e))?;
    Ok(res.join("scenari-bundled"))
}

fn scenari_dest_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    Ok(data.join("Scenari"))
}

fn tracking_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {}", e))?;
    Ok(data.join("factory-installed.json"))
}

fn leggi_tracking(path: &Path) -> HashSet<String> {
    let Ok(testo) = fs::read_to_string(path) else {
        return HashSet::new();
    };
    let parsed: Result<TrackingFactory, _> = serde_json::from_str(&testo);
    match parsed {
        Ok(t) => t.installati.into_iter().collect(),
        Err(_) => HashSet::new(),
    }
}

fn scrivi_tracking(path: &Path, set: &HashSet<String>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let t = TrackingFactory {
        installati: {
            let mut v: Vec<String> = set.iter().cloned().collect();
            v.sort();
            v
        },
    };
    let json = serde_json::to_string_pretty(&t).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("scrittura tracking: {}", e))
}

fn copia_dir_ricorsiva(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("mkdir {}: {}", dst.display(), e))?;
    for entry in fs::read_dir(src).map_err(|e| format!("read_dir {}: {}", src.display(), e))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        // `DirEntry::file_type()` NON segue i symlink: per un link a una cartella
        // `is_dir()` è false, quindi non vi ricorriamo — niente cicli infiniti
        // su symlink che puntano a un antenato. I link vengono ignorati (gli
        // scenari bundled non ne contengono).
        let ft = entry.file_type().map_err(|e| e.to_string())?;
        if ft.is_dir() {
            copia_dir_ricorsiva(&from, &to)?;
        } else if ft.is_file() {
            fs::copy(&from, &to)
                .map_err(|e| format!("copy {} -> {}: {}", from.display(), to.display(), e))?;
        }
    }
    Ok(())
}

/// In dev (debug build), ritorna il path alla cartella `scenari-bundled/` del
/// repo source. In release ritorna None — il binario installato non sa dov'è
/// il repo. Usato dalla regia per la "modalità autore": creazione diretta degli
/// scenari nel repo, niente dialog di scelta folder.
#[tauri::command]
fn cartella_repo_scenari() -> Result<Option<String>, String> {
    if !cfg!(debug_assertions) {
        return Ok(None);
    }
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let candidato = match manifest.parent() {
        Some(p) => p.join("scenari-bundled"),
        None => return Ok(None),
    };
    if candidato.exists() {
        Ok(Some(candidato.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn lista_scenari_factory_disponibili(app: AppHandle) -> Result<Vec<String>, String> {
    let src = risorse_scenari_dir(&app)?;
    if !src.exists() {
        return Ok(Vec::new());
    }
    let mut out: Vec<String> = Vec::new();
    for entry in fs::read_dir(&src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            out.push(entry.file_name().to_string_lossy().to_string());
        }
    }
    out.sort();
    Ok(out)
}

#[tauri::command]
fn installa_scenari_factory(app: AppHandle) -> Result<Vec<InstallResult>, String> {
    let src = risorse_scenari_dir(&app)?;
    if !src.exists() {
        return Ok(Vec::new());
    }
    let dst_root = scenari_dest_dir(&app)?;
    let tracking_p = tracking_path(&app)?;
    let mut tracking = leggi_tracking(&tracking_p);
    let mut risultati: Vec<InstallResult> = Vec::new();

    fs::create_dir_all(&dst_root).map_err(|e| e.to_string())?;

    for entry in fs::read_dir(&src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if !p.is_dir() {
            continue;
        }
        let nome = entry.file_name().to_string_lossy().to_string();
        if tracking.contains(&nome) {
            // già installato in passato → rispetta eliminazioni utente
            continue;
        }
        let dst = dst_root.join(&nome);
        if dst.exists() {
            // L'utente l'ha già creato manualmente: traccia e skip
            tracking.insert(nome.clone());
            risultati.push(InstallResult {
                nome,
                path: dst.to_string_lossy().to_string(),
                copiato: false,
            });
            continue;
        }
        copia_dir_ricorsiva(&p, &dst)?;
        // autorizza la nuova cartella su fs+asset scope per le immagini
        let _ = app.fs_scope().allow_directory(&dst, true);
        let _ = app.asset_protocol_scope().allow_directory(&dst, true);
        tracking.insert(nome.clone());
        risultati.push(InstallResult {
            nome,
            path: dst.to_string_lossy().to_string(),
            copiato: true,
        });
    }
    scrivi_tracking(&tracking_p, &tracking)?;
    Ok(risultati)
}

#[tauri::command]
fn ripristina_scenari_factory(app: AppHandle) -> Result<Vec<InstallResult>, String> {
    let src = risorse_scenari_dir(&app)?;
    if !src.exists() {
        return Ok(Vec::new());
    }
    let dst_root = scenari_dest_dir(&app)?;
    let tracking_p = tracking_path(&app)?;
    let mut tracking = leggi_tracking(&tracking_p);
    let mut risultati: Vec<InstallResult> = Vec::new();

    fs::create_dir_all(&dst_root).map_err(|e| e.to_string())?;

    for entry in fs::read_dir(&src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if !p.is_dir() {
            continue;
        }
        let nome = entry.file_name().to_string_lossy().to_string();
        let dst = dst_root.join(&nome);
        if dst.exists() {
            fs::remove_dir_all(&dst).map_err(|e| format!("rm {}: {}", dst.display(), e))?;
        }
        copia_dir_ricorsiva(&p, &dst)?;
        let _ = app.fs_scope().allow_directory(&dst, true);
        let _ = app.asset_protocol_scope().allow_directory(&dst, true);
        tracking.insert(nome.clone());
        risultati.push(InstallResult {
            nome,
            path: dst.to_string_lossy().to_string(),
            copiato: true,
        });
    }
    scrivi_tracking(&tracking_p, &tracking)?;
    Ok(risultati)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let esito = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AudioState(Mutex::new(avvia_thread_audio())))
        .manage(SottofondoState(Mutex::new(avvia_thread_sottofondo())))
        .manage(SuoniGiocoState(Mutex::new(avvia_thread_suoni_gioco())))
        .setup(|app| {
            if let Ok(config_dir) = app.path().app_config_dir() {
                let _ = app.fs_scope().allow_directory(&config_dir, true);
            }
            if let Ok(data_dir) = app.path().app_data_dir() {
                let _ = app.fs_scope().allow_directory(&data_dir, true);
                let _ = app.asset_protocol_scope().allow_directory(&data_dir, true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            allow_ambientazione_folder,
            cartella_repo_scenari,
            lista_scenari_factory_disponibili,
            installa_scenari_factory,
            ripristina_scenari_factory,
            play_tick,
            avvia_sottofondo,
            ferma_sottofondo,
            imposta_volume_sottofondo,
            pausa_sottofondo,
            riprendi_sottofondo,
            play_beep_inizio,
            play_campana,
            stop_campana,
            play_sveglia,
            stop_sveglia,
            ferma_timer_suoni,
            play_vittoria_suono,
            play_applauso,
            stop_vittoria_suoni,
            play_fuoco,
            play_soundboard_slot,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                window.app_handle().exit(0);
            }
        })
        .run(tauri::generate_context!());

    // Niente panic muto in release: in caso di errore irreversibile all'avvio
    // logghiamo su stderr ed usciamo con codice non-zero per facilitare la
    // diagnosi (e segnalare il fallimento a chi lancia il processo).
    if let Err(e) = esito {
        eprintln!("Errore irreversibile all'avvio dell'applicazione: {e}");
        std::process::exit(1);
    }
}
