use crate::models::{ParsedContent, RawMessage};
use anyhow::{Context, Result};
use std::path::Path;

lazy_static::lazy_static! {
    // Pattern: 2024-03-15 14:32 小美
    // or:      2024-03-15 14:32:05 小美
    static ref MSG_HEADER: regex::Regex =
        regex::Regex::new(r"^(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$").unwrap();
}

/// Parse WeChat TXT export format
pub fn parse_txt(path: &Path) -> Result<ParsedContent> {
    let content = std::fs::read_to_string(path).context("Failed to read txt file")?;
    parse_txt_content(&content)
}

/// Parse WeChat TXT content string
pub fn parse_txt_content(text: &str) -> Result<ParsedContent> {
    let mut messages: Vec<RawMessage> = Vec::new();
    let mut current_sender = String::new();
    let mut current_timestamp = String::new();
    let mut current_content = String::new();
    let mut header_found = false;

    for line in text.lines() {
        if let Some(caps) = MSG_HEADER.captures(line) {
            header_found = true;
            // Save previous message
            if !current_content.is_empty() {
                let is_me = is_self_sender(&current_sender);
                messages.push(RawMessage {
                    sender: current_sender.clone(),
                    content: current_content.trim().to_string(),
                    timestamp: Some(current_timestamp.clone()),
                    is_from_me: is_me,
                });
            }
            current_timestamp = caps[1].to_string();
            current_sender = caps[2].trim().to_string();
            current_content = String::new();
        } else if !line.trim().is_empty() {
            if !current_content.is_empty() {
                current_content.push('\n');
            }
            current_content.push_str(line.trim());
        }
    }

    // If no WeChat-format header was matched, return empty so the caller
    // can fall back to generic line-by-line parsing instead of lumping
    // everything into one message.
    if !header_found {
        return Ok(ParsedContent {
            source: "wechat_txt".to_string(),
            target_name: None,
            messages: Vec::new(),
            message_count: 0,
        });
    }

    // Last message
    if !current_content.is_empty() {
        let is_me = is_self_sender(&current_sender);
        messages.push(RawMessage {
            sender: current_sender,
            content: current_content.trim().to_string(),
            timestamp: Some(current_timestamp),
            is_from_me: is_me,
        });
    }

    let count = messages.len();
    Ok(ParsedContent {
        source: "wechat_txt".to_string(),
        target_name: None,
        messages,
        message_count: count,
    })
}

/// Parse WeChat HTML export (WechatExporter format)
pub fn parse_html(path: &Path) -> Result<ParsedContent> {
    let content = std::fs::read_to_string(path).context("Failed to read html file")?;
    let document = scraper::Html::parse_document(&content);

    let msg_selector =
        scraper::Selector::parse(".msg, .message, [class*='msg']").unwrap();
    let sender_selector =
        scraper::Selector::parse(".nickname, .sender, .name").unwrap();
    let content_selector =
        scraper::Selector::parse(".content, .text, .msg-text").unwrap();
    let time_selector =
        scraper::Selector::parse(".time, .timestamp, .date").unwrap();

    let mut messages: Vec<RawMessage> = Vec::new();

    for msg_el in document.select(&msg_selector) {
        let sender = msg_el
            .select(&sender_selector)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        let text = msg_el
            .select(&content_selector)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        let timestamp = msg_el
            .select(&time_selector)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string());

        if !text.is_empty() {
            let is_me = is_self_sender(&sender);
            messages.push(RawMessage {
                sender,
                content: text,
                timestamp,
                is_from_me: is_me,
            });
        }
    }

    let count = messages.len();
    Ok(ParsedContent {
        source: "wechat_html".to_string(),
        target_name: None,
        messages,
        message_count: count,
    })
}

/// Parse WeChat CSV export
pub fn parse_csv(path: &Path) -> Result<ParsedContent> {
    let mut reader = csv::Reader::from_path(path).context("Failed to open CSV")?;
    let mut messages: Vec<RawMessage> = Vec::new();

    for result in reader.records() {
        let record = result.context("Failed to read CSV record")?;
        // Try common column layouts
        if record.len() >= 3 {
            let sender = record.get(0).unwrap_or("").trim().to_string();
            let content = record.get(1).unwrap_or("").trim().to_string();
            let timestamp = record.get(2).map(|s| s.trim().to_string());
            if !content.is_empty() {
                let is_me = is_self_sender(&sender);
                messages.push(RawMessage {
                    sender,
                    content,
                    timestamp,
                    is_from_me: is_me,
                });
            }
        }
    }

    let count = messages.len();
    Ok(ParsedContent {
        source: "wechat_csv".to_string(),
        target_name: None,
        messages,
        message_count: count,
    })
}

/// Heuristic: detect if a sender name is "self"
fn is_self_sender(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower == "我"
        || lower == "me"
        || lower == "self"
        || lower == "you"
        || lower.contains("自己")
}
