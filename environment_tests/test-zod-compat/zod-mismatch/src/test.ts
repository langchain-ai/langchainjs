/**
 * Zod version mismatch test
 *
 * This is the critical regression test for the OOM bug.
 *
 * Simulates the real-world scenario where:
 *   - @langchain/core was built/published against zod@4.x
 *   - The consumer's project resolves zod@3.25.x (or vice versa)
 *   - TypeScript must check assignability between the consumer's zod
 *     types and @langchain/core's exported type signatures
 *
 * Before the fix, this caused OOM because @langchain/core's .d.ts files
 * directly referenced `z3.ZodType` / `z4.$ZodType`, forcing TypeScript into
 * deep structural comparison of ~3,400+ lines of mutually-recursive generics.
 *
 * After the fix, @langchain/core exports minimal structural duck-type
 * interfaces, so no deep comparison is needed.
 *
 * This test installs zod@3.25.x (v3-only) but consumes @langchain/core
 * which was built with zod@4.x in the monorepo.  `tsc --noEmit` must
 * complete without OOM and without errors.
 */
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

// ---------------------------------------------------------------
// 1. The `tool` function should work across the version boundary
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
// 2. Verify this doesn't OOM — the mere act of tsc completing is
//    the test.  If we get here, the fix works.
// ---------------------------------------------------------------
type WSO = BaseChatModel["withStructuredOutput"];
type _AssertDefined = WSO extends undefined ? never : WSO;

console.log("zod-mismatch type check passed (no OOM!)");
