use serde::{Deserialize, Serialize};

// ── Settings ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub provider: String,        // "openai" | "anthropic" | "local"
    pub api_key: String,         // encrypted at rest
    pub base_url: String,
    pub model: String,
    pub has_api_key: bool,       // computed field, not stored
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            provider: "openai".to_string(),
            api_key: String::new(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o".to_string(),
            has_api_key: false,
        }
    }
}

// ── Persona ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BasicInfo {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub avatar_emoji: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Persona {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub avatar_emoji: String,
    pub description: String,
    pub tags_json: String,
    pub persona_md: String,
    pub memories_md: String,
    pub version: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonaSummary {
    pub id: String,
    pub name: String,
    pub avatar_emoji: String,
    pub description: String,
    pub tags: Vec<String>,
    pub version: i32,
    pub last_chat_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionSummary {
    pub version: i32,
    pub created_at: String,
}

// ── Chat ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: i64,
    pub persona_id: String,
    pub session_id: String,
    pub role: String,           // "user" | "assistant"
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub session_id: String,
    pub message_count: i64,
    pub last_message_at: String,
    pub preview: String,
}

// ── Parser ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedContent {
    pub source: String,
    pub target_name: Option<String>,
    pub messages: Vec<RawMessage>,
    pub message_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawMessage {
    pub sender: String,
    pub content: String,
    pub timestamp: Option<String>,
    pub is_from_me: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectResult {
    pub source: String,
    pub target_name: Option<String>,
    pub parsed: ParsedContent,
}

// ── Generator ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResult {
    pub persona_id: String,
    pub persona_md: String,
    pub memories_md: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateProgress {
    pub step: u32,
    pub total: u32,
    pub label: String,
}

// ── Correction ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrectionResult {
    pub success: bool,
    pub target: String,      // "persona" | "memories"
    pub version: i32,
}
