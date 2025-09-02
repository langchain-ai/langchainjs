import js from "@eslint/js";
import tseslint, { type ConfigArray } from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import noInstanceofPlugin from "eslint-plugin-no-instanceof";
import importPlugin from "eslint-plugin-import";

const config: ConfigArray = tseslint.config(
  // Global ignores need to be in their own config object
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-cjs/**",
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "**/*.d.ts",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/.next/**",
      "**/scripts/**",
      "**/.eslintrc.cjs",
      "**/eslint.config.js",
      "**/eslint.config.ts",
      "**/vitest.config.ts",
      // Vendor directories with different coding standards
      "**/src/utils/@cfworker/**",
      "**/src/utils/fast-json-patch/**",
      "**/src/utils/js-sha1/**",
      "**/src/utils/js-sha256/**",
      "**/src/utils/sax-js/**",
      "**/src/util/@cfworker/**",
      "**/src/util/fast-json-patch/**",
      "**/src/util/js-sha1/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    name: "base",
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "no-instanceof": noInstanceofPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: process.cwd(),
      },
    },
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // TypeScript rules
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-shadow": "off",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/no-use-before-define": [
        "error",
        { functions: false },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "none",
          vars: "all",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-empty-object-type": "off",

      // Import rules
      "import/extensions": ["error", "ignorePackages"],
      "import/no-extraneous-dependencies": [
        "error",
        { devDependencies: ["**/*.test.ts", "**/*.test-d.ts", "**/*.spec.ts"] },
      ],
      "import/no-unresolved": "off",
      "import/prefer-default-export": "off",
      "import/no-cycle": "off",
      "import/no-relative-packages": "off",

      // General rules
      "no-instanceof/no-instanceof": "error",
      "no-process-env": "error",
      "keyword-spacing": "error",
      camelcase: "off",
      "class-methods-use-this": "off",
      "max-classes-per-file": "off",
      "max-len": "off",
      "no-bitwise": "off",
      "no-console": "off",
      "no-restricted-syntax": "off",
      "no-shadow": "off",
      "no-continue": "off",
      "no-void": "error",
      "no-underscore-dangle": "off",
      "no-use-before-define": "off",
      "no-useless-constructor": "off",
      "no-return-await": "off",
      "consistent-return": "off",
      "no-else-return": "off",
      "func-names": "off",
      "no-lonely-if": "off",
      "prefer-rest-params": "off",
      "new-cap": ["error", { properties: false, capIsNew: false }],
      "arrow-body-style": "off",
      "prefer-destructuring": "off",
      "no-param-reassign": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-restricted-globals": "off",
      "no-case-declarations": "off",
      "default-param-last": "off",
      "no-loop-func": "off",
      "no-nested-ternary": "off",
      "no-constructor-return": "error",
      "no-constant-condition": "error",
      "default-case": "error",
      "prefer-template": "error",
      "dot-notation": "error",
      /**
       * ToDo(@christian-bromann): evaluate to re-enable these rules for better code quality
       */
      "no-await-in-loop": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
  {
    // Test file overrides
    name: "test",
    files: ["**/*.test.ts", "**/*.test-d.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-process-env": "off",
      "import/no-extraneous-dependencies": "off",
      "no-restricted-imports": "off",
    },
  }
);

export default config;
