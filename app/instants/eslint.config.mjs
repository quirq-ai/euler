import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Generated state and vendored build tooling are outside application lint.
  globalIgnores([
    ".next/**",
    ".next-euler/**",
    ".vinext/**",
    ".wrangler/**",
    ".sites-runtime/**",
    "dist/**",
    "out/**",
    "build/**",
    "vendor/**",
    "test-results/**",
    "playwright-report/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler is not enabled. These compiler diagnostics flag our
      // client hydration effects, event-time clocks, and latest-callback refs.
      // Revisit them when adopting the compiler; enforce Hook correctness now.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["components/instagram/shared.tsx"],
    rules: {
      // The photo primitive supports local uploads and direct external image
      // URLs with explicit loading/error states, without an image proxy.
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
