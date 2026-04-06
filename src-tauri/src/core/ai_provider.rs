use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::{LazyLock, Mutex};
use tracing::{debug, warn};

// ── Configuration ───────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ApiFormat {
    Openai,
    Anthropic,
    Local,
}

impl Default for ApiFormat {
    fn default() -> Self {
        Self::Openai
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub enabled: bool,
    #[serde(default)]
    pub api_format: ApiFormat,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            api_format: ApiFormat::default(),
            base_url: String::new(),
            api_key: String::new(),
            model: "gpt-4o".to_string(),
        }
    }
}

// ── Encryption ──────────────────────────────────────────────────────

fn get_encryption_key() -> aes_gcm::Key<aes_gcm::Aes256Gcm> {
    use sha2::{Digest, Sha256};
    let machine_id = machine_uid::get().unwrap_or_else(|_| "memora-fallback-id-456".to_string());
    let mut hasher = Sha256::new();
    hasher.update(b"memora-api-key-salt");
    hasher.update(machine_id.as_bytes());
    let result = hasher.finalize();
    *aes_gcm::Key::<aes_gcm::Aes256Gcm>::from_slice(result.as_slice())
}

pub fn encrypt_api_key(plain: &str) -> String {
    use aes_gcm::{
        Aes256Gcm, KeyInit,
        aead::{Aead, AeadCore, OsRng},
    };
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

    if plain.is_empty() {
        return String::new();
    }
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    match cipher.encrypt(&nonce, plain.as_bytes()) {
        Ok(ciphertext) => {
            let mut combined = nonce.to_vec();
            combined.extend_from_slice(&ciphertext);
            BASE64.encode(combined)
        }
        Err(_) => plain.to_string(),
    }
}

pub fn decrypt_api_key(encoded: &str) -> String {
    use aes_gcm::{Aes256Gcm, KeyInit, Nonce, aead::Aead};
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

    if encoded.is_empty() {
        return String::new();
    }
    let Ok(decoded) = BASE64.decode(encoded) else {
        return encoded.to_string();
    };
    if decoded.len() < 12 {
        return encoded.to_string();
    }
    let (nonce_bytes, ciphertext) = decoded.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let key = get_encryption_key();
    let cipher = Aes256Gcm::new(&key);
    match cipher.decrypt(nonce, ciphertext) {
        Ok(plaintext) => String::from_utf8(plaintext).unwrap_or_else(|_| encoded.to_string()),
        Err(_) => encoded.to_string(),
    }
}

// ── Config Load/Save ────────────────────────────────────────────────

pub fn load_config() -> AiConfig {
    let path = super::paths::settings_path();
    if !path.exists() {
        return AiConfig::default();
    }
    match std::fs::read_to_string(&path) {
        Ok(content) => match serde_json::from_str::<AiConfig>(&content) {
            Ok(mut config) => {
                config.api_key = decrypt_api_key(&config.api_key);
                config
            }
            Err(err) => {
                warn!("Failed to parse AI config: {}", err);
                AiConfig::default()
            }
        },
        Err(err) => {
            warn!("Failed to read AI config: {}", err);
            AiConfig::default()
        }
    }
}

pub fn save_config(config: &AiConfig) -> Result<()> {
    let path = super::paths::settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).context("Failed to create config directory")?;
    }
    let mut config_to_save = config.clone();
    config_to_save.api_key = encrypt_api_key(&config_to_save.api_key);

    let content =
        serde_json::to_string_pretty(&config_to_save).context("Failed to serialize config")?;
    std::fs::write(&path, content).context("Failed to write config")?;
    Ok(())
}

// ── HTTP Client ─────────────────────────────────────────────────────

static SHARED_HTTP_CLIENT: LazyLock<Mutex<Option<reqwest::Client>>> =
    LazyLock::new(|| Mutex::new(None));

fn get_http_client() -> Result<reqwest::Client> {
    let mut guard = SHARED_HTTP_CLIENT
        .lock()
        .map_err(|_| anyhow::anyhow!("HTTP client lock poisoned"))?;

    if let Some(client) = guard.as_ref() {
        return Ok(client.clone());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(10))
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .pool_max_idle_per_host(4)
        .build()
        .context("Failed to build HTTP client")?;

    *guard = Some(client.clone());
    Ok(client)
}

// ── Chat Completion (Non-streaming) ─────────────────────────────────

#[derive(Serialize)]
struct ChatMsg {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<ChatMsg>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Deserialize)]
struct OpenAiMessage {
    content: Option<String>,
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    system: String,
    messages: Vec<ChatMsg>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: String,
}

/// Non-streaming chat completion for persona generation
pub async fn chat_completion(
    config: &AiConfig,
    system_prompt: &str,
    user_message: &str,
    max_tokens: u32,
) -> Result<String> {
    let client = get_http_client()?;

    match config.api_format {
        ApiFormat::Anthropic => {
            let url = format!(
                "{}/messages",
                config.base_url.trim_end_matches('/')
            );
            let body = AnthropicRequest {
                model: config.model.clone(),
                system: system_prompt.to_string(),
                messages: vec![ChatMsg {
                    role: "user".to_string(),
                    content: user_message.to_string(),
                }],
                max_tokens,
                temperature: 0.7,
            };

            let resp = client
                .post(&url)
                .header("x-api-key", &config.api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .context("Anthropic API request failed")?;

            let status = resp.status();
            let text = resp.text().await.context("Failed to read Anthropic response")?;
            if !status.is_success() {
                anyhow::bail!("Anthropic API error ({}): {}", status, text);
            }

            let parsed: AnthropicResponse =
                serde_json::from_str(&text).context("Failed to parse Anthropic response")?;
            parsed
                .content
                .first()
                .map(|c| c.text.clone())
                .ok_or_else(|| anyhow::anyhow!("Empty Anthropic response"))
        }
        ApiFormat::Openai | ApiFormat::Local => {
            let url = format!(
                "{}/chat/completions",
                config.base_url.trim_end_matches('/')
            );
            let body = OpenAiRequest {
                model: config.model.clone(),
                messages: vec![
                    ChatMsg {
                        role: "system".to_string(),
                        content: system_prompt.to_string(),
                    },
                    ChatMsg {
                        role: "user".to_string(),
                        content: user_message.to_string(),
                    },
                ],
                temperature: 0.7,
                max_tokens,
            };

            let mut req = client
                .post(&url)
                .header("content-type", "application/json");

            if !config.api_key.is_empty() {
                req = req.header("authorization", format!("Bearer {}", config.api_key));
            }

            let resp = req
                .json(&body)
                .send()
                .await
                .context("OpenAI API request failed")?;

            let status = resp.status();
            let text = resp.text().await.context("Failed to read OpenAI response")?;
            if !status.is_success() {
                anyhow::bail!("OpenAI API error ({}): {}", status, text);
            }

            let parsed: OpenAiResponse =
                serde_json::from_str(&text).context("Failed to parse OpenAI response")?;
            parsed
                .choices
                .first()
                .and_then(|c| c.message.content.clone())
                .ok_or_else(|| anyhow::anyhow!("Empty OpenAI response"))
        }
    }
}

/// Streaming chat completion for real-time chat
pub async fn chat_completion_stream(
    config: &AiConfig,
    system_prompt: &str,
    messages: Vec<(String, String)>, // (role, content) pairs
    app: &tauri::AppHandle,
    request_id: &str,
) -> Result<String> {
    let client = get_http_client()?;

    let mut chat_messages: Vec<ChatMsg> = Vec::new();

    match config.api_format {
        ApiFormat::Anthropic => {
            for (role, content) in &messages {
                chat_messages.push(ChatMsg {
                    role: role.clone(),
                    content: content.clone(),
                });
            }

            let url = format!("{}/messages", config.base_url.trim_end_matches('/'));

            #[derive(Serialize)]
            struct StreamReq {
                model: String,
                system: String,
                messages: Vec<ChatMsg>,
                max_tokens: u32,
                temperature: f32,
                stream: bool,
            }

            let body = StreamReq {
                model: config.model.clone(),
                system: system_prompt.to_string(),
                messages: chat_messages,
                max_tokens: 4096,
                temperature: 0.8,
                stream: true,
            };

            let resp = client
                .post(&url)
                .header("x-api-key", &config.api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .context("Anthropic stream request failed")?;

            stream_sse_response(resp, app, request_id).await
        }
        ApiFormat::Openai | ApiFormat::Local => {
            chat_messages.push(ChatMsg {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            });
            for (role, content) in &messages {
                chat_messages.push(ChatMsg {
                    role: role.clone(),
                    content: content.clone(),
                });
            }

            let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));

            #[derive(Serialize)]
            struct StreamReq {
                model: String,
                messages: Vec<ChatMsg>,
                temperature: f32,
                max_tokens: u32,
                stream: bool,
            }

            let body = StreamReq {
                model: config.model.clone(),
                messages: chat_messages,
                temperature: 0.8,
                max_tokens: 4096,
                stream: true,
            };

            let mut req = client
                .post(&url)
                .header("content-type", "application/json");
            if !config.api_key.is_empty() {
                req = req.header("authorization", format!("Bearer {}", config.api_key));
            }

            let resp = req
                .json(&body)
                .send()
                .await
                .context("OpenAI stream request failed")?;

            stream_sse_response(resp, app, request_id).await
        }
    }
}

/// Parse SSE stream and emit deltas to frontend
async fn stream_sse_response(
    resp: reqwest::Response,
    app: &tauri::AppHandle,
    request_id: &str,
) -> Result<String> {
    use futures::StreamExt;
    use tauri::Emitter;

    let mut full_text = String::new();
    let mut stream = resp.bytes_stream();

    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.context("Stream chunk error")?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete SSE lines
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    continue;
                }

                // Try to extract delta text
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    let delta_text = json
                        .get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("delta"))
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                        .or_else(|| {
                            // Anthropic format
                            json.get("delta")
                                .and_then(|d| d.get("text"))
                                .and_then(|t| t.as_str())
                        });

                    if let Some(text) = delta_text {
                        full_text.push_str(text);

                        #[derive(Serialize, Clone)]
                        struct StreamPayload {
                            delta: String,
                            request_id: String,
                        }

                        app.emit(
                            "chat://stream",
                            StreamPayload {
                                delta: text.to_string(),
                                request_id: request_id.to_string(),
                            },
                        )
                        .ok();
                    }
                }
            }
        }
    }

    if full_text.is_empty() {
        anyhow::bail!("AI returned empty stream response");
    }

    Ok(full_text)
}

/// Validate API key by sending a minimal request
pub async fn validate_key(config: &AiConfig) -> Result<bool> {
    let test_config = AiConfig {
        enabled: true,
        ..config.clone()
    };

    match chat_completion(&test_config, "You are a test.", "Say hi", 5).await {
        Ok(_) => Ok(true),
        Err(e) => {
            debug!("API key validation failed: {}", e);
            Ok(false)
        }
    }
}
