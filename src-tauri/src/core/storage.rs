use anyhow::{Context, Result};
use tracing::info;

use super::db_pool::memora_pool;
use super::paths;

/// Initialize the database with all required tables
pub fn initialize_db() -> Result<()> {
    paths::ensure_dirs()?;

    let pool = memora_pool();
    let conn = pool.get().context("Failed to get DB connection for init")?;

    conn.execute_batch(
        r#"
        -- Persona 主表
        CREATE TABLE IF NOT EXISTS personas (
            id           TEXT PRIMARY KEY,
            slug         TEXT UNIQUE NOT NULL,
            name         TEXT NOT NULL,
            avatar_emoji TEXT DEFAULT '💜',
            description  TEXT DEFAULT '',
            tags_json    TEXT NOT NULL DEFAULT '[]',
            persona_md   TEXT NOT NULL DEFAULT '',
            memories_md  TEXT NOT NULL DEFAULT '',
            version      INTEGER NOT NULL DEFAULT 1,
            created_at   TEXT NOT NULL,
            updated_at   TEXT NOT NULL
        );

        -- 版本快照（回滚用）
        CREATE TABLE IF NOT EXISTS persona_versions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            persona_id  TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
            version     INTEGER NOT NULL,
            persona_md  TEXT NOT NULL,
            memories_md TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );

        -- 聊天消息
        CREATE TABLE IF NOT EXISTS chat_messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            persona_id  TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
            session_id  TEXT NOT NULL,
            role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
            content     TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chat_persona_session
            ON chat_messages(persona_id, session_id);

        -- 纠正记录
        CREATE TABLE IF NOT EXISTS corrections (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            persona_id  TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
            target      TEXT NOT NULL CHECK (target IN ('persona', 'memories')),
            original    TEXT,
            correction  TEXT NOT NULL,
            applied_at  TEXT NOT NULL
        );

        -- 应用设置
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        "#,
    )
    .context("Failed to create database tables")?;

    info!("Database initialized successfully");
    Ok(())
}
