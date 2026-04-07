import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getPersona, getChatHistory, listChatSessions, newChatSession, sendMessage, speakText, toggleClipboardWatcher, appendClipboardCorpus } from "@/lib/tauri";
import type { ChatMessage, Persona } from "@/types";
import { ArrowLeft, Send, Menu, Edit3, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SessionSidebar } from "./SessionSidebar";
import { CorrectionDialog } from "./CorrectionDialog";
import { MarkdownBubble } from "./MarkdownBubble";

// ── WeChat-style timestamp formatting ──
const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const TIME_GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function formatChatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekAgoStart = new Date(todayStart.getTime() - 6 * 86400000);

  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const time = `${hh}:${mm}`;

  if (date >= todayStart) {
    return time;
  }
  if (date >= yesterdayStart) {
    return `昨天 ${time}`;
  }
  if (date >= weekAgoStart) {
    return `${WEEKDAYS[date.getDay()]} ${time}`;
  }
  const y = date.getFullYear();
  const M = date.getMonth() + 1;
  const d = date.getDate();
  if (y === now.getFullYear()) {
    return `${M}月${d}日 ${time}`;
  }
  return `${y}年${M}月${d}日 ${time}`;
}

function shouldShowTimestamp(current: ChatMessage, prev: ChatMessage | null): boolean {
  if (!prev) return true;
  const cur = new Date(current.created_at).getTime();
  const pre = new Date(prev.created_at).getTime();
  return cur - pre >= TIME_GAP_THRESHOLD_MS;
}

export function ChatView() {
  const { personaId } = useParams({ strict: false }) as { personaId: string };
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/" });
  const onProfile = () => navigate({ to: "/profile/$personaId", params: { personaId } });
  const [persona, setPersona] = useState<Persona | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<number | null>(null);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInitialLoad = useRef(true);

  // ── TTS speak handler ──
  const handleSpeak = useCallback(async (msg: ChatMessage) => {
    // If already playing this message, stop it
    if (speakingMsgId === msg.id && playingAudio) {
      playingAudio.pause();
      playingAudio.currentTime = 0;
      setPlayingAudio(null);
      setSpeakingMsgId(null);
      return;
    }
    // Stop any currently playing audio
    if (playingAudio) {
      playingAudio.pause();
      playingAudio.currentTime = 0;
    }
    setSpeakingMsgId(msg.id);
    try {
      const audioPath = await speakText(msg.content, personaId);
      const audioUrl = convertFileSrc(audioPath);
      const audio = new Audio(audioUrl);
      audio.onended = () => { setSpeakingMsgId(null); setPlayingAudio(null); };
      audio.onerror = () => { setSpeakingMsgId(null); setPlayingAudio(null); toast.error("播放失败"); };
      setPlayingAudio(audio);
      await audio.play();
    } catch (e) {
      toast.error(`语音合成失败: ${e}`);
      setSpeakingMsgId(null);
      setPlayingAudio(null);
    }
  }, [personaId, speakingMsgId, playingAudio]);

  // Load persona and determine session
  useEffect(() => {
    const isWatcherEnabled = localStorage.getItem("memora_clipboard_watcher") === "true";
    if (isWatcherEnabled) toggleClipboardWatcher(true).catch(console.error);
    const unlisten = listen<{ text: string }>("clipboard://chat-detected", (e) => {
      toast("检测到剪贴板具有潜在聊天记录", {
        description: "是否将其作为语料追加到当前人物的回忆中？",
        action: {
          label: "追加",
          onClick: async () => {
            try {
              await appendClipboardCorpus(personaId, e.payload.text);
              toast.success("已追加到共同记忆");
            } catch (err) {
              toast.error(`追加失败: ${err}`);
            }
          }
        },
        duration: 8000,
      });
    });

    return () => {
      if (isWatcherEnabled) toggleClipboardWatcher(false).catch(console.error);
      unlisten.then((fn) => fn());
    };
  }, [personaId]);

  useEffect(() => {
    (async () => {
      try {
        const p = await getPersona(personaId);
        setPersona(p);

        // Check for existing sessions, resume the most recent or create new
        const sessions = await listChatSessions(personaId);
        if (sessions.length > 0) {
          const latestSid = sessions[0].session_id;
          setSessionId(latestSid);
        } else {
          const sid = await newChatSession(personaId);
          setSessionId(sid);
        }
      } catch (e) {
        toast.error(`加载失败: ${e}`);
      }
    })();
  }, [personaId]);

  // Load chat history when session changes
  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const history = await getChatHistory(personaId, sessionId, 100);
        isInitialLoad.current = true;
        setMessages(history);
      } catch {
        setMessages([]);
      }
    })();
  }, [personaId, sessionId]);

  // Scroll to bottom
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView();
      // Need a small timeout to ensure rendering is complete before disabling initial load
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 50);
    } else if (!isInitialLoad.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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

  const handleSessionSwitch = async (newSessionId: string) => {
    setShowSidebar(false);
    setSessionId(newSessionId);
    setMessages([]);
    setStreamText("");
  };

  if (!persona) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100vh" }}>
        <span className="text-muted" style={{ animation: "pulse-soft 2s ease-in-out infinite" }}>加载中...</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Session Sidebar */}
      {showSidebar && (
        <SessionSidebar
          personaId={personaId}
          activeSessionId={sessionId}
          onSelectSession={handleSessionSwitch}
          onClose={() => setShowSidebar(false)}
        />
      )}

      {/* Correction Dialog */}
      {correctionTarget && (
        <CorrectionDialog
          personaId={personaId}
          originalContent={correctionTarget}
          onClose={() => setCorrectionTarget(null)}
          onCorrected={async () => {
            // Reload persona after correction  
            const p = await getPersona(personaId);
            setPersona(p);
          }}
        />
      )}

      {/* Chat header */}
      <header style={styles.header}>
        <button type="button" onClick={onBack} style={styles.headerBtn} title="返回">
          <ArrowLeft size={18} />
        </button>
        <div
          style={{ ...styles.headerInfo, cursor: "pointer" }}
          onClick={onProfile}
        >
          <span style={{ fontSize: "1.4rem" }}>{persona.avatar_emoji}</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 500, fontSize: "1.05rem", lineHeight: 1.2 }}>{persona.name}</span>
            <span style={{ fontSize: "0.7rem", color: "var(--color-earth-400)", lineHeight: 1.2 }}>
              v{persona.version}
            </span>
          </div>
        </div>
        <button type="button" onClick={() => setShowSidebar(true)} style={styles.headerBtn} title="会话列表">
          <Menu size={18} />
        </button>
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

        {messages.map((msg, idx) => (
          <div key={msg.id}>
            {/* WeChat-style timestamp chip */}
            {shouldShowTimestamp(msg, idx > 0 ? messages[idx - 1] : null) && (
              <div style={styles.timestampRow}>
                <span style={styles.timestampChip}>
                  {formatChatTimestamp(msg.created_at)}
                </span>
              </div>
            )}
            <div
              style={{
                ...styles.bubbleRow,
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                className="group"
                style={{
                  ...styles.bubble,
                  ...(msg.role === "user" ? styles.userBubble : styles.assistantBubble),
                  position: "relative",
                }}
              >
                <MarkdownBubble content={msg.content} isUser={msg.role === "user"} />
                {/* Action buttons for assistant messages */}
                {msg.role === "assistant" && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={styles.bubbleActions}>
                    <button
                      type="button"
                      onClick={() => handleSpeak(msg)}
                      style={styles.speakBtn}
                      title="朗读这条消息"
                    >
                      {speakingMsgId === msg.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Volume2 size={11} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCorrectionTarget(msg.content)}
                      style={styles.correctBtn}
                      title="纠正这条回复"
                    >
                      <Edit3 size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {streaming && streamText && (
          <div style={{ ...styles.bubbleRow, justifyContent: "flex-start" }}>
            <div style={{ ...styles.bubble, ...styles.assistantBubble }}>
              <MarkdownBubble content={streamText} />
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
  headerBtn: { width: 36, height: 36, borderRadius: "var(--radius-md)", border: "none", background: "none", color: "var(--color-earth-500)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background var(--duration-fast)" },
  headerInfo: { display: "flex", alignItems: "center", gap: 10 },
  messagesArea: { flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8, background: "var(--chat-bg)" },
  emptyChat: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, opacity: 0.7 },
  timestampRow: { display: "flex", justifyContent: "center", padding: "12px 0 6px", animation: "fade-in 400ms ease both" },
  timestampChip: {
    fontSize: "0.72rem",
    color: "var(--chat-timestamp-text)",
    background: "var(--chat-timestamp-bg)",
    padding: "3px 12px",
    borderRadius: "var(--radius-full)",
    letterSpacing: "0.02em",
    fontVariantNumeric: "tabular-nums",
    userSelect: "none" as const,
    lineHeight: 1.6,
  },
  bubbleRow: { display: "flex", width: "100%", animation: "slide-up 300ms var(--ease-out-expo) both" },
  bubble: { maxWidth: "78%", padding: "10px 16px", borderRadius: "var(--radius-lg)", fontSize: "0.95rem", lineHeight: 1.7 },
  userBubble: { background: "var(--chat-bubble-user)", color: "var(--chat-bubble-user-text)", borderBottomRightRadius: "var(--radius-sm)" },
  assistantBubble: { background: "var(--chat-bubble-other)", color: "var(--chat-bubble-other-text)", borderBottomLeftRadius: "var(--radius-sm)" },
  cursor: { color: "var(--color-rose-400)", animation: "pulse-soft 1s ease-in-out infinite" },
  typingBubble: { display: "flex", gap: 2, padding: "12px 18px", fontSize: "1.5rem", letterSpacing: 2 },
  dot: { animation: "typing-dot 1.4s ease-in-out infinite", display: "inline-block" },
  bubbleActions: {
    position: "absolute" as const,
    bottom: -6,
    right: -6,
    display: "flex",
    gap: 4,
  },
  speakBtn: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1.5px solid var(--color-lavender-300)",
    background: "var(--color-cream-50)",
    color: "var(--color-lavender-500)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  correctBtn: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1.5px solid var(--color-cream-300)",
    background: "var(--color-cream-50)",
    color: "var(--color-earth-400)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  inputArea: { padding: "12px 16px 16px", borderTop: "1px solid var(--color-cream-200)", flexShrink: 0, background: "var(--chat-bg)" },
  inputWrapper: { display: "flex", alignItems: "flex-end", gap: 8, background: "var(--chat-input-bg)", borderRadius: "var(--radius-lg)", border: "1.5px solid var(--chat-input-border)", padding: "8px 12px" },
  input: { flex: 1, border: "none", background: "transparent", fontSize: "0.95rem", fontFamily: "var(--font-body)", color: "var(--color-earth-800)", outline: "none", resize: "none" as const, lineHeight: 1.6, maxHeight: 120 },
  sendBtn: { width: 36, height: 36, borderRadius: "50%", border: "none", background: "var(--color-rose-500)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "opacity var(--duration-fast)" },
};
