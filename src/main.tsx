import "./polyfills";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/gate-theme.css";

function isDynamicImportError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("dynamically imported module") ||
    msg.includes("importing a module script failed")
  );
}

async function importAppWithRetry(retries = 2, delay = 600): Promise<any> {
  try {
    return await import("./App.tsx");
  } catch (err) {
    if (retries > 0 && isDynamicImportError(err)) {
      await new Promise((r) => setTimeout(r, delay));
      return importAppWithRetry(retries - 1, delay);
    }
    throw err;
  }
}

async function bootstrap() {
  try {
    const { default: App } = await importAppWithRetry();
    createRoot(document.getElementById("root")!).render(<App />);
  } catch (err) {
    if (isDynamicImportError(err)) {
      const key = "main_bootstrap_reload";
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || now - parseInt(last, 10) > 10000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
        return;
      }
    }
    throw err;
  }
}

bootstrap();
