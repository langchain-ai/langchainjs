/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod";
import { StateSchema, ReducedValue } from "@langchain/langgraph";

import { createAgentState } from "../annotation.js";

/**
 * Helper to extract the field keys from a StateSchema instance.
 */
function getFieldKeys(schema: StateSchema<any>): string[] {
  return Object.keys(schema.fields);
}

describe("createAgentState", () => {
  describe("basic fields", () => {
    it("should always include messages and jumpTo in state", () => {
      const { state } = createAgentState(false, undefined, []);
      const stateKeys = getFieldKeys(state);
      expect(stateKeys).toContain("messages");
      expect(stateKeys).toContain("jumpTo");
    });

    it("should include structuredResponse in output when hasStructuredResponse is true", () => {
      const { output } = createAgentState(true, undefined, []);
      const outputKeys = getFieldKeys(output);
      expect(outputKeys).toContain("structuredResponse");
    });

    it("should not include structuredResponse in output when hasStructuredResponse is false", () => {
      const { output } = createAgentState(false, undefined, []);
      const outputKeys = getFieldKeys(output);
      expect(outputKeys).not.toContain("structuredResponse");
    });
  });

  describe("user-provided Zod stateSchema", () => {
    it("should add public fields to state, input, and output", () => {
      const schema = z.object({
        userId: z.string(),
        count: z.number(),
      });

      const { state, input, output } = createAgentState(false, schema, []);

      expect(getFieldKeys(state)).toContain("userId");
      expect(getFieldKeys(state)).toContain("count");
      expect(getFieldKeys(input)).toContain("userId");
      expect(getFieldKeys(input)).toContain("count");
      expect(getFieldKeys(output)).toContain("userId");
      expect(getFieldKeys(output)).toContain("count");
    });
  });

  describe("user-provided StateSchema", () => {
    it("should add public fields to state, input, and output", () => {
      const schema = new StateSchema({
        userId: z.string(),
        count: z.number(),
      });

      const { state, input, output } = createAgentState(false, schema, []);

      expect(getFieldKeys(state)).toContain("userId");
      expect(getFieldKeys(state)).toContain("count");
      expect(getFieldKeys(input)).toContain("userId");
      expect(getFieldKeys(input)).toContain("count");
      expect(getFieldKeys(output)).toContain("userId");
      expect(getFieldKeys(output)).toContain("count");
    });

    it("should add ReducedValue fields to state and extract schemas for input/output", () => {
      const schema = new StateSchema({
        history: new ReducedValue(
          z.array(z.string()).default(() => []),
          {
            inputSchema: z.string(),
            reducer: (current, next) => [...current, next],
          }
        ),
      });

      const { state, input, output } = createAgentState(false, schema, []);

      expect(getFieldKeys(state)).toContain("history");
      expect(getFieldKeys(input)).toContain("history");
      expect(getFieldKeys(output)).toContain("history");

      // State should have the ReducedValue instance
      expect(ReducedValue.isInstance(state.fields.history)).toBe(true);
    });
  });

  describe("underscore-prefixed private state fields", () => {
    it("should include Zod _prefixed fields in state but not in input/output", () => {
      const schema = z.object({
        _privateEvent: z.string().optional(),
        _privateSessionId: z.string().optional(),
        publicField: z.string(),
      });

      const { state, input, output } = createAgentState(false, schema, []);

      // Private fields MUST be in graph state for persistence
      expect(getFieldKeys(state)).toContain("_privateEvent");
      expect(getFieldKeys(state)).toContain("_privateSessionId");

      // Private fields must NOT be in input/output
      expect(getFieldKeys(input)).not.toContain("_privateEvent");
      expect(getFieldKeys(input)).not.toContain("_privateSessionId");
      expect(getFieldKeys(output)).not.toContain("_privateEvent");
      expect(getFieldKeys(output)).not.toContain("_privateSessionId");

      // Public field should still be in all three
      expect(getFieldKeys(state)).toContain("publicField");
      expect(getFieldKeys(input)).toContain("publicField");
      expect(getFieldKeys(output)).toContain("publicField");
    });

    it("should include StateSchema _prefixed fields in state but not in input/output", () => {
      const schema = new StateSchema({
        _privateEvent: z.any().optional(),
        _privateSessionId: z.string().optional(),
        publicField: z.string(),
      } as any);

      const { state, input, output } = createAgentState(false, schema, []);

      // Private fields MUST be in graph state for persistence
      expect(getFieldKeys(state)).toContain("_privateEvent");
      expect(getFieldKeys(state)).toContain("_privateSessionId");

      // Private fields must NOT be in input/output
      expect(getFieldKeys(input)).not.toContain("_privateEvent");
      expect(getFieldKeys(input)).not.toContain("_privateSessionId");
      expect(getFieldKeys(output)).not.toContain("_privateEvent");
      expect(getFieldKeys(output)).not.toContain("_privateSessionId");

      // Public field should still be in all three
      expect(getFieldKeys(state)).toContain("publicField");
      expect(getFieldKeys(input)).toContain("publicField");
      expect(getFieldKeys(output)).toContain("publicField");
    });

    it("should include StateSchema _prefixed ReducedValue fields in state but not in input/output", () => {
      const schema = new StateSchema({
        _privateAccum: new ReducedValue(
          z.array(z.string()).default(() => []),
          {
            inputSchema: z.string(),
            reducer: (current, next) => [...current, next],
          }
        ),
        publicHistory: new ReducedValue(
          z.array(z.string()).default(() => []),
          {
            inputSchema: z.string(),
            reducer: (current, next) => [...current, next],
          }
        ),
      });

      const { state, input, output } = createAgentState(false, schema, []);

      // Private ReducedValue MUST be in state
      expect(getFieldKeys(state)).toContain("_privateAccum");
      expect(ReducedValue.isInstance(state.fields._privateAccum)).toBe(true);

      // Private ReducedValue must NOT be in input/output
      expect(getFieldKeys(input)).not.toContain("_privateAccum");
      expect(getFieldKeys(output)).not.toContain("_privateAccum");

      // Public ReducedValue should be in all three
      expect(getFieldKeys(state)).toContain("publicHistory");
      expect(getFieldKeys(input)).toContain("publicHistory");
      expect(getFieldKeys(output)).toContain("publicHistory");
    });
  });

  describe("middleware stateSchema with private fields", () => {
    it("should include middleware Zod _prefixed fields in state but not in input/output", () => {
      const middlewareSchema = z.object({
        _summarizationEvent: z.any().optional(),
        _summarizationSessionId: z.string().optional(),
      });

      const middleware = [
        {
          name: "SummarizationMiddleware",
          stateSchema: middlewareSchema,
          wrapModelCall: async (req: any, handler: any) => handler(req),
        },
      ] as any;

      const { state, input, output } = createAgentState(
        false,
        undefined,
        middleware
      );

      // Private middleware fields MUST be in graph state
      expect(getFieldKeys(state)).toContain("_summarizationEvent");
      expect(getFieldKeys(state)).toContain("_summarizationSessionId");

      // Private middleware fields must NOT be in input/output
      expect(getFieldKeys(input)).not.toContain("_summarizationEvent");
      expect(getFieldKeys(input)).not.toContain("_summarizationSessionId");
      expect(getFieldKeys(output)).not.toContain("_summarizationEvent");
      expect(getFieldKeys(output)).not.toContain("_summarizationSessionId");
    });

    it("should include middleware StateSchema _prefixed fields in state but not in input/output", () => {
      const middlewareSchema = new StateSchema({
        _internalCounter: z.number().default(0),
        visibleStatus: z.string().optional(),
      });

      const middleware = [
        {
          name: "TestMiddleware",
          stateSchema: middlewareSchema,
          beforeModel: () => ({}),
        },
      ] as any;

      const { state, input, output } = createAgentState(
        false,
        undefined,
        middleware
      );

      // Private field in state only
      expect(getFieldKeys(state)).toContain("_internalCounter");
      expect(getFieldKeys(input)).not.toContain("_internalCounter");
      expect(getFieldKeys(output)).not.toContain("_internalCounter");

      // Public field everywhere
      expect(getFieldKeys(state)).toContain("visibleStatus");
      expect(getFieldKeys(input)).toContain("visibleStatus");
      expect(getFieldKeys(output)).toContain("visibleStatus");
    });

    it("should combine user stateSchema and middleware private fields correctly", () => {
      const userSchema = z.object({
        userId: z.string(),
      });

      const middlewareSchema = z.object({
        _middlewarePrivate: z.any().optional(),
      });

      const middleware = [
        {
          name: "TestMiddleware",
          stateSchema: middlewareSchema,
          wrapModelCall: async (req: any, handler: any) => handler(req),
        },
      ] as any;

      const { state, input, output } = createAgentState(
        false,
        userSchema,
        middleware
      );

      // User field in all
      expect(getFieldKeys(state)).toContain("userId");
      expect(getFieldKeys(input)).toContain("userId");
      expect(getFieldKeys(output)).toContain("userId");

      // Middleware private field only in state
      expect(getFieldKeys(state)).toContain("_middlewarePrivate");
      expect(getFieldKeys(input)).not.toContain("_middlewarePrivate");
      expect(getFieldKeys(output)).not.toContain("_middlewarePrivate");
    });
  });

  describe("deduplication", () => {
    it("should not overwrite existing state fields with the same key", () => {
      const userSchema = z.object({
        sharedKey: z.string(),
      });

      const middlewareSchema = z.object({
        sharedKey: z.number(),
      });

      const middleware = [
        {
          name: "TestMiddleware",
          stateSchema: middlewareSchema,
          wrapModelCall: async (req: any, handler: any) => handler(req),
        },
      ] as any;

      const { state } = createAgentState(false, userSchema, middleware);

      // The user's schema should win (first applied)
      expect(getFieldKeys(state)).toContain("sharedKey");
    });
  });

  describe("Zod v4 schemas", () => {
    it("should include _prefixed Zod v4 fields in state but not in input/output", () => {
      const schema = z4.object({
        _privateState: z4.string().optional(),
        publicState: z4.string(),
      });

      const { state, input, output } = createAgentState(false, schema, []);

      // Private field in state only
      expect(getFieldKeys(state)).toContain("_privateState");
      expect(getFieldKeys(input)).not.toContain("_privateState");
      expect(getFieldKeys(output)).not.toContain("_privateState");

      // Public field everywhere
      expect(getFieldKeys(state)).toContain("publicState");
      expect(getFieldKeys(input)).toContain("publicState");
      expect(getFieldKeys(output)).toContain("publicState");
    });
  });
});
