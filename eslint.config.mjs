import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Custom per-clinic dev/build dirs (see next.config NEXT_DIST_DIR):
    ".next-*/**",
    // Generated / vendored / exported — never our source to lint:
    ".wwebjs_auth/**",
    ".wwebjs_cache/**",
    "deploy/**",
    "exports/**",
    "_export/**",
    "prisma/generated/**",
    // Desktop (Electron) build output + CommonJS main-process bootstrap. These
    // are not part of the Next/TS app source: dist-desktop/** is the bundled
    // electron-builder output, and electron/*.js legitimately uses CommonJS
    // require() (which the app's TS ruleset flags). Linted separately if at all.
    "dist-desktop/**",
    "dist/**",
    "electron/**",
  ]),
  // The React Compiler ESLint rules bundled with eslint-config-next are strict
  // about patterns this app uses intentionally and safely:
  //  - set-state-in-effect: mount-time hydration from localStorage (must run
  //    after mount to avoid SSR mismatch — the documented escape hatch).
  //  - purity: reading the current time (Date.now()) for "x minutes ago"
  //    displays that refresh on the parent's polling re-render.
  // Keep them visible as warnings instead of failing the build.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
