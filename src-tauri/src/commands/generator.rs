use crate::core::ai_provider;
use crate::core::db_pool::memora_pool;
use crate::core::models::{BasicInfo, GenerateProgress, GenerateResult, ParsedContent};
use crate::core::prompts;
use anyhow::Context;
use tauri::Emitter;

#[tauri::command]
pub async fn generate_persona(
    app: tauri::AppHandle,
    basic_info: BasicInfo,
    parsed_contents: Vec<ParsedContent>,
) -> Result<GenerateResult, String> {
    generate_inner(app, basic_info, parsed_contents)
        .await
        .map_err(|e| e.to_string())
}

async fn generate_inner(
    app: tauri::AppHandle,
    info: BasicInfo,
    parsed: Vec<ParsedContent>,
) -> anyhow::Result<GenerateResult> {
    let config = ai_provider::load_config();
    if !config.enabled || config.api_key.is_empty() {
        anyhow::bail!("请先设置 AI 服务密钥");
    }

    // Combine all chat text
    let chat_text = if parsed.is_empty() {
        String::new()
    } else {
        parsed
            .iter()
            .flat_map(|p| &p.messages)
            .map(|m| {
                let sender = if m.is_from_me { "我" } else { &m.sender };
                format!("{}: {}", sender, m.content)
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let tags_str = info.tags.join("、");
    let has_chat_data = !chat_text.is_empty();

    // Step 1: Analyze persona
    emit_progress(&app, 1, 4, "分析性格中...")?;
    let persona_analysis = if has_chat_data {
        let prompt = prompts::render(prompts::PERSONA_ANALYZER, &[
            ("chat_text", &chat_text),
            ("name", &info.name),
            ("description", &info.description),
            ("tags", &tags_str),
        ]);
        ai_provider::chat_completion(&config, &prompt, "请开始分析", 4096).await?
    } else {
        format!(
            "用户没有提供聊天记录。基于用户描述生成：\n名字：{}\n描述：{}\n标签：{}",
            info.name, info.description, tags_str
        )
    };

    // Step 2: Build persona
    emit_progress(&app, 2, 4, "构建人格中...")?;
    let persona_prompt = prompts::render(prompts::PERSONA_BUILDER, &[
        ("analysis", &persona_analysis),
        ("tags", &tags_str),
    ]);
    let persona_md =
        ai_provider::chat_completion(&config, &persona_prompt, "请构建 Persona 文档", 4096)
            .await?;

    // Step 3: Analyze memories
    emit_progress(&app, 3, 4, "整理回忆中...")?;
    let memories_md = if has_chat_data {
        let mem_analysis_prompt = prompts::render(prompts::MEMORIES_ANALYZER, &[
            ("chat_text", &chat_text),
        ]);
        let mem_analysis =
            ai_provider::chat_completion(&config, &mem_analysis_prompt, "请分析共同记忆", 4096)
                .await?;

        // Step 4: Build memories
        emit_progress(&app, 4, 4, "完成！")?;
        let mem_build_prompt = prompts::render(prompts::MEMORIES_BUILDER, &[
            ("analysis", &mem_analysis),
        ]);
        ai_provider::chat_completion(&config, &mem_build_prompt, "请构建 Memories 文档", 4096)
            .await?
    } else {
        emit_progress(&app, 4, 4, "完成！")?;
        format!("暂无共同记忆。当提供聊天记录后可以补充。")
    };

    // Save to database (in spawn_blocking to avoid Send issues with r2d2)
    let persona_id = uuid::Uuid::new_v4().to_string();
    let slug = generate_slug(&info.name);
    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serde_json::to_string(&info.tags).unwrap_or_default();

    let pid = persona_id.clone();
    let pmd = persona_md.clone();
    let mmd = memories_md.clone();
    let info_name = info.name.clone();
    let info_emoji = info.avatar_emoji.clone();
    let info_desc = info.description.clone();

    tokio::task::spawn_blocking(move || {
        let pool = memora_pool();
        let conn = pool.get().context("DB connection failed")?;

        conn.execute(
            r#"INSERT INTO personas (id, slug, name, avatar_emoji, description, tags_json, persona_md, memories_md, version, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?9)"#,
            rusqlite::params![pid, slug, info_name, info_emoji, info_desc, tags_json, pmd, mmd, now],
        )
        .context("Failed to insert persona")?;

        conn.execute(
            r#"INSERT INTO persona_versions (persona_id, version, persona_md, memories_md, created_at)
               VALUES (?1, 1, ?2, ?3, ?4)"#,
            rusqlite::params![pid, pmd, mmd, now],
        )
        .context("Failed to create version snapshot")?;

        Ok::<(), anyhow::Error>(())
    })
    .await
    .context("spawn_blocking join error")??;

    let summary = format!(
        "已为「{}」生成 {} 人格和回忆",
        info.name,
        if has_chat_data { "基于聊天记录的" } else { "基于描述的" }
    );

    Ok(GenerateResult {
        persona_id,
        persona_md,
        memories_md,
        summary,
    })
}

fn emit_progress(app: &tauri::AppHandle, step: u32, total: u32, label: &str) -> anyhow::Result<()> {
    app.emit(
        "generate://progress",
        GenerateProgress {
            step,
            total,
            label: label.to_string(),
        },
    )
    .context("Failed to emit progress")?;
    Ok(())
}

fn generate_slug(name: &str) -> String {
    use pinyin::ToPinyin;

    let pinyin_str: String = name
        .chars()
        .filter_map(|c| {
            c.to_pinyin().map(|p| p.plain().to_string()).or_else(|| {
                if c.is_alphanumeric() || c == '-' || c == '_' {
                    Some(c.to_string())
                } else {
                    None
                }
            })
        })
        .collect::<Vec<_>>()
        .join("-");

    if pinyin_str.is_empty() {
        uuid::Uuid::new_v4().to_string()[..8].to_string()
    } else {
        pinyin_str.to_lowercase()
    }
}
