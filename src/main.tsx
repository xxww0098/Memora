import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import React from "react";
import ReactDOM from "react-dom/client";
import { router } from "./router";
import "./index.css";

// Apply theme before first paint to prevent FOUC
(() => {
  const stored = localStorage.getItem("memora_theme") || "system";
  const isDark = stored === "dark" || (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (isDark) document.documentElement.classList.add("dark");
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// Disable context menu for native feel (allow in inputs)
document.addEventListener("contextmenu", (event) => {
  const target = event.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
    return;
  }
  event.preventDefault();
});

// Open external links in system browser
document.addEventListener("click", (event) => {
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor) return;
  const href = anchor.getAttribute("href");
  if (!href || !/^https?:\/\//i.test(href)) return;
  event.preventDefault();
  import("@tauri-apps/plugin-shell")
    .then(({ open }) => open(href))
    .catch(() => window.open(href, "_blank"));
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
