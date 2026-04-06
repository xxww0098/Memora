pub mod detect;
pub mod wechat;

use crate::core::models::{DetectResult, ParsedContent, RawMessage};
use anyhow::{Context, Result};
use std::path::Path;

/// Auto-detect format and parse a file
pub fn detect_and_parse(path: &Path) -> Result<DetectResult> {
    let source = detect::detect_source(path)?;
    let parsed = match source.as_str() {
        "wechat_txt" => wechat::parse_txt(path)?,
        "wechat_html" => wechat::parse_html(path)?,
        "wechat_csv" => wechat::parse_csv(path)?,
        "generic_text" => parse_generic_text(path)?,
        other => anyhow::bail!("Unsupported format: {}", other),
    };

    let target_name = auto_detect_target(&parsed.messages);

    Ok(DetectResult {
        source,
        target_name: target_name.clone(),
        parsed: ParsedContent {
            target_name,
            ..parsed
        },
    })
}

/// Parse pasted text (try wechat format first, then generic)
pub fn parse_pasted_text(text: &str) -> Result<ParsedContent> {
    if let Ok(parsed) = wechat::parse_txt_content(text) {
        if !parsed.messages.is_empty() {
            return Ok(parsed);
        }
    }
    // Fallback: treat each line as a message
    let messages: Vec<RawMessage> = text
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| RawMessage {
            sender: "未知".to_string(),
            content: l.trim().to_string(),
            timestamp: None,
            is_from_me: false,
        })
        .collect();

    let count = messages.len();
    Ok(ParsedContent {
        source: "pasted_text".to_string(),
        target_name: None,
        messages,
        message_count: count,
    })
}

fn parse_generic_text(path: &Path) -> Result<ParsedContent> {
    let content = std::fs::read_to_string(path).context("Failed to read file")?;
    parse_pasted_text(&content)
}

/// Frequency analysis to detect the chat counterpart
fn auto_detect_target(messages: &[RawMessage]) -> Option<String> {
    use std::collections::HashMap;
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for m in messages {
        if !m.is_from_me && !m.sender.is_empty() {
            *counts.entry(&m.sender).or_default() += 1;
        }
    }
    counts
        .into_iter()
        .max_by_key(|(_, c)| *c)
        .map(|(name, _)| name.to_string())
}
