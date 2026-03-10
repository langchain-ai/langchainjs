/**
 * Zod version mismatch test — critical OOM regression test.
 *
 * This test simulates the real-world scenario from the original issue:
 *   - @langchain/core was built/published against zod@4.x
 *   - The consumer's project resolves zod@3.25.x
 *   - TypeScript must check assignability across the version boundary
 *
 * Before the fix, this caused TS2589 / OOM because @langchain/core's
 * .d.ts files referenced real zod types, forcing deep structural comparison
 * of ~3,400+ lines of mutually-recursive generics.
 *
 * The test mirrors a real-world app that:
 *   1. Defines tools with zod schemas
 *   2. Creates middleware with state schemas
 *   3. Passes everything to createAgent-style APIs
 *   4. Uses withStructuredOutput for structured responses
 *
 * tsc --noEmit must complete without OOM (512MB limit, 120s timeout).
 */
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type {
  InteropZodType,
  InferInteropZodOutput,
  ZodV3Like,
  ZodV3ObjectLike,
  InteropZodObject,
} from "@langchain/core/utils/types";
import {
  createAgent,
  createMiddleware,
  toolStrategy,
  providerStrategy,
} from "langchain";

// ---------------------------------------------------------------
// 1. Define multiple tools with schemas (like a real agent app)
// ---------------------------------------------------------------
const searchSchema = z.object({
  query: z.string(),
  maxResults: z.number().optional(),
  filters: z.object({
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
    categories: z.array(z.string()).optional(),
  }).optional(),
});

const searchTool = tool(
  async (input) => {
    const query: string = input.query;
    const max: number | undefined = input.maxResults;
    return `Results for: ${query} (max: ${max})`;
  },
  {
    name: "search",
    description: "Search for documents",
    schema: searchSchema,
  }
);

const writeSchema = z.object({
  filename: z.string(),
  content: z.string(),
  encoding: z.enum(["utf-8", "ascii", "base64"]).optional(),
  overwrite: z.boolean().default(false),
});

const writeTool = tool(
  async (input) => {
    const file: string = input.filename;
    return `Wrote ${input.content.length} chars to ${file}`;
  },
  {
    name: "write_file",
    description: "Write content to a file",
    schema: writeSchema,
  }
);

const memorySchema = z.object({
  key: z.string(),
  value: z.string(),
  namespace: z.string().optional(),
  ttl: z.number().optional(),
});

const memoryTool = tool(
  async (input) => {
    return `Stored ${input.key}=${input.value}`;
  },
  {
    name: "store_memory",
    description: "Store a value in memory",
    schema: memorySchema,
  }
);

// ---------------------------------------------------------------
// 2. Collect tools in an array (like createAgent({ tools: [...] }))
// ---------------------------------------------------------------
const allTools = [searchTool, writeTool, memoryTool];

// ---------------------------------------------------------------
// 3. Define state schema (like createAgent({ stateSchema: ... }))
// ---------------------------------------------------------------
const stateSchema = z.object({
  messages: z.array(z.unknown()),
  context: z.string().optional(),
  iteration: z.number().default(0),
});
const _stateInterop: InteropZodObject = stateSchema;

// ---------------------------------------------------------------
// 4. Define response format schema
// ---------------------------------------------------------------
const responseSchema = z.object({
  answer: z.string(),
  confidence: z.number(),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string(),
    relevance: z.number(),
  })),
});

const _responseInterop: InteropZodType = responseSchema;
type ResponseOutput = InferInteropZodOutput<typeof responseSchema>;
const _response: ResponseOutput = {
  answer: "hello",
  confidence: 0.95,
  sources: [{ title: "t", url: "u", relevance: 0.9 }],
};

// ---------------------------------------------------------------
// 5. StructuredOutputParser across version boundary
// ---------------------------------------------------------------
const parser = StructuredOutputParser.fromZodSchema(responseSchema);

// ---------------------------------------------------------------
// 6. withStructuredOutput type-level check
// ---------------------------------------------------------------
type WSO = BaseChatModel["withStructuredOutput"];
type _AssertWSO = WSO extends undefined ? never : WSO;

// ---------------------------------------------------------------
// 7. Complex deeply-nested schema (stress test)
// ---------------------------------------------------------------
const complexSchema = z.object({
  metadata: z.object({
    created: z.string(),
    author: z.object({
      name: z.string(),
      email: z.string(),
      roles: z.array(z.enum(["admin", "editor", "viewer"])),
    }),
    tags: z.array(z.string()),
    version: z.number(),
  }),
  content: z.object({
    sections: z.array(z.object({
      title: z.string(),
      body: z.string(),
      subsections: z.array(z.object({
        heading: z.string(),
        paragraphs: z.array(z.string()),
      })).optional(),
    })),
    references: z.record(z.object({
      url: z.string(),
      title: z.string(),
    })),
  }),
  settings: z.object({
    language: z.enum(["en", "es", "fr", "de", "ja"]),
    format: z.enum(["markdown", "html", "plain"]),
    options: z.record(z.union([z.string(), z.number(), z.boolean()])),
  }),
});

const complexTool = tool(
  async (input) => {
    const author: string = input.metadata.author.name;
    const roles = input.metadata.author.roles;
    const section = input.content.sections[0];
    const lang: "en" | "es" | "fr" | "de" | "ja" = input.settings.language;
    return `${author} (${roles.join(",")}) wrote ${section.title} in ${lang}`;
  },
  {
    name: "process_document",
    description: "Process a complex document",
    schema: complexSchema,
  }
);

// ---------------------------------------------------------------
// 8. Multiple InteropZodType assignments (exercises the union)
// ---------------------------------------------------------------
const schemas: InteropZodType[] = [
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.object({ x: z.number() }),
  z.enum(["a", "b"]),
  z.union([z.string(), z.number()]),
  z.literal("test"),
  z.string().optional(),
  z.string().nullable(),
  z.record(z.string()),
  z.tuple([z.string(), z.number()]),
];

// ---------------------------------------------------------------
// 9. ZodV3Like / ZodV3ObjectLike assignability across boundary
// ---------------------------------------------------------------
const _v3Like: ZodV3Like = z.string();
const _v3Obj: ZodV3ObjectLike = stateSchema;
const _v3Person: ZodV3Like<{ name: string; age: number }> = z.object({
  name: z.string(),
  age: z.number(),
});

// ---------------------------------------------------------------
// 10. createMiddleware with stateSchema (across version boundary)
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
// 11. createAgent — basic with tools
// ---------------------------------------------------------------
const basicAgent = createAgent({
  model: "openai:gpt-4o",
  tools: allTools,
});

// ---------------------------------------------------------------
// 12. createAgent — with middleware
// ---------------------------------------------------------------
const agentWithMiddleware = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, writeTool],
  middleware: [loggingMiddleware, rateLimitMiddleware],
});

// ---------------------------------------------------------------
// 13. createAgent — with responseFormat
// ---------------------------------------------------------------
const structuredAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool],
  responseFormat: responseSchema,
});

// ---------------------------------------------------------------
// 14. createAgent — with stateSchema
// ---------------------------------------------------------------
const agentWithState = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool],
  stateSchema: z.object({
    userId: z.string().optional(),
    sessionData: z.record(z.string()).optional(),
    turnCount: z.number().default(0),
  }),
});

// ---------------------------------------------------------------
// 15. createAgent — kitchen sink (all features, cross-version boundary)
// ---------------------------------------------------------------
const fullAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool, writeTool, memoryTool, complexTool],
  middleware: [loggingMiddleware, rateLimitMiddleware],
  responseFormat: responseSchema,
  stateSchema: z.object({
    context: z.string().optional(),
    iteration: z.number().default(0),
  }),
  name: "full-agent",
  description: "A comprehensive agent with all features",
});

// ---------------------------------------------------------------
// 16. toolStrategy / providerStrategy across version boundary
// ---------------------------------------------------------------
const _ts = toolStrategy(responseSchema);
const _ps = providerStrategy(searchSchema);

console.log("zod-mismatch type check passed (no OOM!)");
