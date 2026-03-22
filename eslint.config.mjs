import js from "@eslint/js"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "dist/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // Re-enable safety-critical rules as warnings first to avoid blocking CI
      // while existing violations are cleaned up incrementally.
      "no-unused-vars": "off",                  // TypeScript handles this better
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "no-undef": "off",                        // TypeScript handles this
      "no-useless-escape": "warn",
      "no-control-regex": "off",                 // false positives in HTML regex
      "no-empty": ["warn", { allowEmptyCatch: false }],   // catch blocks should not be empty
      "no-useless-catch": "warn",                // re-throwing without modification is a code smell
      "no-useless-assignment": "off",
    },
  },
]
