import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

// Flat config (ESLint 9+). Copre il frontend TypeScript/React delle due finestre.
// `prettier` va per ultimo: disattiva le regole di stile che confliggono con
// Prettier, lasciando a quest'ultimo la formattazione.
export default tseslint.config(
  {
    ignores: ["dist", "coverage", "src-tauri", "**/*.config.{js,ts}"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        crypto: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        fetch: "readonly",
        HTMLElement: "readonly",
        HTMLAudioElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLDivElement: "readonly",
        Image: "readonly",
        Audio: "readonly",
        AudioContext: "readonly",
        ResizeObserver: "readonly",
        DOMMatrix: "readonly",
        Blob: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Le regole "React Compiler" introdotte da eslint-plugin-react-hooks v7
      // (purity / set-state-in-effect / refs) sono molto severe e segnalano
      // pattern che in questo codice funzionano correttamente. Le teniamo come
      // WARNING — informano senza bloccare la CI; un'eventuale adozione del
      // React Compiler le promuoverà a error in un intervento dedicato.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  prettier,
);
