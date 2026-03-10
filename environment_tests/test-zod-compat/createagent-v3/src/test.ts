/**
 * createAgent + zod v3 compatibility test
 *
 * Mirrors the real-world usage pattern from the original OOM issue:
 *   - Define tools with zod schemas
 *   - Define middleware with stateSchema
 *   - Call createAgent with tools, middleware, responseFormat
 *   - All using zod@3.25.x while langchain was built with zod@4.x
 *
 * tsc --noEmit must complete without TS2589 / OOM.
 */
import { z } from "zod/v3";
import {
  createAgent,
  createMiddleware,
  tool,
  toolStrategy,
  providerStrategy,
} from "langchain";

// ---------------------------------------------------------------
// 1. Define tools with various zod schemas
// ---------------------------------------------------------------
const searchTool = tool(
  async ({ query, maxResults }) => {
    const q: string = query;
    const m: number | undefined = maxResults;
    return `Results for: ${q} (max: ${m})`;
  },
  {
    name: "search",
    description: "Search for information",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z.number().optional().describe("Max results to return"),
    }),
  }
);

const writeFileTool = tool(
  async ({ filename, content, overwrite }) => {
    const f: string = filename;
    const c: string = content;
    const o: boolean = overwrite;
    return `Wrote ${c.length} chars to ${f}`;
  },
  {
    name: "write_file",
    description: "Write content to a file",
    schema: z.object({
      filename: z.string(),
      content: z.string(),
      overwrite: z.boolean().default(false),
    }),
  }
);

const memoryTool = tool(
  async ({ key, value, namespace }) => {
    return `Stored ${key}=${value} in ${namespace ?? "default"}`;
  },
  {
    name: "store_memory",
    description: "Store a key-value pair in memory",
    schema: z.object({
      key: z.string(),
      value: z.string(),
      namespace: z.string().optional(),
    }),
  }
);

const classifyTool = tool(
  async ({ text, categories }) => {
    const t: string = text;
    const cats: ("bug" | "feature" | "question")[] = categories;
    return `Classified "${t}" as ${cats.join(", ")}`;
  },
  {
    name: "classify",
    description: "Classify text into categories",
    schema: z.object({
      text: z.string(),
      categories: z.array(z.enum(["bug", "feature", "question"])),
    }),
  }
);

// Complex nested tool schema
const documentTool = tool(
  async ({ metadata, sections }) => {
    const author: string = metadata.author.name;
    const numSections: number = sections.length;
    return `Document by ${author} with ${numSections} sections`;
  },
  {
    name: "create_document",
    description: "Create a structured document",
    schema: z.object({
      metadata: z.object({
        title: z.string(),
        author: z.object({
          name: z.string(),
          email: z.string(),
          roles: z.array(z.enum(["admin", "editor", "viewer"])),
        }),
        tags: z.array(z.string()),
        version: z.number().default(1),
      }),
      sections: z.array(z.object({
        heading: z.string(),
        body: z.string(),
        subsections: z.array(z.object({
          title: z.string(),
          content: z.string(),
        })).optional(),
      })),
    }),
  }
);

// ---------------------------------------------------------------
// 2. Define middleware with stateSchema
// ---------------------------------------------------------------
const loggingMiddleware = createMiddleware({
  name: "logging",
  stateSchema: z.object({
    logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
    logEntries: z.array(z.string()).default([]),
  }),
  beforeAgent: async (state) => {
    const level: "debug" | "info" | "warn" | "error" = state.logLevel;
    const entries: string[] = state.logEntries;
    return { logEntries: [...entries, `Agent started at level ${level}`] };
  },
});

const rateLimitMiddleware = createMiddleware({
  name: "rate-limit",
  stateSchema: z.object({
    requestCount: z.number().default(0),
    maxRequests: z.number().default(100),
    windowStart: z.number().optional(),
  }),
  beforeModel: async (state) => {
    const count: number = state.requestCount;
    return { requestCount: count + 1 };
  },
});

// ---------------------------------------------------------------
// 3. createAgent — basic with tools
// ---------------------------------------------------------------
const basicAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, writeFileTool, memoryTool],
});

// ---------------------------------------------------------------
// 4. createAgent — with middleware
// ---------------------------------------------------------------
const agentWithMiddleware = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, classifyTool, documentTool],
  middleware: [loggingMiddleware, rateLimitMiddleware],
});

// ---------------------------------------------------------------
// 5. createAgent — with responseFormat (structured output)
// ---------------------------------------------------------------
const ContactInfo = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }).optional(),
});

const structuredAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool],
  responseFormat: ContactInfo,
});

// ---------------------------------------------------------------
// 6. createAgent — with complex responseFormat
// ---------------------------------------------------------------
const AnalysisResult = z.object({
  summary: z.string(),
  confidence: z.number(),
  findings: z.array(z.object({
    category: z.enum(["positive", "negative", "neutral"]),
    text: z.string(),
    score: z.number(),
  })),
  metadata: z.object({
    model: z.string(),
    processingTime: z.number(),
    tokenCount: z.number(),
  }),
});

const analysisAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [],
  responseFormat: AnalysisResult,
});

// ---------------------------------------------------------------
// 7. createAgent — with stateSchema
// ---------------------------------------------------------------
const agentWithState = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, memoryTool],
  stateSchema: z.object({
    userId: z.string().optional(),
    sessionData: z.record(z.string()).optional(),
    turnCount: z.number().default(0),
  }),
});

// ---------------------------------------------------------------
// 8. createAgent — kitchen sink (tools + middleware + state + response)
// ---------------------------------------------------------------
const fullAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, writeFileTool, memoryTool, classifyTool, documentTool],
  middleware: [loggingMiddleware, rateLimitMiddleware],
  responseFormat: AnalysisResult,
  stateSchema: z.object({
    context: z.string().optional(),
    iteration: z.number().default(0),
  }),
  name: "full-agent",
  description: "A comprehensive agent with all features",
});

// ---------------------------------------------------------------
// 9. toolStrategy / providerStrategy with zod schemas
// ---------------------------------------------------------------
const ts = toolStrategy(ContactInfo);
const ps = providerStrategy(AnalysisResult);

// ---------------------------------------------------------------
// 10. Multiple tools array (verify the const tuple inference)
// ---------------------------------------------------------------
const allTools = [
  searchTool,
  writeFileTool,
  memoryTool,
  classifyTool,
  documentTool,
] as const;

const agentFromConstTools = createAgent({
  model: "openai:gpt-4o",
  tools: [...allTools],
});

console.log("createAgent + zod-v3 type check passed");
