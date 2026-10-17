import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["out/", "node_modules/", "*.config.js", "*.config.mjs"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-console": "error",
      "max-len": ["error", { code: 120, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreComments: false }],
    },
  },
);
