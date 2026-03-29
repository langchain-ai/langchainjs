import { describe, it, expect } from "vitest";
import { z as z3 } from "zod/v3";
import { z as z4 } from "zod/v4";
import { StateSchema } from "@langchain/langgraph";
import { getInteropZodObjectShape } from "@langchain/core/utils/types";
import {
  initializeMiddlewareStates,
  derivePrivateState,
} from "../utils.js";
import type { AgentMiddleware } from "../../middleware/types.js";

const baseState = { messages: [] };

/**
 * Regression tests for https://github.com/langchain-ai/langchainjs/issues/10257
 *
 * `initializeMiddlewareStates` and `derivePrivateState` must work correctly
 * regardless of whether the user has zod v3 or v4 installed, since `langchain`
 * declares `"zod": "^3.25.76 || ^4"` as a dependency and node module resolution
 * may resolve `import { z } from "zod"` to the user's installed version.
 */
describe("initializeMiddlewareStates", () => {
  it("should work with a zod v3 stateSchema", async () => {
    const middleware: AgentMiddleware = {
      name: "test-middleware",
      stateSchema: z3.object({
        counter: z3.number().default(0),
      }),
    };

    const result = await initializeMiddlewareStates([middleware], baseState);
    expect(result).toEqual({ counter: 0 });
  });

  it("should work with a zod v4 stateSchema", async () => {
    const middleware: AgentMiddleware = {
      name: "test-middleware",
      stateSchema: z4.object({
        counter: z4.number().default(0),
      }),
    };

    const result = await initializeMiddlewareStates([middleware], baseState);
    expect(result).toEqual({ counter: 0 });
  });

  it("should skip middleware without stateSchema", async () => {
    const middleware: AgentMiddleware = { name: "no-schema-middleware" };
    const result = await initializeMiddlewareStates([middleware], baseState);
    expect(result).toEqual({});
  });

  it("should throw a descriptive error when required fields are missing", async () => {
    const middleware: AgentMiddleware = {
      name: "test-middleware",
      stateSchema: z3.object({
        requiredField: z3.string(),
      }),
    };

    await expect(
      initializeMiddlewareStates([middleware], baseState)
    ).rejects.toThrow(/requiredField/);
  });
});

describe("derivePrivateState", () => {
  it("should return a schema with built-in fields when no stateSchema given", () => {
    const schema = derivePrivateState();
    const shape = getInteropZodObjectShape(schema);
    expect(shape).toHaveProperty("messages");
  });

  it("should include private (underscore) fields from a zod v3 schema", () => {
    const stateSchema = z3.object({
      publicField: z3.string().default("pub"),
      _privateField: z3.string().default("priv"),
    });

    const schema = derivePrivateState(stateSchema);
    const shape = getInteropZodObjectShape(schema);
    expect(shape).toHaveProperty("_privateField");
    expect(shape).toHaveProperty("messages");
  });

  it("should include private (underscore) fields from a zod v4 schema", () => {
    const stateSchema = z4.object({
      publicField: z4.string().default("pub"),
      _privateField: z4.string().default("priv"),
    });

    const schema = derivePrivateState(stateSchema);
    const shape = getInteropZodObjectShape(schema);
    expect(shape).toHaveProperty("_privateField");
    expect(shape).toHaveProperty("messages");
  });

  it("should include private fields from StateSchema", () => {
    const stateSchema = new StateSchema({
      publicField: z4.string().default("pub"),
      _privateField: z4.string().default("priv"),
    });

    const schema = derivePrivateState(stateSchema);
    const shape = getInteropZodObjectShape(schema);
    expect(shape).toHaveProperty("_privateField");
    expect(shape).toHaveProperty("messages");
  });
});
