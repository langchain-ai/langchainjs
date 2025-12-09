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

This package provides LangChain-compatible wrappers for Anthropic's built-in tools. These tools can be bound to `ChatAnthropic` using `bindTools()` or any [`ReactAgent`](https://docs.langchain.com/oss/javascript/langchain/agents).

### Memory Tool

The memory tool (`memory_20250818`) enables Claude to store and retrieve information across conversations through a memory file directory. Claude can create, read, update, and delete files that persist between sessions, allowing it to build knowledge over time without keeping everything in the context window.

```typescript
import { ChatAnthropic, tools } from "@langchain/anthropic";

// Create a simple in-memory file store (or use your own persistence layer)
const files = new Map<string, string>();

const memory = tools.memory_20250818({
  execute: async (command) => {
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

### Web Search Tool

The web search tool (`webSearch_20250305`) gives Claude direct access to real-time web content, allowing it to answer questions with up-to-date information beyond its knowledge cutoff. Claude automatically cites sources from search results as part of its answer.

```typescript
import { ChatAnthropic, tools } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

// Basic usage
const response = await llm.invoke("What is the weather in NYC?", {
  tools: [tools.webSearch_20250305()],
});
```

The web search tool supports several configuration options:

```typescript
const response = await llm.invoke("Latest news about AI?", {
  tools: [
    tools.webSearch_20250305({
      // Maximum number of times the tool can be used in the API request
      maxUses: 5,
      // Only include results from these domains
      allowedDomains: ["reuters.com", "bbc.com"],
      // Or block specific domains (cannot be used with allowedDomains)
      // blockedDomains: ["example.com"],
      // Provide user location for more relevant results
      userLocation: {
        type: "approximate",
        city: "San Francisco",
        region: "California",
        country: "US",
        timezone: "America/Los_Angeles",
      },
    }),
  ],
});
```

For more information, see [Anthropic's Web Search Tool documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-search-tool).

### Web Fetch Tool

The web fetch tool (`webFetch_20250910`) allows Claude to retrieve full content from specified web pages and PDF documents. Claude can only fetch URLs that have been explicitly provided by the user or that come from previous web search or web fetch results.

> **⚠️ Security Warning:** Enabling the web fetch tool in environments where Claude processes untrusted input alongside sensitive data poses data exfiltration risks. We recommend only using this tool in trusted environments or when handling non-sensitive data.

```typescript
import { ChatAnthropic, tools } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

// Basic usage - fetch content from a URL
const response = await llm.invoke(
  "Please analyze the content at https://example.com/article",
  { tools: [tools.webFetch_20250910()] }
);
```

The web fetch tool supports several configuration options:

```typescript
const response = await llm.invoke(
  "Summarize this research paper: https://arxiv.org/abs/2024.12345",
  {
    tools: [
      tools.webFetch_20250910({
        // Maximum number of times the tool can be used in the API request
        maxUses: 5,
        // Only fetch from these domains
        allowedDomains: ["arxiv.org", "example.com"],
        // Or block specific domains (cannot be used with allowedDomains)
        // blockedDomains: ["example.com"],
        // Enable citations for fetched content (optional, unlike web search)
        citations: { enabled: true },
        // Maximum content length in tokens (helps control token usage)
        maxContentTokens: 50000,
      }),
    ],
  }
);
```

You can combine web fetch with web search for comprehensive information gathering:

```typescript
import { tools } from "@langchain/anthropic";

const response = await llm.invoke(
  "Find recent articles about quantum computing and analyze the most relevant one",
  {
    tools: [
      tools.webSearch_20250305({ maxUses: 3 }),
      tools.webFetch_20250910({ maxUses: 5, citations: { enabled: true } }),
    ],
  }
);
```

For more information, see [Anthropic's Web Fetch Tool documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/web-fetch-tool).

### Tool Search Tools

The tool search tools enable Claude to work with hundreds or thousands of tools by dynamically discovering and loading them on-demand. This is useful when you have a large number of tools but don't want to load them all into the context window at once.

There are two variants:

- **`toolSearchRegex_20251119`** - Claude constructs regex patterns (using Python's `re.search()` syntax) to search for tools
- **`toolSearchBM25_20251119`** - Claude uses natural language queries to search for tools using the BM25 algorithm

```typescript
import { ChatAnthropic, tools } from "@langchain/anthropic";
import { tool } from "langchain";
import { z } from "zod";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

// Create tools with defer_loading to make them discoverable via search
const getWeather = tool(
  async (input: { location: string }) => {
    return `Weather in ${input.location}: Sunny, 72°F`;
  },
  {
    name: "get_weather",
    description: "Get the weather at a specific location",
    schema: z.object({
      location: z.string(),
    }),
    extras: { defer_loading: true },
  }
);

const getNews = tool(
  async (input: { topic: string }) => {
    return `Latest news about ${input.topic}...`;
  },
  {
    name: "get_news",
    description: "Get the latest news about a topic",
    schema: z.object({
      topic: z.string(),
    }),
    extras: { defer_loading: true },
  }
);

// Claude will search and discover tools as needed
const response = await llm.invoke("What is the weather in San Francisco?", {
  tools: [tools.toolSearchRegex_20251119(), getWeather, getNews],
});
```

Using the BM25 variant for natural language search:

```typescript
import { tools } from "@langchain/anthropic";

const response = await llm.invoke("What is the weather in San Francisco?", {
  tools: [tools.toolSearchBM25_20251119(), getWeather, getNews],
});
```

For more information, see [Anthropic's Tool Search documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/tool-search-tool).

### Text Editor Tool

The text editor tool (`textEditor_20250728`) enables Claude to view and modify text files, helping debug, fix, and improve code or other text documents. Claude can directly interact with files, providing hands-on assistance rather than just suggesting changes.

Available commands:

- `view` - Examine file contents or list directory contents
- `str_replace` - Replace specific text in a file
- `create` - Create a new file with specified content
- `insert` - Insert text at a specific line number

```typescript
import fs from "node:fs";
import { ChatAnthropic, tools } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

const textEditor = tools.textEditor_20250728({
  async execute(args) {
    switch (args.command) {
      case "view":
        const content = fs.readFileSync(args.path, "utf-8");
        // Return with line numbers for Claude to reference
        return content
          .split("\n")
          .map((line, i) => `${i + 1}: ${line}`)
          .join("\n");
      case "str_replace":
        let fileContent = fs.readFileSync(args.path, "utf-8");
        fileContent = fileContent.replace(args.old_str, args.new_str);
        fs.writeFileSync(args.path, fileContent);
        return "Successfully replaced text.";
      case "create":
        fs.writeFileSync(args.path, args.file_text);
        return `Successfully created file: ${args.path}`;
      case "insert":
        const lines = fs.readFileSync(args.path, "utf-8").split("\n");
        lines.splice(args.insert_line, 0, args.new_str);
        fs.writeFileSync(args.path, lines.join("\n"));
        return `Successfully inserted text at line ${args.insert_line}`;
      default:
        return "Unknown command";
    }
  },
  // Optional: limit file content length when viewing
  maxCharacters: 10000,
});

const llmWithEditor = llm.bindTools([textEditor]);

const response = await llmWithEditor.invoke(
  "There's a syntax error in my primes.py file. Can you help me fix it?"
);
```

For more information, see [Anthropic's Text Editor Tool documentation](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/text-editor-tool).

### Computer Use Tool

The computer use tools enable Claude to interact with desktop environments through screenshot capture, mouse control, and keyboard input for autonomous desktop interaction.

> **⚠️ Security Warning:** Computer use is a beta feature with unique risks. Use a dedicated virtual machine or container with minimal privileges. Avoid giving access to sensitive data.

There are two variants:

- **`computer_20251124`** - For Claude Opus 4.5 (includes zoom capability)
- **`computer_20250124`** - For Claude 4 and Claude 3.7 models

Available actions:

- `screenshot` - Capture the current screen
- `left_click`, `right_click`, `middle_click` - Mouse clicks at coordinates
- `double_click`, `triple_click` - Multi-click actions
- `left_click_drag` - Click and drag operations
- `left_mouse_down`, `left_mouse_up` - Granular mouse control
- `scroll` - Scroll the screen
- `type` - Type text
- `key` - Press keyboard keys/shortcuts
- `mouse_move` - Move the cursor
- `hold_key` - Hold a key while performing other actions
- `wait` - Wait for a specified duration
- `zoom` - View specific screen regions at full resolution (Claude Opus 4.5 only)

```typescript
import {
  ChatAnthropic,
  tools,
  type Computer20250124Action,
} from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

const computer = tools.computer_20250124({
  // Required: specify display dimensions
  displayWidthPx: 1024,
  displayHeightPx: 768,
  // Optional: X11 display number
  displayNumber: 1,
  execute: async (action: Computer20250124Action) => {
    switch (action.action) {
      case "screenshot":
      // Capture and return base64-encoded screenshot
      // ...
      case "left_click":
      // Click at the specified coordinates
      // ...
      // ...
    }
  },
});

const llmWithComputer = llm.bindTools([computer]);

const response = await llmWithComputer.invoke(
  "Save a picture of a cat to my desktop."
);
```

For Claude Opus 4.5 with zoom support:

```typescript
import { tools } from "@langchain/anthropic";

const computer = tools.computer_20251124({
  displayWidthPx: 1920,
  displayHeightPx: 1080,
  // Enable zoom for detailed screen region inspection
  enableZoom: true,
  execute: async (action) => {
    // Handle actions including "zoom" for Claude Opus 4.5
    // ...
  },
});
```

For more information, see [Anthropic's Computer Use documentation](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use).

### Code Execution Tool

The code execution tool (`codeExecution_20250825`) allows Claude to run Bash commands and manipulate files in a secure, sandboxed environment. Claude can analyze data, create visualizations, perform calculations, and process files.

When this tool is provided, Claude automatically gains access to:

- **Bash commands** - Execute shell commands for system operations
- **File operations** - Create, view, and edit files directly

```typescript
import { ChatAnthropic, tools } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

// Basic usage - calculations and data analysis
const response = await llm.invoke(
  "Calculate the mean and standard deviation of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]",
  { tools: [tools.codeExecution_20250825()] }
);

// File operations and visualization
const response2 = await llm.invoke(
  "Create a matplotlib visualization of sales data and save it as chart.png",
  { tools: [tools.codeExecution_20250825()] }
);
```

Container reuse for multi-step workflows:

```typescript
// First request - creates a container
const response1 = await llm.invoke("Write a random number to /tmp/number.txt", {
  tools: [tools.codeExecution_20250825()],
});

// Extract container ID from response for reuse
const containerId = response1.response_metadata?.container?.id;

// Second request - reuse container to access the file
const response2 = await llm.invoke(
  "Read /tmp/number.txt and calculate its square",
  {
    tools: [tools.codeExecution_20250825()],
    container: containerId,
  }
);
```

For more information, see [Anthropic's Code Execution Tool documentation](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/code-execution-tool).

### Bash Tool

The bash tool (`bash_20250124`) enables shell command execution in a persistent bash session. Unlike the sandboxed code execution tool, this tool requires you to provide your own execution environment.

> **⚠️ Security Warning:** The bash tool provides direct system access. Implement safety measures such as running in isolated environments (Docker/VM), command filtering, and resource limits.

The bash tool provides:

- **Persistent bash session** - Maintains state between commands
- **Shell command execution** - Run any shell command
- **Environment access** - Access to environment variables and working directory
- **Command chaining** - Support for pipes, redirects, and scripting

Available commands:

- Execute a command: `{ command: "ls -la" }`
- Restart the session: `{ restart: true }`

```typescript
import { ChatAnthropic, tools } from "@langchain/anthropic";
import { execSync } from "child_process";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

const bash = tools.bash_20250124({
  execute: async (args) => {
    if (args.restart) {
      // Reset session state
      return "Bash session restarted";
    }
    try {
      const output = execSync(args.command, {
        encoding: "utf-8",
        timeout: 30000,
      });
      return output;
    } catch (error) {
      return `Error: ${(error as Error).message}`;
    }
  },
});

const llmWithBash = llm.bindTools([bash]);

const response = await llmWithBash.invoke(
  "List all Python files in the current directory"
);

// Process tool calls and execute commands
console.log(response.tool_calls?.[0].name); // "bash"
console.log(response.tool_calls?.[0].args.command); // "ls -la *.py"
```

For more information, see [Anthropic's Bash Tool documentation](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/bash-tool).

### MCP Toolset

The MCP toolset (`mcpToolset_20251120`) enables Claude to connect to remote MCP (Model Context Protocol) servers directly from the Messages API without implementing a separate MCP client. This allows Claude to use tools provided by MCP servers.

Key features:

- **Direct API integration** - Connect to MCP servers without implementing an MCP client
- **Tool calling support** - Access MCP tools through the Messages API
- **Flexible tool configuration** - Enable all tools, allowlist specific tools, or denylist unwanted tools
- **Per-tool configuration** - Configure individual tools with custom settings
- **OAuth authentication** - Support for OAuth Bearer tokens for authenticated servers
- **Multiple servers** - Connect to multiple MCP servers in a single request

```typescript
import { ChatAnthropic, tools } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

// Basic usage - enable all tools from an MCP server
const response = await llm.invoke("What tools do you have available?", {
  mcp_servers: [
    {
      type: "url",
      url: "https://example-server.modelcontextprotocol.io/sse",
      name: "example-mcp",
      authorization_token: "YOUR_TOKEN",
    },
  ],
  tools: [tools.mcpToolset_20251120({ serverName: "example-mcp" })],
});
```

**Allowlist pattern** - Enable only specific tools:

```typescript
const response = await llm.invoke("Search for events", {
  mcp_servers: [
    {
      type: "url",
      url: "https://calendar.example.com/sse",
      name: "google-calendar-mcp",
      authorization_token: "YOUR_TOKEN",
    },
  ],
  tools: [
    tools.mcpToolset_20251120({
      serverName: "google-calendar-mcp",
      // Disable all tools by default
      defaultConfig: { enabled: false },
      // Explicitly enable only these tools
      configs: {
        search_events: { enabled: true },
        create_event: { enabled: true },
      },
    }),
  ],
});
```

**Denylist pattern** - Disable specific tools:

```typescript
const response = await llm.invoke("List my events", {
  mcp_servers: [
    {
      type: "url",
      url: "https://calendar.example.com/sse",
      name: "google-calendar-mcp",
      authorization_token: "YOUR_TOKEN",
    },
  ],
  tools: [
    tools.mcpToolset_20251120({
      serverName: "google-calendar-mcp",
      // All tools enabled by default, just disable dangerous ones
      configs: {
        delete_all_events: { enabled: false },
        share_calendar_publicly: { enabled: false },
      },
    }),
  ],
});
```

**Multiple MCP servers**:

```typescript
const response = await llm.invoke("Use tools from both servers", {
  mcp_servers: [
    {
      type: "url",
      url: "https://mcp.example1.com/sse",
      name: "mcp-server-1",
      authorization_token: "TOKEN1",
    },
    {
      type: "url",
      url: "https://mcp.example2.com/sse",
      name: "mcp-server-2",
      authorization_token: "TOKEN2",
    },
  ],
  tools: [
    tools.mcpToolset_20251120({ serverName: "mcp-server-1" }),
    tools.mcpToolset_20251120({
      serverName: "mcp-server-2",
      defaultConfig: { deferLoading: true },
    }),
  ],
});
```

**With Tool Search** - Use deferred loading for on-demand tool discovery:

```typescript
const response = await llm.invoke("Find and use the right tool", {
  mcp_servers: [
    {
      type: "url",
      url: "https://example.com/sse",
      name: "example-mcp",
    },
  ],
  tools: [
    tools.toolSearchRegex_20251119(),
    tools.mcpToolset_20251120({
      serverName: "example-mcp",
      defaultConfig: { deferLoading: true },
    }),
  ],
});
```

For more information, see [Anthropic's MCP Connector documentation](https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector).

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
