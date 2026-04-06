import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import type { AppView, PersonaSummary } from "@/types";
import { getSettings, listPersonas } from "@/lib/tauri";
import { WelcomeView } from "@/features/onboarding/WelcomeView";
import { ApiKeySetup } from "@/features/onboarding/ApiKeySetup";
import { DashboardView } from "@/features/dashboard/DashboardView";
import { CreateWizard } from "@/features/create/CreateWizard";
import { ChatView } from "@/features/chat/ChatView";
import { SettingsView } from "@/features/settings/SettingsView";

export default function App() {
  const [view, setView] = useState<AppView>("welcome");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial load: check settings and personas
  useEffect(() => {
    (async () => {
      try {
        const settings = await getSettings();
        setHasApiKey(settings.has_api_key);

        if (settings.has_api_key) {
          const list = await listPersonas();
          setPersonas(list);
          setView(list.length > 0 ? "dashboard" : "dashboard");
        } else {
          setView("welcome");
        }
      } catch {
        setView("welcome");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshPersonas = async () => {
    try {
      const list = await listPersonas();
      setPersonas(list);
    } catch {
      // ignore
    }
  };

  const navigateTo = (v: AppView, personaId?: string) => {
    setView(v);
    if (personaId) setActivePersonaId(personaId);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100vh",
          fontFamily: "var(--font-display)",
          fontSize: "1.5rem",
          color: "var(--color-earth-500)",
        }}
      >
        <span style={{ animation: "pulse-soft 2s ease-in-out infinite" }}>
          Memora
        </span>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--color-cream-100)",
            color: "var(--color-earth-800)",
            border: "1px solid var(--color-cream-300)",
            fontFamily: "var(--font-body)",
          },
        }}
      />

      {view === "welcome" && (
        <WelcomeView onContinue={() => setView(hasApiKey ? "dashboard" : "welcome")} onSetupKey={() => setView("welcome")} />
      )}

      {view === "welcome" && !hasApiKey && (
        <ApiKeySetup
          onComplete={() => {
            setHasApiKey(true);
            setView("dashboard");
          }}
        />
      )}

      {view === "dashboard" && (
        <DashboardView
          personas={personas}
          onCreateNew={() => setView("create")}
          onSelectPersona={(id) => navigateTo("chat", id)}
          onSettings={() => setView("settings")}
          onRefresh={refreshPersonas}
        />
      )}

      {view === "create" && (
        <CreateWizard
          onBack={() => setView("dashboard")}
          onComplete={async (personaId) => {
            await refreshPersonas();
            navigateTo("chat", personaId);
          }}
        />
      )}

      {view === "chat" && activePersonaId && (
        <ChatView
          personaId={activePersonaId}
          onBack={() => {
            refreshPersonas();
            setView("dashboard");
          }}
        />
      )}

      {view === "settings" && (
        <SettingsView
          onBack={() => setView("dashboard")}
          onApiKeyChanged={() => setHasApiKey(true)}
        />
      )}
    </>
  );
}
