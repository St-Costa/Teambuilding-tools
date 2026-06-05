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
