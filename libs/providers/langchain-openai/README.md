# @langchain/openai

This package contains the LangChain.js integrations for OpenAI through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/openai @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.0.0"
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

The field you need depends on the package manager you're using, but we recommend adding a field for the common `pnpm`, `npm`, and `yarn` to maximize compatibility.

## Chat Models

This package contains the `ChatOpenAI` class, which is the recommended way to interface with the OpenAI series of models.

To use, install the requirements, and configure your environment.

```bash
export OPENAI_API_KEY=your-api-key
```

Then initialize

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4-1106-preview",
});
const response = await model.invoke(new HumanMessage("Hello world!"));
```

### Streaming

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4-1106-preview",
});
const response = await model.stream(new HumanMessage("Hello world!"));
```

## Tools

This package provides LangChain-compatible wrappers for OpenAI's built-in tools for the Responses API.

### Web Search Tool

The web search tool allows OpenAI models to search the web for up-to-date information before generating a response. Web search supports three main types:

1. **Non-reasoning web search**: Quick lookups where the model passes queries directly to the search tool
2. **Agentic search with reasoning models**: The model actively manages the search process, analyzing results and deciding whether to keep searching
3. **Deep research**: Extended investigations using models like `o3-deep-research` or `gpt-5` with high reasoning effort

```typescript
import { ChatOpenAI, tools } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4o",
});

// Basic usage
const response = await model.invoke(
  "What was a positive news story from today?",
  {
    tools: [tools.webSearch()],
  }
);
```

**Domain filtering** - Limit search results to specific domains (up to 100):

```typescript
const response = await model.invoke("Latest AI research news", {
  tools: [
    tools.webSearch({
      filters: {
        allowedDomains: ["arxiv.org", "nature.com", "science.org"],
      },
    }),
  ],
});
```

**User location** - Refine search results based on geography:

```typescript
const response = await model.invoke("What are the best restaurants near me?", {
  tools: [
    tools.webSearch({
      userLocation: {
        type: "approximate",
        country: "US",
        city: "San Francisco",
        region: "California",
        timezone: "America/Los_Angeles",
      },
    }),
  ],
});
```

**Cache-only mode** - Disable live internet access:

```typescript
const response = await model.invoke("Find information about OpenAI", {
  tools: [
    tools.webSearch({
      externalWebAccess: false,
    }),
  ],
});
```

For more information, see [OpenAI's Web Search Documentation](https://platform.openai.com/docs/guides/tools-web-search).

### MCP Tool (Model Context Protocol)

The MCP tool allows OpenAI models to connect to remote MCP servers and OpenAI-maintained service connectors, giving models access to external tools and services.

There are two ways to use MCP tools:

1. **Remote MCP servers**: Connect to any public MCP server via URL
2. **Connectors**: Use OpenAI-maintained wrappers for popular services like Google Workspace or Dropbox

**Remote MCP server** - Connect to any MCP-compatible server:

```typescript
import { ChatOpenAI, tools } from "@langchain/openai";

const model = new ChatOpenAI({ model: "gpt-4o" });

const response = await model.invoke("Roll 2d4+1", {
  tools: [
    tools.mcp({
      serverLabel: "dmcp",
      serverDescription: "A D&D MCP server for dice rolling",
      serverUrl: "https://dmcp-server.deno.dev/sse",
      requireApproval: "never",
    }),
  ],
});
```

**Service connectors** - Use OpenAI-maintained connectors for popular services:

```typescript
const response = await model.invoke("What's on my calendar today?", {
  tools: [
    tools.mcp({
      serverLabel: "google_calendar",
      connectorId: "connector_googlecalendar",
      authorization: "<oauth-access-token>",
      requireApproval: "never",
    }),
  ],
});
```

For more information, see [OpenAI's MCP Documentation](https://platform.openai.com/docs/guides/tools-remote-mcp).

### Code Interpreter Tool

The Code Interpreter tool allows models to write and run Python code in a sandboxed environment to solve complex problems.

Use Code Interpreter for:

- **Data analysis**: Processing files with diverse data and formatting
- **File generation**: Creating files with data and images of graphs
- **Iterative coding**: Writing and running code iteratively to solve problems
- **Visual intelligence**: Cropping, zooming, rotating, and transforming images

```typescript
import { ChatOpenAI, tools } from "@langchain/openai";

const model = new ChatOpenAI({ model: "gpt-4.1" });

// Basic usage with auto container (default 1GB memory)
const response = await model.invoke("Solve the equation 3x + 11 = 14", {
  tools: [tools.codeInterpreter()],
});
```

**Memory configuration** - Choose from 1GB (default), 4GB, 16GB, or 64GB:

```typescript
const response = await model.invoke(
  "Analyze this large dataset and create visualizations",
  {
    tools: [
      tools.codeInterpreter({
        container: { memoryLimit: "4g" },
      }),
    ],
  }
);
```

**With files** - Make uploaded files available to the code:

```typescript
const response = await model.invoke("Process the uploaded CSV file", {
  tools: [
    tools.codeInterpreter({
      container: {
        memoryLimit: "4g",
        fileIds: ["file-abc123", "file-def456"],
      },
    }),
  ],
});
```

**Explicit container** - Use a pre-created container ID:

```typescript
const response = await model.invoke("Continue working with the data", {
  tools: [
    tools.codeInterpreter({
      container: "cntr_abc123",
    }),
  ],
});
```

> **Note**: Containers expire after 20 minutes of inactivity. While called "Code Interpreter", the model knows it as the "python tool" - for explicit prompting, ask for "the python tool" in your prompts.

For more information, see [OpenAI's Code Interpreter Documentation](https://platform.openai.com/docs/guides/tools-code-interpreter).

### File Search Tool

The File Search tool allows models to search your files for relevant information using semantic and keyword search. It enables retrieval from a knowledge base of previously uploaded files stored in vector stores.

**Prerequisites**: Before using File Search, you must:

1. Upload files to the File API with `purpose: "assistants"`
2. Create a vector store
3. Add files to the vector store

```typescript
import { ChatOpenAI, tools } from "@langchain/openai";

const model = new ChatOpenAI({ model: "gpt-4.1" });

const response = await model.invoke("What is deep research by OpenAI?", {
  tools: [
    tools.fileSearch({
      vectorStoreIds: ["vs_abc123"],
      // maxNumResults: 5, // Limit results for lower latency
      // filters: { type: "eq", key: "category", value: "blog" }, // Metadata filtering
      // filters: { type: "and", filters: [                       // Compound filters (AND/OR)
      //   { type: "eq", key: "category", value: "technical" },
      //   { type: "gte", key: "year", value: 2024 },
      // ]},
      // rankingOptions: { scoreThreshold: 0.8, ranker: "auto" }, // Customize scoring
    }),
  ],
});
```

Filter operators: `eq` (equals), `ne` (not equal), `gt` (greater than), `gte` (greater than or equal), `lt` (less than), `lte` (less than or equal).

For more information, see [OpenAI's File Search Documentation](https://platform.openai.com/docs/guides/tools-file-search).

### Image Generation Tool

The Image Generation tool allows models to generate or edit images using text prompts and optional image inputs. It leverages the GPT Image model and automatically optimizes text inputs for improved performance.

Use Image Generation for:

- **Creating images from text**: Generate images from detailed text descriptions
- **Editing existing images**: Modify images based on text instructions
- **Multi-turn image editing**: Iteratively refine images across conversation turns
- **Various output formats**: Support for PNG, JPEG, and WebP formats

```typescript
import { ChatOpenAI, tools } from "@langchain/openai";

const model = new ChatOpenAI({ model: "gpt-4o" });

// Basic usage - generate an image
const response = await model.invoke(
  "Generate an image of a gray tabby cat hugging an otter with an orange scarf",
  { tools: [tools.imageGeneration()] }
);

// Access the generated image (base64-encoded)
const imageOutput = response.additional_kwargs.tool_outputs?.find(
  (output) => output.type === "image_generation_call"
);
if (imageOutput?.result) {
  const fs = await import("fs");
  fs.writeFileSync("output.png", Buffer.from(imageOutput.result, "base64"));
}
```

**Custom size and quality** - Configure output dimensions and quality:

```typescript
const response = await model.invoke("Draw a beautiful sunset over mountains", {
  tools: [
    tools.imageGeneration({
      size: "1536x1024", // Landscape format (also: "1024x1024", "1024x1536", "auto")
      quality: "high", // Quality level (also: "low", "medium", "auto")
    }),
  ],
});
```

**Output format and compression** - Choose format and compression level:

```typescript
const response = await model.invoke("Create a product photo", {
  tools: [
    tools.imageGeneration({
      outputFormat: "jpeg", // Format (also: "png", "webp")
      outputCompression: 90, // Compression 0-100 (for JPEG/WebP)
    }),
  ],
});
```

**Transparent background** - Generate images with transparency:

```typescript
const response = await model.invoke(
  "Create a logo with transparent background",
  {
    tools: [
      tools.imageGeneration({
        background: "transparent", // Background type (also: "opaque", "auto")
        outputFormat: "png",
      }),
    ],
  }
);
```

**Streaming with partial images** - Get visual feedback during generation:

```typescript
const response = await model.invoke("Draw a detailed fantasy castle", {
  tools: [
    tools.imageGeneration({
      partialImages: 2, // Number of partial images (0-3)
    }),
  ],
});
```

**Force image generation** - Ensure the model uses the image generation tool:

```typescript
const response = await model.invoke("A serene lake at dawn", {
  tools: [tools.imageGeneration()],
  tool_choice: { type: "image_generation" },
});
```

**Multi-turn editing** - Refine images across conversation turns:

```typescript
// First turn: generate initial image
const response1 = await model.invoke("Draw a red car", {
  tools: [tools.imageGeneration()],
});

// Second turn: edit the image
const response2 = await model.invoke(
  [response1, new HumanMessage("Now change the car color to blue")],
  { tools: [tools.imageGeneration()] }
);
```

> **Prompting tips**: Use terms like "draw" or "edit" for best results. For combining images, say "edit the first image by adding this element" instead of "combine" or "merge".

Supported models: `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`, `o3`

For more information, see [OpenAI's Image Generation Documentation](https://platform.openai.com/docs/guides/tools-image-generation).

### Computer Use Tool

The Computer Use tool allows models to control computer interfaces by simulating mouse clicks, keyboard input, scrolling, and more. It uses OpenAI's Computer-Using Agent (CUA) model to understand screenshots and suggest actions.

> **Beta**: Computer use is in beta. Use in sandboxed environments only and do not use for high-stakes or authenticated tasks. Always implement human-in-the-loop for important decisions.

**How it works**: The tool operates in a continuous loop:

1. Model sends computer actions (click, type, scroll, etc.)
2. Your code executes these actions in a controlled environment
3. You capture a screenshot of the result
4. Send the screenshot back to the model
5. Repeat until the task is complete

```typescript
import { ChatOpenAI, tools } from "@langchain/openai";

const model = new ChatOpenAI({ model: "computer-use-preview" });

// With execute callback for automatic action handling
const computer = tools.computerUse({
  displayWidth: 1024,
  displayHeight: 768,
  environment: "browser",
  execute: async (action) => {
    if (action.type === "screenshot") {
      return captureScreenshot();
    }
    if (action.type === "click") {
      await page.mouse.click(action.x, action.y, { button: action.button });
      return captureScreenshot();
    }
    if (action.type === "type") {
      await page.keyboard.type(action.text);
      return captureScreenshot();
    }
    if (action.type === "scroll") {
      await page.mouse.move(action.x, action.y);
      await page.evaluate(
        `window.scrollBy(${action.scroll_x}, ${action.scroll_y})`
      );
      return captureScreenshot();
    }
    // Handle other actions...
    return captureScreenshot();
  },
});

const llmWithComputer = model.bindTools([computer]);
const response = await llmWithComputer.invoke(
  "Check the latest news on bing.com"
);
```

For more information, see [OpenAI's Computer Use Documentation](https://platform.openai.com/docs/guides/tools-computer-use).

### Local Shell Tool

The Local Shell tool allows models to run shell commands locally on a machine you provide. Commands are executed inside your own runtime—the API only returns the instructions.

> **Security Warning**: Running arbitrary shell commands can be dangerous. Always sandbox execution or add strict allow/deny-lists before forwarding commands to the system shell.
> **Note**: This tool is designed to work with [Codex CLI](https://github.com/openai/codex) and the `codex-mini-latest` model.

```typescript
import { ChatOpenAI, tools } from "@langchain/openai";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const model = new ChatOpenAI({ model: "codex-mini-latest" });

// With execute callback for automatic command handling
const shell = tools.localShell({
  execute: async (action) => {
    const { command, env, working_directory, timeout_ms } = action;
    const result = await execAsync(command.join(" "), {
      cwd: working_directory ?? process.cwd(),
      env: { ...process.env, ...env },
      timeout: timeout_ms ?? undefined,
    });
    return result.stdout + result.stderr;
  },
});

const llmWithShell = model.bindTools([shell]);
const response = await llmWithShell.invoke(
  "List files in the current directory"
);
```

**Action properties**: The model returns actions with these properties:

- `command` - Array of argv tokens to execute
- `env` - Environment variables to set
- `working_directory` - Directory to run the command in
- `timeout_ms` - Suggested timeout (enforce your own limits)
- `user` - Optional user to run the command as

For more information, see [OpenAI's Local Shell Documentation](https://platform.openai.com/docs/guides/tools-local-shell).

## Embeddings

This package also adds support for OpenAI's embeddings model.

```typescript
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});
const res = await embeddings.embedQuery("Hello world");
```

## Development

To develop the OpenAI package, you'll need to follow these instructions:

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
pnpm build --filter=@langchain/openai
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
