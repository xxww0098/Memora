import { useState } from "react";
import { PROVIDER_OPTIONS } from "@/lib/constants";
import { saveSettings, validateApiKey, getSettings } from "@/lib/tauri";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

interface Props {
  onBack: () => void;
  onApiKeyChanged: () => void;
}

export function SettingsView({ onBack, onApiKeyChanged }: Props) {
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        setProvider(s.provider);
        setBaseUrl(s.base_url);
        setModel(s.model);
      } catch {
        // use defaults
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (apiKey.trim()) {
        const valid = await validateApiKey(provider, apiKey, baseUrl, model);
        if (!valid) {
          toast.error("密钥验证失败");
          setSaving(false);
          return;
        }
      }
      await saveSettings(provider, apiKey, baseUrl, model);
      toast.success("已保存");
      onApiKeyChanged();
    } catch (e) {
      toast.error(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (id: string) => {
    setProvider(id);
    const p = PROVIDER_OPTIONS.find((o) => o.id === id);
    if (p) {
      setBaseUrl(p.defaultUrl);
      setModel(p.defaultModel);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button type="button" onClick={onBack} style={styles.backBtn}>
          <ArrowLeft size={18} />
          <span>返回</span>
        </button>
      </header>

      <main style={styles.main}>
        <h2 className="text-heading" style={{ marginBottom: 32 }}>设置</h2>

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
                  }}
                >
                  {p.name}
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

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>关于</h3>
          <p className="text-caption" style={{ lineHeight: 1.8 }}>
            Memora v0.1.0<br />
            所有数据仅保存在本地，只有 AI 推理请求会走 API。<br />
            基于 ex-skill（MIT）开源项目。
          </p>
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { width: "100%", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { padding: "16px 24px", flexShrink: 0 },
  backBtn: { display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--color-earth-500)", cursor: "pointer", fontSize: "0.85rem", fontFamily: "var(--font-body)" },
  main: { flex: 1, overflow: "auto", padding: "0 32px 48px", maxWidth: 560 },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: "0.95rem", fontWeight: 600, color: "var(--color-earth-700)", marginBottom: 20, paddingBottom: 8, borderBottom: "1px solid var(--color-cream-200)" },
  fieldGroup: { marginBottom: 20, display: "flex", flexDirection: "column" as const, gap: 8 },
  fieldLabel: { fontSize: "0.85rem", fontWeight: 500, color: "var(--color-earth-600)" },
  input: { padding: "12px 16px", border: "1.5px solid var(--color-cream-300)", borderRadius: "var(--radius-md)", background: "var(--color-cream-100)", fontSize: "0.95rem", color: "var(--color-earth-800)", fontFamily: "var(--font-body)", outline: "none" },
  chipBtn: { padding: "8px 16px", borderRadius: "var(--radius-full)", border: "none", fontSize: "0.8rem", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all var(--duration-fast)" },
  primaryBtn: { padding: "12px 28px", background: "var(--color-rose-500)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "0.95rem", fontWeight: 500, cursor: "pointer", fontFamily: "var(--font-body)" },
};
