# Model Profiles Generator

A CLI tool for automatically generating TypeScript model profile files from the [models.dev](https://models.dev) API. This tool fetches model capabilities and constraints, applies provider-level and model-specific overrides, and generates TypeScript files matching the `ModelProfile` interface.

## Overview

The model-profiles generator simplifies the process of maintaining model capability profiles across LangChain provider packages.

### Key Features

- 🔄 **Automatic Data Fetching**: Fetches latest model data from the models.dev API
- 🎯 **Provider-Level Overrides**: Apply overrides to all models for a provider
- 🔧 **Model-Specific Overrides**: Fine-tune individual model profiles
- 📝 **Deterministic Generation**: Sorts model IDs and preserves models defined only in overrides
- 🎨 **Oxfmt Integration**: Automatically formats generated code using the project's Oxfmt config
- 📦 **Monorepo Friendly**: Works seamlessly with pnpm workspaces and `--filter` commands
- ✅ **Type Safety**: Generates code that matches the `ModelProfile` interface from `@langchain/core`

## Architecture

The model-profiles generator consists of:

```text
internal/model-profiles/
├── src/
│   ├── cli.ts              # Command-line interface
│   ├── config.ts            # TOML config parsing and override logic
│   ├── generator.ts         # TypeScript code generation and API integration
│   ├── api-schema.ts        # TypeScript types for models.dev API
│   └── tests/               # Test suite
│       ├── config.test.ts
│       └── generator.test.ts
├── package.json             # Tool dependencies
├── vitest.config.ts         # Test configuration
└── README.md                # This documentation
```

## Usage

### Basic Usage

Create a TOML configuration file (e.g., `profiles.toml`) in a provider package:

```toml
provider = "openai"
output = "src/chat_models/profiles.ts"
```

Then run the generator:

```bash
# From the model-profiles package
pnpm --filter @langchain/model-profiles make --config profiles.toml

# Or if running from within a provider package
pnpm --filter @langchain/model-profiles make --config profiles.toml
```

### Refresh All Providers

From the repository root:

```bash
pnpm --filter @langchain/model-profiles refresh
pnpm --filter @langchain/model-profiles refresh --provider openai,anthropic
```

The refresh command discovers every `libs/providers/*/profiles.toml` rather than maintaining a separate provider list. Filters use models.dev IDs: `google` refreshes both Google configurations, while `google-vertex` refreshes Google Common. Invalid filters fail before generation; generation failures are collected and make the command exit unsuccessfully.

The [refresh workflow](../../.github/workflows/refresh-model-profiles.yml) runs daily at 08:00 UTC and supports manual dispatch with the same provider filter. It creates or updates `bot/refresh-model-profiles` with only generated profile files, skips unchanged data, and never auto-merges. Any provider failure prevents pull request publication.

The workflow requires repository secrets `MODEL_PROFILE_BOT_CLIENT_ID` and `MODEL_PROFILE_BOT_PRIVATE_KEY`, matching the Python automation. The GitHub App must be installed on `langchain-ai/langchainjs` with contents and pull-request write permissions; an App token lets the generated pull request trigger CI.

### Configuration File Format

The TOML configuration file supports the following structure:

```toml
# Required: Provider ID from models.dev
provider = "openai"

# Required: Output path for generated TypeScript file (relative to config file)
output = "src/chat_models/profiles.ts"

# Optional: Provider-level overrides (applied to all models)
[overrides]
maxInputTokens = 100000
toolCalling = true
structuredOutput = true
imageUrlInputs = true

# Optional: Model-specific overrides (override provider-level settings)
[overrides."gpt-4"]
maxOutputTokens = 8192

[overrides."gpt-3.5-turbo"]
maxInputTokens = 16385
imageUrlInputs = false
```
