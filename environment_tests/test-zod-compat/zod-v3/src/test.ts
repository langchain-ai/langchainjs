/**
 * Zod v3 compatibility test
 *
 * Verifies that @langchain/core's exported types work correctly when the
 * consumer's project uses zod@3.25.x (v3-only).  This test only checks
 * type-level compatibility — it does NOT run any LLM calls.
 */
import { z } from "zod/v3";
import { tool, StructuredTool } from "@langchain/core/tools";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type {
  InteropZodType,
  InferInteropZodOutput,
  ZodV3Like,
  ZodV3ObjectLike,
  InteropZodObject,
} from "@langchain/core/utils/types";

// ---------------------------------------------------------------
// 1. Simple tool with z3 object schema — verify type inference
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
// 2. Tool with nested z3 schema
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
// 3. Tool with z3 string schema (non-object)
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
// 4. Tool with z3 enum schema
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
// 6. StructuredOutputParser with z3 schema
// ---------------------------------------------------------------
const parser = StructuredOutputParser.fromZodSchema(personSchema);

// ---------------------------------------------------------------
// 7. withStructuredOutput type-level check
// ---------------------------------------------------------------
type WSO = BaseChatModel["withStructuredOutput"];
type _AssertWSO = WSO extends undefined ? never : WSO;

// ---------------------------------------------------------------
// 8. InteropZodType assignability — z3 schemas should be assignable
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

type StringOutput = InferInteropZodOutput<typeof z.string>;

// ---------------------------------------------------------------
// 10. ZodV3Like assignability
// ---------------------------------------------------------------
const _v3String: ZodV3Like<string> = z.string();
const _v3Object: ZodV3Like = personSchema;

// ---------------------------------------------------------------
// 11. ZodV3ObjectLike / InteropZodObject assignability
// ---------------------------------------------------------------
const _v3Obj: ZodV3ObjectLike = personSchema;
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
    metadata: z.record(z.string()),
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

console.log("zod-v3 type check passed");
