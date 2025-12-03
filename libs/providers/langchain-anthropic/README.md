# @langchain/anthropic

This package contains the LangChain.js integrations for Anthropic through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/anthropic @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/anthropic": "^0.0.9",
    "@langchain/core": "^0.3.0"
  },
  "resolutions": {
    "@langchain/core": "^0.3.0"
  },
  "overrides": {
    "@langchain/core": "^0.3.0"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "^0.3.0"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Chat Models

This package contains the `ChatAnthropic` class, which is the recommended way to interface with the Anthropic series of models.

To use, install the requirements, and configure your environment.

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Then initialize

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const response = await model.invoke({
  role: "user",
  content: "Hello world!",
});
```

### Streaming

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-sonnet-20240229",
});
const response = await model.stream({
  role: "user",
  content: "Hello world!",
});
```

## Tools

This package provides LangChain-compatible wrappers for Anthropic's built-in tools. These tools can be bound to `ChatAnthropic` using `bindTools()`.

### Memory Tool

The memory tool (`memory_20250818`) enables Claude to store and retrieve information across conversations through a memory file directory. Claude can create, read, update, and delete files that persist between sessions, allowing it to build knowledge over time without keeping everything in the context window.

```typescript
import { ChatAnthropic, memory_20250818 } from "@langchain/anthropic";
import type { Memory20250818Command } from "@langchain/anthropic";

// Create a simple in-memory file store (or use your own persistence layer)
const files = new Map<string, string>();

const memory = memory_20250818({
  execute: async (command: Memory20250818Command) => {
    switch (command.command) {
      case "view":
        if (!command.path || command.path === "/") {
          return Array.from(files.keys()).join("\n") || "Directory is empty.";
        }
        return (
          files.get(command.path) ?? `Error: File not found: ${command.path}`
        );
      case "create":
        files.set(command.path!, command.file_text ?? "");
        return `Successfully created file: ${command.path}`;
      case "str_replace":
        const content = files.get(command.path!);
        if (content && command.old_str) {
          files.set(
            command.path!,
            content.replace(command.old_str, command.new_str ?? "")
          );
        }
        return `Successfully replaced text in: ${command.path}`;
      case "delete":
        files.delete(command.path!);
        return `Successfully deleted: ${command.path}`;
      // Handle other commands: insert, rename
      default:
        return `Unknown command`;
    }
  },
});

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

const llmWithMemory = llm.bindTools([memory]);

const response = await llmWithMemory.invoke(
  "Remember that my favorite programming language is TypeScript"
);
```

For more information, see [Anthropic's Memory Tool documentation](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/memory-tool).

## Development

To develop the Anthropic package, you'll need to follow these instructions:

### Install dependencies

```bash
pnpm install
```

### Build the package

```bash
pnpm build
```

Or from the repo root:

```bash
pnpm build --filter @langchain/anthropic
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
pnpm test
pnpm test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
pnpm lint && pnpm format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `pnpm build` to generate the new entrypoint.

## Publishing

After running `pnpm build`, publish a new version with:

```bash
npm publish
```
