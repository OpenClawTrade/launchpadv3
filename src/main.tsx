import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Polyfill Buffer for browser (required by Privy SDK) - must be after React imports
import { Buffer } from "buffer";
if (typeof window !== "undefined" && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(<App />);
