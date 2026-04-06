// ── Persona tag presets (clickable chips) ──

export const PERSONA_TAG_PRESETS = [
  "爱撒娇", "独立", "温柔", "话多", "话少",
  "焦虑型", "安全型", "冷淡", "热情", "毒舌",
  "理性", "感性", "搞笑", "沉稳", "暴躁",
  "社牛", "社恐", "浪漫", "务实", "佛系",
];

// ── Emoji avatar presets ──

export const AVATAR_EMOJI_PRESETS = [
  "💜", "🌸", "🦊", "🐱", "🌙",
  "🌻", "🍑", "🦋", "🐰", "✨",
  "🌹", "🍀", "🎀", "🐻", "🌊",
  "🍰", "🦢", "💫", "🌈", "🍓",
];

// ── Provider options ──

export const PROVIDER_OPTIONS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o / GPT-4.1",
    defaultUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
    guideUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude Sonnet / Opus",
    defaultUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    guideUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "local",
    name: "本地模型",
    description: "Ollama / LM Studio",
    defaultUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.1:8b",
    guideUrl: "https://ollama.com/download",
  },
];
