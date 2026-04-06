use crate::core::models::{DetectResult, ParsedContent};
use crate::parsers;

#[tauri::command]
pub async fn detect_and_parse(paths: Vec<String>) -> Result<Vec<DetectResult>, String> {
    let mut results = Vec::new();
    for path_str in &paths {
        let path = std::path::Path::new(path_str);
        match parsers::detect_and_parse(path) {
            Ok(result) => results.push(result),
            Err(e) => {
                tracing::warn!("Failed to parse {}: {}", path_str, e);
            }
        }
    }
    Ok(results)
}

#[tauri::command]
pub async fn parse_pasted_text(text: String) -> Result<ParsedContent, String> {
    parsers::parse_pasted_text(&text).map_err(|e| e.to_string())
}
