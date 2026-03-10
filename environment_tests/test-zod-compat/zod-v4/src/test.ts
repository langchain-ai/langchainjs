/**
 * Zod v4 compatibility test
 *
 * Verifies that @langchain/core and langchain exported types work correctly
 * when the consumer's project uses zod@4.x.  This test only checks type-level
 * compatibility — it does NOT run any LLM calls.
 */
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type {
  InteropZodType,
  InferInteropZodOutput,
  ZodV4Like,
  ZodV4ObjectLike,
  InteropZodObject,
} from "@langchain/core/utils/types";
import {
  createAgent,
  createMiddleware,
  toolStrategy,
  providerStrategy,
} from "langchain";

// ---------------------------------------------------------------
// 1. Simple tool with z4 object schema — verify type inference
// ---------------------------------------------------------------
const personSchema = z.object({
  name: z.string(),
  age: z.number(),
});

const greetTool = tool(
  async (input) => {
    const name: string = input.name;
    const age: number = input.age;
    return `Hello ${name}, age ${age}`;
  },
  {
    name: "greet",
    description: "Greet a person",
    schema: personSchema,
  }
);

// ---------------------------------------------------------------
// 2. Tool with nested z4 schema
// ---------------------------------------------------------------
const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zip: z.string().optional(),
  country: z.string().default("US"),
});

const contactSchema = z.object({
  person: personSchema,
  address: addressSchema,
  tags: z.array(z.string()),
  notes: z.string().optional(),
});

const contactTool = tool(
  async (input) => {
    const street: string = input.address.street;
    const tags: string[] = input.tags;
    const notes: string | undefined = input.notes;
    return `Contact: ${input.person.name} at ${street}`;
  },
  {
    name: "create_contact",
    description: "Create a contact record",
    schema: contactSchema,
  }
);

// ---------------------------------------------------------------
// 3. Tool with z4 string schema (non-object)
// ---------------------------------------------------------------
const stringTool = tool(
  async (input) => {
    const s: string = input;
    return s.toUpperCase();
  },
  {
    name: "uppercase",
    description: "Convert to uppercase",
    schema: z.string(),
  }
);

// ---------------------------------------------------------------
// 4. Tool with z4 enum schema
// ---------------------------------------------------------------
const sentimentSchema = z.object({
  text: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});

const sentimentTool = tool(
  async (input) => {
    const sentiment: "positive" | "negative" | "neutral" = input.sentiment;
    return `${input.text} is ${sentiment}`;
  },
  {
    name: "classify_sentiment",
    description: "Classify text sentiment",
    schema: sentimentSchema,
  }
);

// ---------------------------------------------------------------
// 5. Multiple tools in an array (as used by createAgent)
// ---------------------------------------------------------------
const tools = [greetTool, contactTool, stringTool, sentimentTool];

// ---------------------------------------------------------------
// 6. StructuredOutputParser with z4 schema
// ---------------------------------------------------------------
const parser = StructuredOutputParser.fromZodSchema(personSchema);

// ---------------------------------------------------------------
// 7. withStructuredOutput type-level check
// ---------------------------------------------------------------
type WSO = BaseChatModel["withStructuredOutput"];
type _AssertWSO = WSO extends undefined ? never : WSO;

// ---------------------------------------------------------------
// 8. InteropZodType assignability — z4 schemas should be assignable
// ---------------------------------------------------------------
const _interopString: InteropZodType<string> = z.string();
const _interopObject: InteropZodType = personSchema;
const _interopArray: InteropZodType = z.array(z.string());
const _interopOptional: InteropZodType = z.string().optional();
const _interopNullable: InteropZodType = z.string().nullable();
const _interopEnum: InteropZodType = z.enum(["a", "b", "c"]);
const _interopUnion: InteropZodType = z.union([z.string(), z.number()]);
const _interopLiteral: InteropZodType = z.literal("hello");

// ---------------------------------------------------------------
// 9. InferInteropZodOutput — should correctly infer output types
// ---------------------------------------------------------------
type PersonOutput = InferInteropZodOutput<typeof personSchema>;
const _person: PersonOutput = { name: "Alice", age: 30 };

type ContactOutput = InferInteropZodOutput<typeof contactSchema>;
const _contact: ContactOutput = {
  person: { name: "Alice", age: 30 },
  address: { street: "123 Main", city: "SF", country: "US" },
  tags: ["friend"],
};

// ---------------------------------------------------------------
// 10. ZodV4Like assignability
// ---------------------------------------------------------------
const _v4String: ZodV4Like<string> = z.string();
const _v4Object: ZodV4Like = personSchema;

// ---------------------------------------------------------------
// 11. ZodV4ObjectLike / InteropZodObject assignability
// ---------------------------------------------------------------
const _v4Obj: ZodV4ObjectLike = personSchema;
const _interopObj: InteropZodObject = personSchema;

// ---------------------------------------------------------------
// 12. Schema with transforms/refinements (common in real usage)
// ---------------------------------------------------------------
const transformedSchema = z.object({
  input: z.string(),
  count: z.number().int().positive(),
});

const refinedTool = tool(
  async (input) => {
    const s: string = input.input;
    const n: number = input.count;
    return s.repeat(n);
  },
  {
    name: "repeat",
    description: "Repeat a string N times",
    schema: transformedSchema,
  }
);

// ---------------------------------------------------------------
// 13. Complex nested schema (stress test for type inference depth)
// ---------------------------------------------------------------
const deepSchema = z.object({
  level1: z.object({
    level2: z.object({
      level3: z.object({
        value: z.string(),
        numbers: z.array(z.number()),
      }),
      tags: z.array(z.enum(["a", "b", "c"])),
    }),
    metadata: z.record(z.string(), z.string()),
  }),
  items: z.array(z.object({
    id: z.number(),
    label: z.string(),
    active: z.boolean().optional(),
  })),
});

const deepTool = tool(
  async (input) => {
    const val: string = input.level1.level2.level3.value;
    const nums: number[] = input.level1.level2.level3.numbers;
    const id: number = input.items[0].id;
    return `${val}: ${nums.join(",")} (item ${id})`;
  },
  {
    name: "deep_tool",
    description: "Tool with deeply nested schema",
    schema: deepSchema,
  }
);

// ---------------------------------------------------------------
// 14. createMiddleware with stateSchema
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
// 15. createAgent — basic with tools
// ---------------------------------------------------------------
const basicAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [greetTool, contactTool, sentimentTool],
});

// ---------------------------------------------------------------
// 16. createAgent — with middleware
// ---------------------------------------------------------------
const agentWithMiddleware = createAgent({
  model: "openai:gpt-4o",
  tools: [greetTool, sentimentTool],
  middleware: [loggingMiddleware, rateLimitMiddleware],
});

// ---------------------------------------------------------------
// 17. createAgent — with responseFormat
// ---------------------------------------------------------------
const structuredAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [greetTool],
  responseFormat: contactSchema,
});

// ---------------------------------------------------------------
// 18. createAgent — with stateSchema
// ---------------------------------------------------------------
const agentWithState = createAgent({
  model: "openai:gpt-4o",
  tools: [greetTool],
  stateSchema: z.object({
    userId: z.string().optional(),
    sessionData: z.record(z.string(), z.string()).optional(),
    turnCount: z.number().default(0),
  }),
});

// ---------------------------------------------------------------
// 19. createAgent — kitchen sink
// ---------------------------------------------------------------
const fullAgent = createAgent({
  model: "openai:gpt-4o",
  tools: [greetTool, contactTool, stringTool, sentimentTool, refinedTool, deepTool],
  middleware: [loggingMiddleware, rateLimitMiddleware],
  responseFormat: personSchema,
  stateSchema: z.object({
    context: z.string().optional(),
    iteration: z.number().default(0),
  }),
  name: "full-agent",
  description: "A comprehensive agent with all features",
});

// ---------------------------------------------------------------
// 20. toolStrategy / providerStrategy
// ---------------------------------------------------------------
const _ts = toolStrategy(contactSchema);
const _ps = providerStrategy(personSchema);

console.log("zod-v4 type check passed");
