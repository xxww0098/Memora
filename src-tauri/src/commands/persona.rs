use crate::core::db_pool::memora_pool;
use crate::core::models::{Persona, PersonaSummary, VersionSummary};

#[tauri::command]
pub async fn list_personas() -> Result<Vec<PersonaSummary>, String> {
    let pool = memora_pool();
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"SELECT p.id, p.name, p.avatar_emoji, p.description, p.tags_json, p.version, p.created_at,
               (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.persona_id = p.id) as last_chat
               FROM personas p ORDER BY COALESCE(last_chat, p.created_at) DESC"#,
        )
        .map_err(|e| e.to_string())?;

    let personas: Vec<PersonaSummary> = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(PersonaSummary {
                id: row.get(0)?,
                name: row.get(1)?,
                avatar_emoji: row.get(2)?,
                description: row.get(3)?,
                tags,
                version: row.get(5)?,
                created_at: row.get(6)?,
                last_chat_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(personas)
}

#[tauri::command]
pub async fn get_persona(id: String) -> Result<Persona, String> {
    let pool = memora_pool();
    let conn = pool.get().map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, slug, name, avatar_emoji, description, tags_json, persona_md, memories_md, version, created_at, updated_at FROM personas WHERE id = ?1",
        [&id],
        |row| {
            Ok(Persona {
                id: row.get(0)?,
                slug: row.get(1)?,
                name: row.get(2)?,
                avatar_emoji: row.get(3)?,
                description: row.get(4)?,
                tags_json: row.get(5)?,
                persona_md: row.get(6)?,
                memories_md: row.get(7)?,
                version: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| format!("Persona not found: {}", e))
}

#[tauri::command]
pub async fn delete_persona(id: String) -> Result<(), String> {
    let pool = memora_pool();
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM personas WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_persona_versions(id: String) -> Result<Vec<VersionSummary>, String> {
    let pool = memora_pool();
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT version, created_at FROM persona_versions WHERE persona_id = ?1 ORDER BY version DESC")
        .map_err(|e| e.to_string())?;

    let versions: Vec<VersionSummary> = stmt
        .query_map([&id], |row| {
            Ok(VersionSummary {
                version: row.get(0)?,
                created_at: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(versions)
}

#[tauri::command]
pub async fn rollback_persona(id: String, version: i32) -> Result<(), String> {
    let pool = memora_pool();
    let conn = pool.get().map_err(|e| e.to_string())?;

    let (persona_md, memories_md): (String, String) = conn
        .query_row(
            "SELECT persona_md, memories_md FROM persona_versions WHERE persona_id = ?1 AND version = ?2",
            rusqlite::params![id, version],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Version not found: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE personas SET persona_md = ?1, memories_md = ?2, version = ?3, updated_at = ?4 WHERE id = ?5",
        rusqlite::params![persona_md, memories_md, version, now, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
