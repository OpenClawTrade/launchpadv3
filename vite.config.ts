import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  // Silence noisy (but harmless) Rollup warnings coming from some dependencies.
  // This keeps CI logs clean while preserving real warnings/errors.
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // e.g. "contains an annotation that Rollup cannot interpret" (/*#__PURE__*/)
        if (warning?.code === "INVALID_ANNOTATION") return;
        warn(warning);
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
