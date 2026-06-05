import { defineConfig } from "vitest/config";

// Config dei test separata da vite.config.ts: i test coprono la logica pura
// (lib/ruota, lib/scena, lib/ambientazione, state/timerStore) che non tocca DOM
// né le API Tauri, quindi l'ambiente `node` è sufficiente e più veloce.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/ruota.ts", "src/lib/scena.ts", "src/lib/ambientazione.ts"],
      reporter: ["text", "html"],
    },
  },
});
