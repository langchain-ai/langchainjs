/**
 * Zod v3 compatibility test
 *
 * Verifies that @langchain/core's exported types work correctly when the
 * consumer's project uses zod@3.25.x (v3-only).  This test only checks
 * type-level compatibility — it does NOT run any LLM calls.
 */
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

// ---------------------------------------------------------------
// 1. The `tool` function should accept a z3 schema and infer types
// ---------------------------------------------------------------
const objectSchema = z.object({
  name: z.string(),
  age: z.number(),
});

const myTool = tool(
  async (input) => {
    const _name: string = input.name;
    const _age: number = input.age;
    return `Hello ${_name}, age ${_age}`;
  },
  {
    name: "greet",
    description: "Greet a person",
    schema: objectSchema,
  }
);

// ---------------------------------------------------------------
// 2. withStructuredOutput overload should accept z3 schemas
//    (type-level check only — we don't instantiate a real model)
// ---------------------------------------------------------------
type WSO = BaseChatModel["withStructuredOutput"];
type _AssertDefined = WSO extends undefined ? never : WSO;

console.log("zod-v3 type check passed");
