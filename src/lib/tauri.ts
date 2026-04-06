import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  BasicInfo,
  ChatMessage,
  GenerateResult,
  ParsedContent,
  Persona,
  PersonaSummary,
  SessionSummary,
} from "@/types";

// ── Settings ──
export const getSettings = () => invoke<AppSettings>("get_settings");

export const saveSettings = (provider: string, api_key: string, base_url: string, model: string) =>
  invoke("save_settings", { provider, apiKey: api_key, baseUrl: base_url, model });

export const validateApiKey = (provider: string, api_key: string, base_url: string, model: string) =>
  invoke<boolean>("validate_api_key", { provider, apiKey: api_key, baseUrl: base_url, model });

// ── Parser ──
export const detectAndParse = (paths: string[]) =>
  invoke<Array<{ source: string; target_name: string | null; parsed: ParsedContent }>>(
    "detect_and_parse",
    { paths },
  );

export const parsePastedText = (text: string) =>
  invoke<ParsedContent>("parse_pasted_text", { text });

// ── Persona ──
export const listPersonas = () => invoke<PersonaSummary[]>("list_personas");

export const getPersona = (id: string) => invoke<Persona>("get_persona", { id });

export const deletePersona = (id: string) => invoke("delete_persona", { id });

export const rollbackPersona = (id: string, version: number) =>
  invoke("rollback_persona", { id, version });

// ── Generator ──
export const generatePersona = (basicInfo: BasicInfo, parsedContents: ParsedContent[]) =>
  invoke<GenerateResult>("generate_persona", { basicInfo, parsedContents });

// ── Chat ──
export const sendMessage = (personaId: string, sessionId: string, content: string) =>
  invoke<string>("send_message", { personaId, sessionId, content });

export const getChatHistory = (personaId: string, sessionId?: string, limit?: number) =>
  invoke<ChatMessage[]>("get_chat_history", { personaId, sessionId, limit });

export const listChatSessions = (personaId: string) =>
  invoke<SessionSummary[]>("list_chat_sessions", { personaId });

export const newChatSession = (personaId: string) =>
  invoke<string>("new_chat_session", { personaId });

export const deleteChatSession = (personaId: string, sessionId: string) =>
  invoke("delete_chat_session", { personaId, sessionId });

// ── Correction ──
export const submitCorrection = (personaId: string, original: string, correction: string) =>
  invoke("submit_correction", { personaId, original, correction });
