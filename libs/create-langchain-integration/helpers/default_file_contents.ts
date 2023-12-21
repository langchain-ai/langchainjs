export const DEFAULT_ESLINTRC = `module.exports = {
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
    "prefer-rest-params": 0,
    "new-cap": ["error", { properties: false, capIsNew: false }],
  },
};
`;

export const DEFAULT_README = `# @langchain/<ADD_PACKAGE_NAME_HERE>

This package contains the LangChain.js integrations for <ADD_NAME_HERE> through their SDK.

## Installation

\`\`\`bash npm2yarn
npm install @langchain/<ADD_PACKAGE_NAME_HERE>
\`\`\`

## Chat Models

This package contains the \`<ADD_CLASS_NAME_HERE>\` class, which is the recommended way to interface with the <ADD_NAME_HERE> series of models.

To use, install the requirements, and configure your environment.

\`\`\`bash
export <ADD_ENV_NAME_HERE>=your-api-key
\`\`\`

Then initialize

\`\`\`typescript
import { <ADD_CLASS_NAME_HERE> } from "@langchain/<ADD_PACKAGE_NAME_HERE>";

const model = new ExampleChatClass({
  apiKey: process.env.EXAMPLE_API_KEY,
});
const response = await model.invoke(new HumanMessage("Hello world!"));
\`\`\`

### Streaming

\`\`\`typescript
import { <ADD_CLASS_NAME_HERE> } from "@langchain/<ADD_PACKAGE_NAME_HERE>";

const model = new ExampleChatClass({
  apiKey: process.env.EXAMPLE_API_KEY,
});
const response = await model.stream(new HumanMessage("Hello world!"));
\`\`\`

## Embeddings

This package also adds support for <ADD_NAME_HERE> embeddings model.

\`\`\`typescript
import { <ADD_CLASS_NAME_HERE> } from "@langchain/<ADD_PACKAGE_NAME_HERE>";

const embeddings = new ExampleEmbeddingClass({
  apiKey: process.env.EXAMPLE_API_KEY,
});
const res = await embeddings.embedQuery("Hello world");
\`\`\`

## Development

To develop the <ADD_NAME_HERE> package, you'll need to follow these instructions:

### Install dependencies

\`\`\`bash
yarn install
\`\`\`

### Build the package

\`\`\`bash
yarn build
\`\`\`

Or from the repo root:

\`\`\`bash
yarn build --filter=@langchain/<ADD_PACKAGE_NAME_HERE>
\`\`\`

### Run tests

Test files should live within a \`tests/\` file in the \`src/\` folder. Unit tests should end in \`.test.ts\` and integration tests should
end in \`.int.test.ts\`:

\`\`\`bash
$ yarn test
$ yarn test:int
\`\`\`

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

\`\`\`bash
yarn lint && yarn format
\`\`\`

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from \`src/index.ts\`, or add it to \`scripts/create-entrypoints.js\` and run \`yarn build\` to generate the new entrypoint.
`;

export const DEFAULT_RELEASE_IT = `{
  "github": {
    "release": true,
    "autoGenerate": true,
    "tokenRef": "GITHUB_TOKEN_RELEASE"
  },
  "npm": {
    "versionArgs": [
      "--workspaces-update=false"
    ]
  }
}
`;
