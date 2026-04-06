mod commands;
mod core;
mod parsers;

use tracing_subscriber::{fmt, EnvFilter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Structured logging
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("memora=debug")),
        )
        .init();

    tracing::info!("Memora starting...");

    // Initialize database on startup
    if let Err(e) = core::storage::initialize_db() {
        tracing::error!("Failed to initialize database: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // ── Settings ──
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::validate_api_key,
            // ── Parser ──
            commands::parser::detect_and_parse,
            commands::parser::parse_pasted_text,
            // ── Persona ──
            commands::persona::list_personas,
            commands::persona::get_persona,
            commands::persona::delete_persona,
            commands::persona::get_persona_versions,
            commands::persona::rollback_persona,
            // ── Generator ──
            commands::generator::generate_persona,
            // ── Chat ──
            commands::chat::send_message,
            commands::chat::get_chat_history,
            commands::chat::list_chat_sessions,
            commands::chat::new_chat_session,
            commands::chat::delete_chat_session,
            // ── Correction ──
            commands::correction::submit_correction,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Memora");
}
