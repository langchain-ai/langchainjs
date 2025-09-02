# @langchain/eslint

Shared ESLint configuration for LangChain.js projects.

## Installation

```bash
pnpm add -D @langchain/eslint
```

## Usage

Create an `eslint.config.ts` file in your project root:

```ts
import { langchainConfig } from "@langchain/eslint";

export default langchainConfig;
```

Or for specific presets:

```ts
import { base, node, browser } from "@langchain/eslint";

export default [...base, ...node];
```

## Available Configurations

- `langchainConfig` - Full LangChain configuration (includes all rules)
- `base` - Base TypeScript + Prettier configuration
- `node` - Node.js specific rules
- `browser` - Browser specific rules

## Customization

You can override any rules by adding your own configuration after importing:

```ts
import { langchainConfig, type Linter } from "@langchain/eslint";

const config: Linter.Config[] = [
  ...langchainConfig,
  {
    files: ["**/*.ts"],
    rules: {
      // Your custom rules
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default config;
```
