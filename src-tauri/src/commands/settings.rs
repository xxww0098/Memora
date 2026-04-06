use crate::core::ai_provider;
use crate::core::models::AppSettings;

#[tauri::command]
pub async fn get_settings() -> Result<AppSettings, String> {
    let config = ai_provider::load_config();
    Ok(AppSettings {
        provider: format!("{:?}", config.api_format).to_lowercase(),
        api_key: if config.api_key.is_empty() {
            String::new()
        } else {
            // Mask the key for frontend display
            let key = &config.api_key;
            if key.len() > 8 {
                format!("{}...{}", &key[..4], &key[key.len()-4..])
            } else {
                "****".to_string()
            }
        },
        base_url: config.base_url,
        model: config.model,
        has_api_key: !config.api_key.is_empty(),
    })
}

#[tauri::command]
pub async fn save_settings(
    provider: String,
    api_key: String,
    base_url: String,
    model: String,
) -> Result<(), String> {
    let api_format = match provider.as_str() {
        "anthropic" => ai_provider::ApiFormat::Anthropic,
        "local" => ai_provider::ApiFormat::Local,
        _ => ai_provider::ApiFormat::Openai,
    };

    let config = ai_provider::AiConfig {
        enabled: true,
        api_format,
        base_url,
        api_key,
        model,
    };

    ai_provider::save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn validate_api_key(
    provider: String,
    api_key: String,
    base_url: String,
    model: String,
) -> Result<bool, String> {
    let api_format = match provider.as_str() {
        "anthropic" => ai_provider::ApiFormat::Anthropic,
        "local" => ai_provider::ApiFormat::Local,
        _ => ai_provider::ApiFormat::Openai,
    };

    let config = ai_provider::AiConfig {
        enabled: true,
        api_format,
        base_url,
        api_key,
        model,
    };

    ai_provider::validate_key(&config)
        .await
        .map_err(|e| e.to_string())
}
