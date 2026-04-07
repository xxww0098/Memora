import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { getSettings, listPersonas } from "@/lib/tauri";
import { useTheme } from "@/hooks/useTheme";

export default function App() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const { resolved } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        const settings = await getSettings();
        if (settings.has_api_key) {
          const list = await listPersonas();
          if (list.length > 0) {
            navigate({ to: "/" });
          } else {
            navigate({ to: "/welcome" });
          }
        } else {
          navigate({ to: "/welcome" });
        }
      } catch {
        navigate({ to: "/welcome" });
      }
      setReady(true);
    })();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <span className="animate-pulse font-[var(--font-display)] text-2xl text-[var(--color-earth-500)]">
          Memora
        </span>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-center"
        theme={resolved}
        toastOptions={{
          style: {
            background: "var(--color-cream-100)",
            color: "var(--color-earth-800)",
            border: "1px solid var(--color-cream-300)",
            fontFamily: "var(--font-body)",
          },
        }}
      />
      <Outlet />
    </>
  );
}

