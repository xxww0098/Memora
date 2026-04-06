// ── Shared types for Memora frontend ──

export interface AppSettings {
  provider: string;
  api_key: string;
  base_url: string;
  model: string;
  has_api_key: boolean;
}

export interface PersonaSummary {
  id: string;
  name: string;
  avatar_emoji: string;
  description: string;
  tags: string[];
  version: number;
  last_chat_at: string | null;
  created_at: string;
}

export interface Persona {
  id: string;
  slug: string;
  name: string;
  avatar_emoji: string;
  description: string;
  tags_json: string;
  persona_md: string;
  memories_md: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BasicInfo {
  name: string;
  description: string;
  tags: string[];
  avatar_emoji: string;
}

export interface ChatMessage {
  id: number;
  persona_id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface SessionSummary {
  session_id: string;
  message_count: number;
  last_message_at: string;
  preview: string;
}

export interface ParsedContent {
  source: string;
  target_name: string | null;
  messages: RawMessage[];
  message_count: number;
}

export interface RawMessage {
  sender: string;
  content: string;
  timestamp: string | null;
  is_from_me: boolean;
}

export interface GenerateResult {
  persona_id: string;
  persona_md: string;
  memories_md: string;
  summary: string;
}

export interface GenerateProgress {
  step: number;
  total: number;
  label: string;
}

export type AppView =
  | "welcome"
  | "dashboard"
  | "create"
  | "chat"
  | "settings"
  | "profile";
