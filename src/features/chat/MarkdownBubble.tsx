import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  isUser?: boolean;
}

export function MarkdownBubble({ content, isUser }: Props) {
  // For user messages, just render as plain text with whitespace
  if (isUser) {
    return <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{content}</span>;
  }

  return (
    <div className="md-bubble" style={styles.root}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => <h3 style={styles.heading}>{children}</h3>,
          h2: ({ children }) => <h4 style={styles.heading}>{children}</h4>,
          h3: ({ children }) => <h5 style={styles.heading}>{children}</h5>,
          // Paragraphs
          p: ({ children }) => <p style={styles.paragraph}>{children}</p>,
          // Bold & Italic
          strong: ({ children }) => (
            <strong style={{ fontWeight: 600, color: "var(--color-earth-900)" }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ fontStyle: "italic", color: "var(--color-earth-700)" }}>{children}</em>
          ),
          // Code
          code: ({ children, className }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <code style={styles.codeBlock}>
                  {children}
                </code>
              );
            }
            return <code style={styles.inlineCode}>{children}</code>;
          },
          pre: ({ children }) => <pre style={styles.preBlock}>{children}</pre>,
          // Lists
          ul: ({ children }) => <ul style={styles.list}>{children}</ul>,
          ol: ({ children }) => <ol style={{ ...styles.list, listStyleType: "decimal" }}>{children}</ol>,
          li: ({ children }) => <li style={styles.listItem}>{children}</li>,
          // Links
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={styles.link}>
              {children}
            </a>
          ),
          // Blockquote
          blockquote: ({ children }) => <blockquote style={styles.blockquote}>{children}</blockquote>,
          // HR
          hr: () => <hr style={styles.hr} />,
          // Table
          table: ({ children }) => (
            <div style={{ overflowX: "auto", margin: "6px 0" }}>
              <table style={styles.table}>{children}</table>
            </div>
          ),
          th: ({ children }) => <th style={styles.th}>{children}</th>,
          td: ({ children }) => <td style={styles.td}>{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    fontSize: "0.92rem",
    lineHeight: 1.75,
    wordBreak: "break-word",
  },
  heading: {
    fontSize: "0.95rem",
    fontWeight: 600,
    marginTop: 8,
    marginBottom: 4,
    color: "var(--color-earth-800)",
  },
  paragraph: {
    margin: "4px 0",
  },
  inlineCode: {
    padding: "1px 6px",
    borderRadius: 4,
    background: "var(--color-cream-300)",
    fontSize: "0.84rem",
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    color: "var(--color-rose-600)",
  },
  preBlock: {
    margin: "8px 0",
    padding: 0,
    overflow: "auto",
    borderRadius: "var(--radius-md)",
  },
  codeBlock: {
    display: "block",
    padding: "10px 14px",
    borderRadius: "var(--radius-md)",
    background: "oklch(18% 0.015 42)",
    color: "oklch(90% 0.01 72)",
    fontSize: "0.82rem",
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    overflowX: "auto",
  },
  list: {
    paddingLeft: 20,
    margin: "4px 0",
    listStyleType: "disc",
  },
  listItem: {
    margin: "2px 0",
    paddingLeft: 2,
  },
  link: {
    color: "var(--color-rose-500)",
    textDecoration: "underline",
    textUnderlineOffset: 2,
  },
  blockquote: {
    margin: "6px 0",
    paddingLeft: 14,
    borderLeft: "3px solid var(--color-cream-300)",
    color: "var(--color-earth-600)",
    fontStyle: "italic",
  },
  hr: {
    border: "none",
    borderTop: "1px solid var(--color-cream-300)",
    margin: "8px 0",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.84rem",
  },
  th: {
    padding: "6px 10px",
    borderBottom: "2px solid var(--color-cream-300)",
    textAlign: "left",
    fontWeight: 600,
    fontSize: "0.82rem",
  },
  td: {
    padding: "5px 10px",
    borderBottom: "1px solid var(--color-cream-200)",
  },
};
