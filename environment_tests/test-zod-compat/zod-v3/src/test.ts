/**
 * Zod v3 compatibility test
 *
 * Simulates a consumer app using zod@3.25.x with @langchain/core and langchain.
 * tsc --noEmit must complete without OOM or type errors.
 */
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import {
  createAgent,
  createMiddleware,
  toolStrategy,
  providerStrategy,
} from "langchain";

// Tools
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
      maxResults: z.number().optional(),
    }),
  },
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
  },
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
  },
);

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
      sections: z.array(
        z.object({
          heading: z.string(),
          body: z.string(),
          subsections: z
            .array(
              z.object({
                title: z.string(),
                content: z.string(),
              }),
            )
            .optional(),
        }),
      ),
    }),
  },
);

// StructuredOutputParser
const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    name: z.string(),
    age: z.number(),
  }),
);

// Middleware
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

// Response format
const AnalysisResult = z.object({
  summary: z.string(),
  confidence: z.number(),
  findings: z.array(
    z.object({
      category: z.enum(["positive", "negative", "neutral"]),
      text: z.string(),
      score: z.number(),
    }),
  ),
});

// createAgent — basic
const basicAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, writeFileTool, classifyTool, documentTool],
});

// createAgent — with middleware
const agentWithMiddleware = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, classifyTool],
  middleware: [loggingMiddleware, rateLimitMiddleware],
});

// createAgent — with responseFormat
const structuredAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool],
  responseFormat: AnalysisResult,
});

// createAgent — with stateSchema
const agentWithState = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool],
  stateSchema: z.object({
    userId: z.string().optional(),
    turnCount: z.number().default(0),
  }),
});

// createAgent — kitchen sink
const fullAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, writeFileTool, classifyTool, documentTool],
  middleware: [loggingMiddleware, rateLimitMiddleware],
  responseFormat: AnalysisResult,
  stateSchema: z.object({
    context: z.string().optional(),
    iteration: z.number().default(0),
  }),
  name: "full-agent",
});

// toolStrategy / providerStrategy
const _ts = toolStrategy(AnalysisResult);
const _ps = providerStrategy(AnalysisResult);

console.log("zod-v3 type check passed");
