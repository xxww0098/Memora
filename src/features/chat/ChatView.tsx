import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getPersona, newChatSession, sendMessage } from "@/lib/tauri";
import type { ChatMessage, Persona } from "@/types";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  personaId: string;
  onBack: () => void;
}

export function ChatView({ personaId, onBack }: Props) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load persona + create/load session
  useEffect(() => {
    (async () => {
      try {
        const p = await getPersona(personaId);
        setPersona(p);
        const sid = await newChatSession(personaId);
        setSessionId(sid);
      } catch (e) {
        toast.error(`加载失败: ${e}`);
      }
    })();
  }, [personaId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !sessionId || streaming) return;
    const text = input.trim();
    setInput("");
    setStreaming(true);
    setStreamText("");

    // Optimistic: add user message
    const userMsg: ChatMessage = {
      id: Date.now(),
      persona_id: personaId,
      session_id: sessionId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Listen for stream
    const unlisten = await listen<{ delta: string; request_id: string }>(
      "chat://stream",
      (event) => {
        setStreamText((prev) => prev + event.payload.delta);
      },
    );

    try {
      const fullReply = await sendMessage(personaId, sessionId, text);
      setStreamText("");
      const assistantMsg: ChatMessage = {
        id: Date.now() + 1,
        persona_id: personaId,
        session_id: sessionId,
        role: "assistant",
        content: fullReply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      toast.error(`发送失败: ${e}`);
      setStreamText("");
    } finally {
      setStreaming(false);
      unlisten();
      inputRef.current?.focus();
    }
  }, [input, sessionId, streaming, personaId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!persona) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100vh" }}>
        <span className="text-muted">加载中...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Chat header */}
      <header style={styles.header}>
        <button type="button" onClick={onBack} style={styles.backBtn}>
          <ArrowLeft size={18} />
        </button>
        <div style={styles.headerInfo}>
          <span style={{ fontSize: "1.4rem" }}>{persona.avatar_emoji}</span>
          <span style={{ fontWeight: 500, fontSize: "1.05rem" }}>{persona.name}</span>
        </div>
        <div style={{ width: 36 }} />
      </header>

      {/* Messages */}
      <div style={styles.messagesArea}>
        {messages.length === 0 && !streaming && (
          <div style={styles.emptyChat}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>{persona.avatar_emoji}</div>
            <p className="text-display" style={{ fontSize: "1rem", color: "var(--color-earth-500)" }}>
              和{persona.name}说点什么吧
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.bubbleRow,
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                ...styles.bubble,
                ...(msg.role === "user" ? styles.userBubble : styles.assistantBubble),
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {streaming && streamText && (
          <div style={{ ...styles.bubbleRow, justifyContent: "flex-start" }}>
            <div style={{ ...styles.bubble, ...styles.assistantBubble }}>
              {streamText}
              <span style={styles.cursor}>▍</span>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {streaming && !streamText && (
          <div style={{ ...styles.bubbleRow, justifyContent: "flex-start" }}>
            <div style={{ ...styles.bubble, ...styles.assistantBubble, ...styles.typingBubble }}>
              <span style={{ ...styles.dot, animationDelay: "0ms" }}>·</span>
              <span style={{ ...styles.dot, animationDelay: "150ms" }}>·</span>
              <span style={{ ...styles.dot, animationDelay: "300ms" }}>·</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`和${persona.name}说点什么...`}
            style={styles.input}
            rows={1}
            disabled={streaming}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            style={{
              ...styles.sendBtn,
              opacity: input.trim() && !streaming ? 1 : 0.4,
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: "100%", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--color-cream-200)", flexShrink: 0 },
  backBtn: { width: 36, height: 36, borderRadius: "var(--radius-md)", border: "none", background: "none", color: "var(--color-earth-500)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  headerInfo: { display: "flex", alignItems: "center", gap: 10 },
  messagesArea: { flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 },
  emptyChat: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, opacity: 0.7 },
  bubbleRow: { display: "flex", width: "100%", animation: "slide-up 300ms var(--ease-out-expo) both" },
  bubble: { maxWidth: "75%", padding: "10px 16px", borderRadius: "var(--radius-lg)", fontSize: "0.95rem", lineHeight: 1.7, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const },
  userBubble: { background: "var(--color-rose-400)", color: "white", borderBottomRightRadius: "var(--radius-sm)" },
  assistantBubble: { background: "var(--color-cream-200)", color: "var(--color-earth-800)", borderBottomLeftRadius: "var(--radius-sm)" },
  cursor: { color: "var(--color-rose-400)", animation: "pulse-soft 1s ease-in-out infinite" },
  typingBubble: { display: "flex", gap: 2, padding: "12px 18px", fontSize: "1.5rem", letterSpacing: 2 },
  dot: { animation: "typing-dot 1.4s ease-in-out infinite", display: "inline-block" },
  inputArea: { padding: "12px 16px 16px", borderTop: "1px solid var(--color-cream-200)", flexShrink: 0 },
  inputWrapper: { display: "flex", alignItems: "flex-end", gap: 8, background: "var(--color-cream-100)", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--color-cream-300)", padding: "8px 12px" },
  input: { flex: 1, border: "none", background: "transparent", fontSize: "0.95rem", fontFamily: "var(--font-body)", color: "var(--color-earth-800)", outline: "none", resize: "none" as const, lineHeight: 1.6, maxHeight: 120 },
  sendBtn: { width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--color-rose-500)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "opacity var(--duration-fast)" },
};
