import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The project predates this rule; many pre-existing patterns reset state
      // when props change or on mount (portals, image galleries, etc.). Disabling
      // globally keeps the build clean while preserving all other hooks checks.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ignore generated/third-party assets
    "public/**/*.js",
    "public/**/*.mjs",
  ]),
]);

export default eslintConfig;
