import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AVATAR_EMOJI_PRESETS, PERSONA_TAG_PRESETS } from "@/lib/constants";
import { detectAndParse, generatePersona, parsePastedText, captureAndOcr } from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { BasicInfo, GenerateProgress, ParsedContent } from "@/types";
import { toast } from "sonner";
import { ArrowLeft, FileUp, ScanText } from "lucide-react";

export function CreateWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onBack = () => navigate({ to: "/" });
  const onComplete = async (personaId: string) => {
    await queryClient.invalidateQueries({ queryKey: ["personas"] });
    navigate({ to: "/chat/$personaId", params: { personaId } });
  };
  const [step, setStep] = useState(1);
  // Step 1
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [emoji, setEmoji] = useState("💜");
  // Step 2
  const [pastedText, setPastedText] = useState("");
  const [parsed, setParsed] = useState<ParsedContent | null>(null);
  const [parsing, setParsing] = useState(false);
  // Step 3
  const [_generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerateProgress | null>(null);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleParse = async () => {
    if (!pastedText.trim()) return;
    setParsing(true);
    try {
      const result = await parsePastedText(pastedText);
      setParsed(result);
      toast.success(`识别到 ${result.message_count} 条消息`);
    } catch (e) {
      toast.error(`解析失败: ${e}`);
    } finally {
      setParsing(false);
    }
  };

  const handleFileImport = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          { name: "聊天记录", extensions: ["txt", "html", "htm", "csv", "json", "db"] },
          { name: "所有文件", extensions: ["*"] },
        ],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      setParsing(true);
      const results = await detectAndParse(paths);
      if (results.length > 0 && results[0].parsed.message_count > 0) {
        setParsed(results[0].parsed);
        toast.success(`从文件识别到 ${results[0].parsed.message_count} 条消息`);
      } else {
        toast.error("未能从文件中识别出聊天记录");
      }
    } catch (e) {
      toast.error(`文件导入失败: ${e}`);
    } finally {
      setParsing(false);
    }
  };

  const handleCapture = async () => {
    try {
      toast.info("请在屏幕上框选聊天记录...", { duration: 3000 });
      const text = await captureAndOcr();
      if (text.trim()) {
        setPastedText(prev => prev ? prev + "\n" + text : text);
        toast.success("已提取屏幕文字，请点击识别");
      }
    } catch (e) {
      toast.error(`OCR提取失败: ${e}`);
    }
  };

  const handleGenerate = async () => {
    if (!name.trim()) {
      toast.error("请输入 TA 的昵称");
      return;
    }
    setGenerating(true);
    setStep(3);
    setProgress(null);

    const unlisten = await listen<GenerateProgress>("generate://progress", (event) => {
      setProgress(event.payload);
    });

    try {
      const basicInfo: BasicInfo = {
        name: name.trim(),
        description: desc.trim(),
        tags,
        avatar_emoji: emoji,
      };
      const contents = parsed ? [parsed] : [];
      const result = await generatePersona(basicInfo, contents);
      toast.success(result.summary);
      // Brief pause so user sees "完成！" before navigation
      await new Promise((r) => setTimeout(r, 800));
      onComplete(result.persona_id);
    } catch (e) {
      console.error("Generate failed:", e);
      toast.error(`生成失败: ${e}`);
      setStep(2);
    } finally {
      setGenerating(false);
      unlisten();
    }
  };

  return (
    <div style={styles.container}>
      {/* Top Bar */}
      <header style={styles.topBar}>
        <button type="button" onClick={step === 1 ? onBack : () => setStep(step - 1)} style={styles.backBtn}>
          <ArrowLeft size={18} />
          <span>{step === 1 ? "返回" : "上一步"}</span>
        </button>
        <div style={styles.steps}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                ...styles.stepDot,
                background: s <= step ? "var(--color-rose-500)" : "var(--color-cream-300)",
              }}
            />
          ))}
        </div>
        <div style={{ width: 80 }} />
      </header>

      <main style={styles.main}>
        {/* Step 1: Info */}
        {step === 1 && (
          <div className="animate-slide-up" style={styles.stepContent}>
            <p style={styles.stepLabel}>第 1 步</p>
            <h2 className="text-heading" style={{ marginBottom: 32 }}>
              告诉我关于 TA
            </h2>

            {/* Emoji picker */}
            <div style={{ marginBottom: 28 }}>
              <label style={styles.fieldLabel}>选一个代表 TA 的表情</label>
              <div style={styles.emojiRow}>
                {AVATAR_EMOJI_PRESETS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    style={{
                      ...styles.emojiBtn,
                      background: emoji === e ? "var(--color-rose-300)" : "var(--color-cream-200)",
                      transform: emoji === e ? "scale(1.15)" : "scale(1)",
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>TA 的昵称</label>
              <input
                type="text"
                placeholder="小美、老王、妈妈..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={styles.input}
                autoFocus
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>用一句话描述 TA</label>
              <input
                type="text"
                placeholder="爱撒娇的女朋友、总是担心我的妈妈..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>TA 的性格标签（可多选）</label>
              <div style={styles.tagGrid}>
                {PERSONA_TAG_PRESETS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      ...styles.tagChip,
                      background: tags.includes(tag) ? "var(--color-rose-500)" : "var(--color-cream-200)",
                      color: tags.includes(tag) ? "white" : "var(--color-earth-600)",
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              style={{
                ...styles.primaryBtn,
                opacity: name.trim() ? 1 : 0.5,
                marginTop: 16,
              }}
            >
              下一步 →
            </button>
          </div>
        )}

        {/* Step 2: Data */}
        {step === 2 && (
          <div className="animate-slide-up" style={styles.stepContent}>
            <p style={styles.stepLabel}>第 2 步</p>
            <h2 className="text-heading" style={{ marginBottom: 8 }}>
              提供聊天记录（可跳过）
            </h2>
            <p className="text-caption" style={{ marginBottom: 32 }}>
              有聊天记录会让 AI 更像 TA。没有的话，仅用描述和标签生成
            </p>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={handleFileImport} disabled={parsing} style={{...styles.fileDropBtn, flex: 1}}>
                <FileUp size={24} style={{ color: "var(--color-rose-400)" }} />
                <span style={{ fontWeight: 500 }}>选择聊天文件</span>
                <span className="text-caption">.txt / .html / .db 等</span>
              </button>

              <button type="button" onClick={handleCapture} disabled={parsing} style={{...styles.fileDropBtn, flex: 1}}>
                <ScanText size={24} style={{ color: "var(--color-sage-500)" }} />
                <span style={{ fontWeight: 500 }}>框选屏幕文字</span>
                <span className="text-caption">使用 macOS 截图 OCR</span>
              </button>
            </div>

            <div style={styles.divider}>
              <span className="text-caption">或者直接粘贴</span>
            </div>

            <div style={styles.fieldGroup}>
              <textarea
                placeholder={"2024-03-15 14:32 小美\n今天好累啊\n\n2024-03-15 14:33 我\n怎么了宝\n..."}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                style={styles.textarea}
                rows={10}
              />
              {pastedText.trim() && !parsed && (
                <button type="button" onClick={handleParse} disabled={parsing} style={styles.secondaryBtn}>
                  {parsing ? "识别中..." : "识别聊天记录"}
                </button>
              )}
              {parsed && (
                <div style={styles.parsedInfo}>
                  ✅ 识别到 {parsed.message_count} 条消息
                  {parsed.target_name && ` · 聊天对象：${parsed.target_name}`}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button type="button" onClick={handleGenerate} style={styles.primaryBtn}>
                {parsed ? "开始生成 →" : "仅用描述生成 →"}
              </button>
              {!parsed && pastedText.trim() === "" && (
                <button type="button" onClick={handleGenerate} style={styles.ghostBtn}>
                  跳过，仅用描述生成
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === 3 && (
          <div className="animate-scale-in" style={styles.generateState}>
            <div style={styles.generateOrb}>
              <span style={{ fontSize: "3rem", animation: "pulse-soft 2s ease-in-out infinite" }}>
                {emoji}
              </span>
            </div>
            <h2 className="text-heading" style={{ marginTop: 24, marginBottom: 8 }}>
              {progress?.label || "准备中..."}
            </h2>
            {progress && (
              <div style={styles.progressTrack}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${(progress.step / progress.total) * 100}%`,
                  }}
                />
              </div>
            )}
            <p className="text-caption" style={{ marginTop: 12 }}>
              正在用 AI 分析 {name} 的性格和你们的回忆
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: "100%", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", flexShrink: 0 },
  backBtn: { display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--color-earth-500)", cursor: "pointer", fontSize: "0.85rem", fontFamily: "var(--font-body)" },
  steps: { display: "flex", gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: "50%", transition: "background var(--duration-normal)" },
  main: { flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "0 24px 48px" },
  stepContent: { maxWidth: 520, width: "100%", paddingTop: 16 },
  stepLabel: { fontSize: "0.75rem", color: "var(--color-rose-500)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.1em", marginBottom: 8 },
  fieldGroup: { marginBottom: 24, display: "flex", flexDirection: "column" as const, gap: 8 },
  fieldLabel: { fontSize: "0.85rem", fontWeight: 500, color: "var(--color-earth-600)" },
  input: { padding: "12px 16px", border: "1.5px solid var(--color-cream-300)", borderRadius: "var(--radius-md)", background: "var(--color-cream-100)", fontSize: "0.95rem", color: "var(--color-earth-800)", fontFamily: "var(--font-body)", outline: "none" },
  textarea: { padding: "14px 16px", border: "1.5px solid var(--color-cream-300)", borderRadius: "var(--radius-md)", background: "var(--color-cream-100)", fontSize: "0.9rem", color: "var(--color-earth-800)", fontFamily: "var(--font-body)", outline: "none", resize: "vertical" as const, lineHeight: 1.7 },
  tagGrid: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
  tagChip: { padding: "6px 14px", borderRadius: "var(--radius-full)", border: "none", fontSize: "0.8rem", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all var(--duration-fast)" },
  emojiRow: { display: "flex", flexWrap: "wrap" as const, gap: 6, marginTop: 8 },
  emojiBtn: { width: 40, height: 40, borderRadius: "var(--radius-md)", border: "none", fontSize: "1.3rem", cursor: "pointer", transition: "all var(--duration-fast) var(--ease-out-quart)", display: "flex", alignItems: "center", justifyContent: "center" },
  primaryBtn: { padding: "12px 28px", background: "var(--color-rose-500)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.95rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-body)", transition: "all var(--duration-fast)" },
  secondaryBtn: { padding: "10px 20px", background: "var(--color-cream-200)", color: "var(--color-earth-700)", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.85rem", cursor: "pointer", fontFamily: "var(--font-body)" },
  ghostBtn: { padding: "12px 20px", background: "none", color: "var(--color-earth-500)", border: "none", fontSize: "0.85rem", cursor: "pointer", fontFamily: "var(--font-body)" },
  parsedInfo: { padding: "10px 14px", background: "oklch(94% 0.04 148 / 0.3)", borderRadius: "var(--radius-md)", fontSize: "0.85rem", color: "var(--color-sage-500)" },
  generateState: { display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", height: "100%", paddingBottom: 64 },
  generateOrb: { width: 100, height: 100, borderRadius: "50%", background: "var(--color-cream-200)", display: "flex", alignItems: "center", justifyContent: "center" },
  progressTrack: { width: 200, height: 4, borderRadius: 2, background: "var(--color-cream-300)", overflow: "hidden" as const, marginTop: 16 },
  progressFill: { height: "100%", background: "var(--color-rose-500)", borderRadius: 2, transition: "width 0.5s var(--ease-out-quart)" },
  fileDropBtn: { width: "100%", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 6, padding: "28px 20px", border: "2px dashed var(--color-cream-300)", borderRadius: "var(--radius-lg)", background: "var(--color-cream-100)", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all var(--duration-normal) var(--ease-out-quart)", marginBottom: 0 },
  divider: { display: "flex", alignItems: "center", gap: 16, margin: "20px 0", width: "100%" },
};
