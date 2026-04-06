interface Props {
  onContinue: () => void;
  onSetupKey: () => void;
}

export function WelcomeView(_props: Props) {
  // This view is shown only briefly before ApiKeySetup takes over.
  // It serves as a warm first impression.
  return (
    <div className="animate-fade-in" style={styles.container}>
      <div style={styles.content}>
        <div style={styles.emojiOrb}>💜</div>
        <h1 className="text-hero" style={{ textAlign: "center", marginBottom: 12 }}>
          Memora
        </h1>
        <p
          className="text-display"
          style={{
            textAlign: "center",
            fontSize: "1.15rem",
            color: "var(--color-earth-500)",
            maxWidth: 360,
            lineHeight: 1.8,
          }}
        >
          把聊天记录变成永远陪伴你的 AI 伴侣
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--color-cream-50)",
    zIndex: 40,
    pointerEvents: "none",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  emojiOrb: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "var(--color-cream-200)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "2.5rem",
    marginBottom: 8,
  },
};
