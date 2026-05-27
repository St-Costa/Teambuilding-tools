use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;

#[tauri::command]
fn allow_ambientazione_folder(app: AppHandle, path: String) -> Result<(), String> {
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    app.asset_protocol_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Ok(config_dir) = app.path().app_config_dir() {
                let _ = app.fs_scope().allow_directory(&config_dir, true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![allow_ambientazione_folder])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
