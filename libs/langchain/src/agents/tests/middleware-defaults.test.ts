/**
 * Tests for agent middleware state schemas with default values.
 *
 * These tests verify that fields with `withLangGraph` defaults are correctly:
 * 1. Treated as optional in TypeScript types (no type errors when omitted)
 * 2. Given their default values at runtime when omitted from invoke()
 * 3. Still accept explicitly provided values
 */
import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { withLangGraph } from "@langchain/langgraph/zod";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { createAgent } from "../index.js";
import { createMiddleware } from "../middleware.js";
import { FakeToolCallingChatModel } from "./utils.js";

describe("Middleware state with withLangGraph defaults", () => {
  it("should make fields with withLangGraph defaults optional in invoke parameter", async () => {
    // Create middleware with a field that has a default
    const middlewareWithDefaults = createMiddleware({
      name: "TestMiddleware",
      stateSchema: z.object({
        fieldWithDefault: withLangGraph(z.string(), {
          default: () => "default-value",
        }),
      }),
    });

    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage({ id: "0", content: "Response" })],
    });

    const agent = createAgent({
      model: llm,
      middleware: [middlewareWithDefaults],
    });

    // This should NOT have a type error - fieldWithDefault should be optional
    // because it has a default value
    const result1 = await agent.invoke({
      messages: [new HumanMessage("test")],
      // fieldWithDefault is omitted - should be OK due to default
    });

    // Verify the default value was applied
    expect(result1.fieldWithDefault).toBe("default-value");

    // This should also work when providing the field
    const result2 = await agent.invoke({
      messages: [new HumanMessage("test")],
      fieldWithDefault: "custom-value",
    });

    // Verify the custom value was used
    expect(result2.fieldWithDefault).toBe("custom-value");
  });

  it("should make fields with withLangGraph reducer defaults optional in invoke parameter", async () => {
    // Create middleware like the text editor middleware
    const middlewareWithReducerDefaults = createMiddleware({
      name: "TestMiddleware",
      stateSchema: z.object({
        fieldWithDefault: withLangGraph(z.string(), {
          reducer: {
            fn: (_left: string, right: string) => right,
          },
          default: () => "default value",
        }),
      }),
    });

    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage({ id: "0", content: "Response" })],
    });

    const agent = createAgent({
      model: llm,
      middleware: [middlewareWithReducerDefaults],
    });

    // This should NOT have a type error - fieldWithDefault should be optional
    const result1 = await agent.invoke({
      messages: [new HumanMessage("test")],
      // fieldWithDefault is omitted - should be OK due to default
    });

    // Verify the default value was applied
    expect(result1.fieldWithDefault).toEqual("default value");

    // This should also work when providing the field
    const result2 = await agent.invoke({
      messages: [new HumanMessage("test")],
      fieldWithDefault: "nondefault value",
    });

    // Verify the custom value was used
    expect(result2.fieldWithDefault).toEqual("nondefault value");
  });

  it("should require fields without defaults in invoke parameter", async () => {
    // Create middleware with a required field (no default)
    const middlewareWithRequired = createMiddleware({
      name: "TestMiddleware",
      stateSchema: z.object({
        requiredField: z.string(),
      }),
    });

    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage({ id: "0", content: "Response" })],
    });

    const agent = createAgent({
      model: llm,
      middleware: [middlewareWithRequired],
    });

    await expect(
      // @ts-expect-error - requiredField should be required
      agent.invoke({
        messages: [new HumanMessage("test")],
        // requiredField is omitted - should be a type error AND runtime error
      })
    ).rejects.toThrow(/required/i);

    // This should work when providing the field
    const result = await agent.invoke({
      messages: [new HumanMessage("test")],
      requiredField: "value",
    });

    // Verify the provided value was used
    expect(result.requiredField).toBe("value");
  });

  it("should make fields optional when passed directly via stateSchema", async () => {
    // When stateSchema is passed directly (not via middleware), it should work the same way
    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage({ id: "0", content: "Response" })],
    });

    const agent = createAgent({
      model: llm,
      stateSchema: z.object({
        fieldWithDefault: withLangGraph(z.string(), {
          default: () => "default-value",
        }),
      }),
    });

    // This should NOT have a type error
    const result = await agent.invoke({
      messages: [new HumanMessage("test")],
      // fieldWithDefault is omitted - should be OK due to default
    });

    // Field should NOT appear in output since no node updated it
    // (LangGraph only applies defaults when a field is actually written to)
    expect(result.fieldWithDefault).toBeUndefined();
    expect(result.messages).toBeDefined();
  });

  it("should make fields with reducer optional when passed directly via stateSchema", async () => {
    // When stateSchema is passed directly (not via middleware), it should work the same way
    const llm = new FakeToolCallingChatModel({
      responses: [new AIMessage({ id: "0", content: "Response" })],
    });

    const agent = createAgent({
      model: llm,
      stateSchema: z.object({
        fieldWithDefault: withLangGraph(z.string(), {
          reducer: {
            fn: (_left: string, right: string) => right,
          },
          default: () => "default-value",
        }),
      }),
    });

    // This should NOT have a type error
    const result = await agent.invoke({
      messages: [new HumanMessage("test")],
      // fieldWithDefault is omitted - should be OK due to default
    });

    // Field should NOT appear in output since no node updated it
    // (LangGraph only applies defaults when a field is actually written to)
    expect(result.fieldWithDefault).toBeUndefined();
    expect(result.messages).toBeDefined();
  });
});
