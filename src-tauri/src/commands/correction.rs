use crate::core::ai_provider;
use crate::core::db_pool::memora_pool;
use crate::core::models::CorrectionResult;
use crate::core::prompts;
use anyhow::Context;

#[tauri::command]
pub async fn submit_correction(
    _app: tauri::AppHandle,
    persona_id: String,
    original: String,
    correction: String,
) -> Result<CorrectionResult, String> {
    submit_inner(persona_id, original, correction)
        .await
        .map_err(|e| e.to_string())
}

async fn submit_inner(
    persona_id: String,
    original: String,
    correction: String,
) -> anyhow::Result<CorrectionResult> {
    let config = ai_provider::load_config();

    // Load persona in blocking context
    let (persona_md, memories_md, ver) = tokio::task::spawn_blocking({
        let pid = persona_id.clone();
        move || {
            let pool = memora_pool();
            let conn = pool.get().context("DB connection failed")?;
            let row: (String, String, i32) = conn.query_row(
                "SELECT persona_md, memories_md, version FROM personas WHERE id = ?1",
                [&pid],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )?;
            Ok::<_, anyhow::Error>(row)
        }
    })
    .await
    .context("spawn_blocking join error")??;

    let prompt = prompts::render(prompts::CORRECTION_HANDLER, &[
        ("persona_md", &persona_md),
        ("original", &original),
        ("correction", &correction),
    ]);

    let response =
        ai_provider::chat_completion(&config, &prompt, "请分析修正并输出 JSON", 2048).await?;

    let cleaned = response.trim().trim_start_matches("```json")
        .trim_start_matches("```").trim_end_matches("```").trim();
    let cj: serde_json::Value = serde_json::from_str(cleaned).unwrap_or_else(|_| {
        serde_json::json!({"target":"persona","rule":correction})
    });

    let target = cj.get("target").and_then(|t| t.as_str()).unwrap_or("persona").to_string();
    let rule = cj.get("rule").and_then(|r| r.as_str()).unwrap_or(&correction).to_string();
    let new_ver = ver + 1;

    // Save in blocking context
    tokio::task::spawn_blocking({
        let pid = persona_id.clone();
        let pmd = persona_md.clone();
        let mmd = memories_md.clone();
        let target2 = target.clone();
        let orig = original.clone();
        let corr = correction.clone();
        let rule2 = rule.clone();
        move || {
            let pool = memora_pool();
            let conn = pool.get().context("DB connection failed")?;
            let now = chrono::Utc::now().to_rfc3339();

            conn.execute(
                "INSERT INTO persona_versions (persona_id, version, persona_md, memories_md, created_at) VALUES (?1,?2,?3,?4,?5)",
                rusqlite::params![pid, ver, pmd, mmd, now],
            )?;

            if target2 == "memories" {
                let new_md = format!("{}\n\n### Correction (v{})\n- {}", mmd, new_ver, rule2);
                conn.execute(
                    "UPDATE personas SET memories_md=?1, version=?2, updated_at=?3 WHERE id=?4",
                    rusqlite::params![new_md, new_ver, now, pid],
                )?;
            } else {
                let new_md = format!("{}\n\n### Correction (v{})\n- {}", pmd, new_ver, rule2);
                conn.execute(
                    "UPDATE personas SET persona_md=?1, version=?2, updated_at=?3 WHERE id=?4",
                    rusqlite::params![new_md, new_ver, now, pid],
                )?;
            }

            conn.execute(
                "INSERT INTO corrections (persona_id,target,original,correction,applied_at) VALUES (?1,?2,?3,?4,?5)",
                rusqlite::params![pid, target2, orig, corr, now],
            )?;

            Ok::<_, anyhow::Error>(())
        }
    })
    .await
    .context("spawn_blocking join error")??;

    Ok(CorrectionResult { success: true, target, version: new_ver })
}
