import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useNavigate } from "@tanstack/react-router";
import { PROVIDER_OPTIONS } from "@/lib/constants";
import { saveSettings, validateApiKey, getSettings, getTtsSettings, saveTtsSettings, listTtsProviders, clearAudioCache, checkAppUpdate, downloadAndInstallUpdate, restartAfterUpdate } from "@/lib/tauri";
import type { TtsProviderInfo, UpdateCheckResult } from "@/types";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { ThemeMode } from "@/hooks/useTheme";

const DUMMY_KEY = "•".repeat(64);

export function SettingsView() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/" });
  const { mode, setMode } = useTheme();
  const [provider, setProvider] = useState("");
  const [activeProvider, setActiveProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  // TTS state
  const [ttsProviders, setTtsProviders] = useState<TtsProviderInfo[]>([]);
  const [ttsProvider, setTtsProvider] = useState("");
  const [ttsApiKey, setTtsApiKey] = useState("");
  const [ttsGroupId, setTtsGroupId] = useState("");
  const [ttsLanguage, setTtsLanguage] = useState("zh-CN");
  const [ttsCacheLimit, setTtsCacheLimit] = useState(500);
  const [ttsCacheStats, setTtsCacheStats] = useState({ file_count: 0, total_size_mb: 0 });
  const [hasTtsKey, setHasTtsKey] = useState(false);
  const [savingTts, setSavingTts] = useState(false);

  // General settings
  const [clipboardWatcherEnabled, setClipboardWatcherEnabled] = useState(
    localStorage.getItem("memora_clipboard_watcher") === "true"
  );
  const [appVersion, setAppVersion] = useState("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ total: number; downloaded: number } | null>(null);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("unknown"));
    (async () => {
      try {
        const s = await getSettings();
        setProvider(s.provider);
        setActiveProvider(s.provider);
        setBaseUrl(s.base_url);
        setModel(s.model);
        if (s.has_api_key) {
          setApiKey(DUMMY_KEY);
        }
      } catch {
        // use defaults
      }
    })();

    // Load TTS settings
    (async () => {
      try {
        const providers = await listTtsProviders();
        setTtsProviders(providers);

        const tts = await getTtsSettings();
        setTtsProvider(tts.active_provider || providers[0]?.id || "minimax");
        setTtsLanguage(tts.default_language || "zh-CN");
        setTtsCacheLimit(tts.cache_limit_mb);
        setTtsCacheStats(tts.cache_stats);
        setHasTtsKey(tts.has_api_key);
        if (tts.has_api_key) {
          setTtsApiKey(DUMMY_KEY);
        }
        setTtsGroupId(tts.group_id || "");
      } catch { /* ignore */ }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const finalKey = apiKey === DUMMY_KEY ? "" : apiKey;
      if (finalKey.trim()) {
        try {
          const valid = await validateApiKey(provider, finalKey, baseUrl, model);
          if (!valid) {
            toast.error("密钥验证失败");
            setSaving(false);
            return;
          }
        } catch (validationErr) {
          toast.error(`密钥验证失败: ${validationErr}`);
          setSaving(false);
          return;
        }
      }
      await saveSettings(provider, finalKey, baseUrl, model);
      setActiveProvider(provider);
      toast.success("已保存配置", { description: `已成功切换为并启用模型: ${model}` });
    } catch (e) {
      toast.error(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = async (id: string) => {
    setProvider(id);
    try {
      const s = await getSettings(id);
      if (s.base_url) {
        setBaseUrl(s.base_url);
        setModel(s.model);
        setApiKey(s.has_api_key ? DUMMY_KEY : ""); // clear or set to dummy so we don't accidentally overwrite with stale input
      } else {
        const p = PROVIDER_OPTIONS.find((o) => o.id === id);
        if (p) {
          setBaseUrl(p.defaultUrl);
          setModel(p.defaultModel);
          setApiKey("");
        }
      }
    } catch {
      const p = PROVIDER_OPTIONS.find((o) => o.id === id);
      if (p) {
        setBaseUrl(p.defaultUrl);
        setModel(p.defaultModel);
      }
    }
  };

  const handleSaveTts = async () => {
    setSavingTts(true);
    try {
      const finalTtsKey = ttsApiKey === DUMMY_KEY ? "" : ttsApiKey;
      await saveTtsSettings(ttsProvider, finalTtsKey, ttsGroupId, ttsLanguage, ttsCacheLimit);
      setHasTtsKey(finalTtsKey.trim() !== "" || hasTtsKey);
      if (finalTtsKey.trim() !== "") {
        setTtsApiKey(DUMMY_KEY);
      }
      toast.success("语音设置已保存");
      // Refresh cache stats
      const tts = await getTtsSettings();
      setTtsCacheStats(tts.cache_stats);
    } catch (e) {
      toast.error(`保存失败: ${e}`);
    } finally {
      setSavingTts(false);
    }
  };

  const handleClearCache = async () => {
    try {
      await clearAudioCache();
      const tts = await getTtsSettings();
      setTtsCacheStats(tts.cache_stats);
      toast.success("缓存已清空");
    } catch (e) {
      toast.error(`清空缓存失败: ${e}`);
    }
  };

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateResult(null);
    try {
      const result = await checkAppUpdate();
      setUpdateResult(result);
      if (!result.available) {
        toast.success("当前已是最新版本");
      }
    } catch (e) {
      toast.error(`检查更新失败: ${e}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleDownloadUpdate = async () => {
    setIsDownloadingUpdate(true);
    setDownloadProgress({ total: 0, downloaded: 0 });
    
    let unlisten: () => void = () => {};
    try {
      unlisten = await listen("updater://download-progress", (event: any) => {
        const { chunk_length, content_length } = event.payload;
        setDownloadProgress(prev => ({
          total: content_length || prev?.total || 0,
          downloaded: (prev?.downloaded || 0) + chunk_length
        }));
      });

      await downloadAndInstallUpdate();
      toast.success("更新就绪", { description: "即将重启应用程序..." });
      setTimeout(async () => {
        await restartAfterUpdate();
      }, 1500);
    } catch (e) {
      toast.error(`下载更新失败: ${e}`);
      setIsDownloadingUpdate(false);
    } finally {
      unlisten();
    }
  };

  const currentTtsProvider = ttsProviders.find(p => p.id === ttsProvider);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button type="button" onClick={onBack} style={styles.backBtn}>
          <ArrowLeft size={18} />
          <span>返回</span>
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.content}>
          <h2 className="text-heading" style={{ marginBottom: 32 }}>设置</h2>

          {/* ── Theme Toggle ── */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>外观</h3>
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>主题模式</label>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { id: "system" as ThemeMode, label: "跟随系统", icon: <Monitor size={14} /> },
                  { id: "light" as ThemeMode, label: "浅色", icon: <Sun size={14} /> },
                  { id: "dark" as ThemeMode, label: "深色", icon: <Moon size={14} /> },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    style={{
                      ...styles.chipBtn,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: mode === opt.id ? "var(--color-rose-500)" : "var(--color-cream-200)",
                      color: mode === opt.id ? "white" : "var(--color-earth-600)",
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>AI 服务</h3>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>服务商</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PROVIDER_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderChange(p.id)}
                    style={{
                      ...styles.chipBtn,
                      background: provider === p.id ? "var(--color-rose-500)" : "var(--color-cream-200)",
                      color: provider === p.id ? "white" : "var(--color-earth-600)",
                      outline: activeProvider === p.id ? "2px solid var(--color-rose-300)" : "none",
                      outlineOffset: "2px",
                    }}
                  >
                    {p.name} {activeProvider === p.id && " (生效中)"}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>API 密钥</label>
              <input
                type="password"
                placeholder="输入新密钥以更新（留空则不修改）"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>API 地址</label>
              <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={styles.input} />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>模型</label>
              <input type="text" value={model} onChange={(e) => setModel(e.target.value)} style={styles.input} />
            </div>

            <button type="button" onClick={handleSave} disabled={saving} style={styles.primaryBtn}>
              {saving ? "保存中..." : "保存设置"}
            </button>
          </section>

          {/* ── 实验室/通用功能 ── */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>🧪 通用功能</h3>

            <div style={{ ...styles.fieldGroup, flexDirection: "row" as const, alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 600, color: "var(--color-earth-800)" }}>后台智能剪贴板语料捕捉</span>
                <span style={{ fontSize: "0.8rem", color: "var(--color-earth-500)" }}>开启后，在人物聊天或详情页时，后台将自动检测并提示追加剪贴板内的聊天记录</span>
              </div>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer", position: "relative" }}>
                <input 
                  type="checkbox" 
                  checked={clipboardWatcherEnabled} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setClipboardWatcherEnabled(checked);
                    localStorage.setItem("memora_clipboard_watcher", checked ? "true" : "false");
                    toast.success(checked ? "已开启后台剪贴板捕捉" : "已关闭后台剪贴板捕捉");
                  }}
                  style={{ opacity: 0, position: "absolute" }}
                />
                <div style={{
                  width: 44, height: 24, borderRadius: 12, transition: "background-color 0.2s",
                  background: clipboardWatcherEnabled ? "var(--color-rose-500)" : "var(--color-cream-300)",
                  position: "relative"
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10, background: "white",
                    position: "absolute", top: 2, left: clipboardWatcherEnabled ? 22 : 2, transition: "left 0.2s",
                    boxShadow: "var(--shadow-sm)"
                  }} />
                </div>
              </label>
            </div>
          </section>

          {/* ── TTS Voice Settings ── */}
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>🎙 语音服务</h3>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>服务商</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ttsProviders.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setTtsProvider(p.id)}
                    style={{
                      ...styles.chipBtn,
                      background: ttsProvider === p.id ? "var(--color-lavender-500)" : "var(--color-cream-200)",
                      color: ttsProvider === p.id ? "white" : "var(--color-earth-600)",
                    }}
                  >
                    {p.name}
                    {p.supports_clone && " 🎤"}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>API 密钥 {hasTtsKey && <span style={{ color: "var(--color-sage-500)", fontSize: "0.75rem" }}>✓ 已设置</span>}</label>
              <input
                type="password"
                placeholder="输入密钥以更新（留空则不修改）"
                value={ttsApiKey}
                onChange={(e) => setTtsApiKey(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Group ID {ttsGroupId && <span style={{ color: "var(--color-sage-500)", fontSize: "0.75rem" }}>✓ 已设置</span>}</label>
              <input
                type="text"
                placeholder="输入 MiniMax Group ID"
                value={ttsGroupId}
                onChange={(e) => setTtsGroupId(e.target.value)}
                style={styles.input}
              />
              <span className="text-caption" style={{ color: "var(--color-earth-400)", fontSize: "0.75rem", marginTop: "-4px" }}>
                *请前往 MiniMax 开放平台的「账户管理」-「基本信息」页面复制
              </span>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>默认语言</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(currentTtsProvider?.languages ?? []).map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setTtsLanguage(lang.code)}
                    style={{
                      ...styles.chipBtn,
                      fontSize: "0.75rem",
                      padding: "6px 12px",
                      background: ttsLanguage === lang.code ? "var(--color-sage-400)" : "var(--color-cream-200)",
                      color: ttsLanguage === lang.code ? "white" : "var(--color-earth-600)",
                    }}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>
                缓存上限 <span style={{ fontWeight: 400, color: "var(--color-earth-400)" }}>{ttsCacheLimit} MB</span>
              </label>
              <input
                type="range"
                min={100}
                max={2000}
                step={100}
                value={ttsCacheLimit}
                onChange={(e) => setTtsCacheLimit(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--color-lavender-500)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <span className="text-caption">
                  已缓存: {ttsCacheStats.file_count} 个文件 · {ttsCacheStats.total_size_mb.toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={handleClearCache}
                  style={{ ...styles.chipBtn, fontSize: "0.72rem", padding: "4px 10px", color: "var(--color-coral-500)", background: "var(--color-cream-200)" }}
                >
                  <Trash2 size={11} style={{ marginRight: 3 }} />
                  清空
                </button>
              </div>
            </div>

            <button type="button" onClick={handleSaveTts} disabled={savingTts} style={{ ...styles.primaryBtn, background: "var(--color-lavender-500)" }}>
              {savingTts ? "保存中..." : "保存语音设置"}
            </button>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>关于</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p className="text-caption" style={{ lineHeight: 1.8, margin: 0 }}>
                Memora v{appVersion}<br />
                所有数据仅保存在本地，只有 AI 推理请求会走 API。<br />
                基于 ex-skill（MIT）开源项目。
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button 
                  type="button" 
                  onClick={handleCheckUpdate} 
                  disabled={isCheckingUpdate || isDownloadingUpdate}
                  style={{ ...styles.chipBtn, background: "var(--color-cream-200)", color: "var(--color-earth-700)" }}
                >
                  {isCheckingUpdate ? "检查中..." : "检查更新"}
                </button>
                
                {updateResult?.available && !isDownloadingUpdate && (
                  <button 
                    type="button" 
                    onClick={handleDownloadUpdate}
                    style={{ ...styles.chipBtn, background: "var(--color-sage-500)", color: "white" }}
                  >
                    发现新版本 v{updateResult.version} - 立即更新
                  </button>
                )}
                
                {isDownloadingUpdate && downloadProgress && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 100, height: 4, background: "var(--color-cream-200)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ 
                        height: "100%", 
                        background: "var(--color-sage-500)", 
                        width: downloadProgress.total > 0 ? `${(downloadProgress.downloaded / downloadProgress.total) * 100}%` : "0%"
                      }} />
                    </div>
                    <span className="text-caption" style={{ color: "var(--color-sage-500)", margin: 0 }}>
                      {downloadProgress.total > 0 
                        ? `${Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)}%`
                        : `${(downloadProgress.downloaded / 1024 / 1024).toFixed(1)} MB`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: "100%", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { padding: "16px 24px", flexShrink: 0 },
  backBtn: { display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--color-earth-500)", cursor: "pointer", fontSize: "0.85rem", fontFamily: "var(--font-body)" },
  main: { flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "0 32px 48px" },
  content: { maxWidth: 560, width: "100%" },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: "0.95rem", fontWeight: 600, color: "var(--color-earth-700)", marginBottom: 20, paddingBottom: 8, borderBottom: "1px solid var(--color-cream-200)" },
  fieldGroup: { marginBottom: 20, display: "flex", flexDirection: "column" as const, gap: 8 },
  fieldLabel: { fontSize: "0.85rem", fontWeight: 500, color: "var(--color-earth-600)" },
  input: { padding: "12px 16px", border: "1.5px solid var(--color-cream-300)", borderRadius: "var(--radius-md)", background: "var(--color-cream-100)", fontSize: "0.95rem", color: "var(--color-earth-800)", fontFamily: "var(--font-body)", outline: "none" },
  chipBtn: { padding: "8px 16px", borderRadius: "var(--radius-full)", border: "none", fontSize: "0.8rem", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all var(--duration-fast)" },
  primaryBtn: { padding: "12px 28px", background: "var(--color-rose-500)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.95rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-body)" },
};
