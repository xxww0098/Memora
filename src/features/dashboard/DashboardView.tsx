import { useEffect } from "react";
import type { PersonaSummary } from "@/types";
import { Settings } from "lucide-react";

interface Props {
  personas: PersonaSummary[];
  onCreateNew: () => void;
  onSelectPersona: (id: string) => void;
  onSettings: () => void;
  onRefresh: () => void;
}

export function DashboardView({ personas, onCreateNew, onSelectPersona, onSettings, onRefresh }: Props) {
  useEffect(() => {
    onRefresh();
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 className="text-heading">Memora</h1>
          <p className="text-caption" style={{ marginTop: 2 }}>
            {personas.length > 0
              ? `${personas.length} 位 AI 伴侣`
              : "开始创建你的第一位 AI 伴侣"}
          </p>
        </div>
        <button type="button" onClick={onSettings} style={styles.settingsBtn} title="设置">
          <Settings size={20} />
        </button>
      </header>

      {/* Content */}
      <main style={styles.main}>
        {personas.length === 0 ? (
          <div className="animate-slide-up" style={styles.emptyState}>
            <div style={styles.emptyEmoji}>🌸</div>
            <h2 className="text-display" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
              还没有 AI 伴侣
            </h2>
            <p className="text-muted" style={{ marginBottom: 32, maxWidth: 300, textAlign: "center", lineHeight: 1.8 }}>
              提供聊天记录，Memora 会分析出 TA 的性格和你们的共同回忆，创建一个真正像 TA 的 AI
            </p>
            <button type="button" onClick={onCreateNew} style={styles.createBtnLarge}>
              创建第一位伴侣
            </button>
          </div>
        ) : (
          <div className="stagger-children" style={styles.grid}>
            {/* Create new card */}
            <button type="button" onClick={onCreateNew} style={styles.newCard}>
              <span style={{ fontSize: "2rem" }}>✦</span>
              <span style={{ fontWeight: 500 }}>创建新伴侣</span>
            </button>

            {/* Persona cards */}
            {personas.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPersona(p.id)}
                style={styles.personaCard}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                }}
              >
                <div style={styles.avatar}>{p.avatar_emoji}</div>
                <div style={styles.cardContent}>
                  <span style={{ fontWeight: 500, fontSize: "1.05rem" }}>{p.name}</span>
                  <span className="text-caption" style={{ marginTop: 4 }}>
                    {p.description || p.tags.slice(0, 3).join(" · ") || "暂无描述"}
                  </span>
                  {p.last_chat_at && (
                    <span className="text-caption" style={{ marginTop: 8, fontSize: "0.75rem" }}>
                      上次聊天 · {formatRelativeTime(p.last_chat_at)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return `${Math.floor(days / 30)} 个月前`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px 32px 16px",
    flexShrink: 0,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: "var(--radius-md)",
    border: "none",
    background: "var(--color-cream-200)",
    color: "var(--color-earth-500)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all var(--duration-fast)",
  },
  main: {
    flex: 1,
    overflow: "auto",
    padding: "8px 32px 32px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    paddingBottom: 64,
  },
  emptyEmoji: {
    fontSize: "3.5rem",
    marginBottom: 16,
  },
  createBtnLarge: {
    padding: "14px 36px",
    background: "var(--color-rose-500)",
    color: "white",
    border: "none",
    borderRadius: "var(--radius-lg)",
    fontSize: "1rem",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    transition: "all var(--duration-fast)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 16,
  },
  newCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
    border: "2px dashed var(--color-cream-300)",
    borderRadius: "var(--radius-lg)",
    background: "transparent",
    color: "var(--color-earth-500)",
    cursor: "pointer",
    transition: "all var(--duration-normal) var(--ease-out-quart)",
    fontFamily: "var(--font-body)",
    minHeight: 180,
  },
  personaCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "28px 20px 24px",
    border: "none",
    borderRadius: "var(--radius-lg)",
    background: "var(--color-cream-100)",
    cursor: "pointer",
    transition: "all var(--duration-normal) var(--ease-out-quart)",
    fontFamily: "var(--font-body)",
    textAlign: "center",
    boxShadow: "var(--shadow-sm)",
    minHeight: 180,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: "var(--color-cream-200)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.8rem",
  },
  cardContent: {
    display: "flex",
    flexDirection: "column",
  },
};
