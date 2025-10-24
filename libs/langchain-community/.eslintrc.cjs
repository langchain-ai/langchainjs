module.exports = {
  extends: [
    "airbnb-base",
    "eslint:recommended",
    "prettier",
    "plugin:@typescript-eslint/recommended",
  ],
  parserOptions: {
    ecmaVersion: 12,
    parser: "@typescript-eslint/parser",
    project: "./tsconfig.json",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "no-instanceof"],
  ignorePatterns: [
    ".eslintrc.cjs",
    "scripts",
    "node_modules",
    "dist",
    "dist-cjs",
    "*.js",
    "*.cjs",
    "*.d.ts",
  ],
  rules: {
    "no-process-env": 2,
    "no-instanceof/no-instanceof": 2,
    "@typescript-eslint/explicit-module-boundary-types": 0,
    "@typescript-eslint/no-empty-function": 0,
    "@typescript-eslint/no-shadow": 0,
    "@typescript-eslint/no-empty-interface": 0,
    "@typescript-eslint/no-use-before-define": ["error", "nofunc"],
    "@typescript-eslint/no-unused-vars": ["warn", { args: "none" }],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    camelcase: 0,
    "class-methods-use-this": 0,
    "import/extensions": [2, "ignorePackages"],
    "import/no-extraneous-dependencies": [
      "error",
      { devDependencies: ["**/*.test.ts"] },
    ],
    "import/no-unresolved": 0,
    "import/prefer-default-export": 0,
    "keyword-spacing": "error",
    "max-classes-per-file": 0,
    "max-len": 0,
    "no-await-in-loop": 0,
    "no-bitwise": 0,
    "no-console": 0,
    "no-restricted-syntax": 0,
    "no-shadow": 0,
    "no-continue": 0,
    "no-void": 0,
    "no-underscore-dangle": 0,
    "no-use-before-define": 0,
    "no-useless-constructor": 0,
    "no-return-await": 0,
    "consistent-return": 0,
    "no-else-return": 0,
    "func-names": 0,
    "no-lonely-if": 0,
    "prefer-template": 0,
    "prefer-rest-params": 0,
    "new-cap": ["error", { properties: false, capIsNew: false }],
    "arrow-body-style": 0,
    "prefer-destructuring": 0
  },
  overrides: [
    {
      files: ['**/*.test.ts'],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off'
      }
    }
  ]
};
