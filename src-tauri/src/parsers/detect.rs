use anyhow::{Context, Result};
use std::path::Path;

/// Read the first N bytes of a file for sniffing
fn read_head(path: &Path, max_bytes: usize) -> Result<String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path).context("Cannot open file")?;
    let mut buf = vec![0u8; max_bytes];
    let n = file.read(&mut buf).context("Cannot read file")?;
    buf.truncate(n);
    Ok(String::from_utf8_lossy(&buf).to_string())
}

/// Check if file is a SQLite database
fn is_sqlite(path: &Path) -> bool {
    std::fs::read(path)
        .map(|b| b.len() >= 16 && &b[..16] == b"SQLite format 3\0")
        .unwrap_or(false)
}

lazy_static::lazy_static! {
    static ref WECHAT_TXT_PATTERN: regex::Regex =
        regex::Regex::new(r"(?m)^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(:\d{2})?\s+.+").unwrap();
}

/// Detect the source format of a file
pub fn detect_source(path: &Path) -> Result<String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    match ext.as_str() {
        "db" if is_sqlite(path) => {
            if filename == "chat.db" {
                Ok("imessage".to_string())
            } else {
                Ok("unknown".to_string())
            }
        }
        "html" | "htm" => {
            let head = read_head(path, 2048)?;
            if head.contains("WechatExporter") || head.contains("wx-msg") {
                Ok("wechat_html".to_string())
            } else {
                Ok("generic_text".to_string())
            }
        }
        "txt" => {
            let head = read_head(path, 4096)?;
            if WECHAT_TXT_PATTERN.is_match(&head) {
                Ok("wechat_txt".to_string())
            } else {
                Ok("generic_text".to_string())
            }
        }
        "csv" => {
            let head = read_head(path, 1024)?;
            let lower = head.to_lowercase();
            if lower.contains("nickname") || lower.contains("message") {
                Ok("wechat_csv".to_string())
            } else {
                Ok("generic_text".to_string())
            }
        }
        "json" => {
            let head = read_head(path, 2048)?;
            if head.contains("\"messages\"") && head.contains("\"date_unixtime\"") {
                Ok("telegram".to_string())
            } else {
                Ok("generic_text".to_string())
            }
        }
        "jpg" | "jpeg" | "heic" | "png" => Ok("photo".to_string()),
        _ => Ok("unknown".to_string()),
    }
}
