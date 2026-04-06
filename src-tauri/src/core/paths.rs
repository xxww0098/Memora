use anyhow::{Context, Result};
use std::path::PathBuf;

/// Base data directory for Memora: ~/.memora/
pub fn data_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Cannot determine home directory")
        .join(".memora")
}

/// SQLite database path
pub fn db_path() -> PathBuf {
    data_dir().join("memora.db")
}

/// Settings file (contains encrypted API key)
pub fn settings_path() -> PathBuf {
    data_dir().join("settings.json")
}

/// Ensure data directory exists
pub fn ensure_dirs() -> Result<()> {
    let dir = data_dir();
    std::fs::create_dir_all(&dir).context("Failed to create Memora data directory")?;
    Ok(())
}
