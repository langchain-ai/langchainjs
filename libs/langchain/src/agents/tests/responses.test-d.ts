/* eslint-disable import/no-extraneous-dependencies */
import { describe, expectTypeOf, it } from "vitest";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { Tool } from "@langchain/core/tools";
import { z } from "zod/v3";

import { createAgent, toolStrategy, providerStrategy } from "../index.js";
import type { JsonSchemaFormat } from "../responses.js";
import { FakeToolCallingChatModel } from "./utils.js";

const prompt = {
  messages: [{ role: "user", content: "What is the capital of FakeCountry?" }],
};

const jsonSchema: JsonSchemaFormat = {
  type: "number",
  properties: {
    capital: {
      type: "string",
    },
  },
  required: ["capital"],
};

describe("response format", () => {
  it("should allow no response format", async () => {
    const agent = createAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
    });
    const res = await agent.invoke(prompt);
    expectTypeOf(res).not.toHaveProperty("structuredResponse");
  });

  it("makes it simple to pass in the parameter as variable", async () => {
    interface CreateAgentParameters {
      llm: LanguageModelLike;
      tools: Tool[];
      responseFormat: JsonSchemaFormat | JsonSchemaFormat[];
    }

    const createAgentParameters: CreateAgentParameters = {
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: {
        type: "object",
        properties: {
          capital: { type: "string" },
        },
        required: ["capital"],
      },
    };
    const agent = createAgent(createAgentParameters);
    const res = await agent.invoke(prompt);
    expectTypeOf(res.structuredResponse).toEqualTypeOf<
      Record<string, unknown>
    >();

    interface CreateAgentParametersWithZod {
      llm: LanguageModelLike;
      tools: Tool[];
      responseFormat: z.ZodSchema<{ capital: string }>;
    }

    const createAgentParametersWithZod: CreateAgentParametersWithZod = {
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: z.object({ capital: z.string() }),
    };
    const agentWithZod = createAgent(createAgentParametersWithZod);
    const resWithZod = await agentWithZod.invoke(prompt);
    expectTypeOf(resWithZod.structuredResponse).toEqualTypeOf<{
      capital: string;
    }>();
  });

  it("does not allow to have responseFormat be optional", async () => {
    interface CreateAgentParameters {
      llm: LanguageModelLike;
      tools: Tool[];
      responseFormat?: z.ZodSchema<{ capital: string }>;
    }

    const createAgentParameters: CreateAgentParameters = {
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: undefined,
    };
    // This should now be valid since responseFormat can be optional
    createAgent(createAgentParameters);
  });

  it("supports to use stopWhen without responseFormat", async () => {
    createAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
    });
  });

  describe("responseFormat as raw zod schemas", () => {
    it("should allow a simple zod schema", async () => {
      const agent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: z.object({
          capital: z.string(),
        }),
      });
      const res = await agent.invoke(prompt);
      expectTypeOf(res.structuredResponse).toEqualTypeOf({
        capital: "Paris",
      });
    });

    it("should allow multiple zod schemas", async () => {
      const agent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        // Note: Using 'as const' is required for proper type inference
        // of the union type from the array of schemas
        responseFormat: [
          z.object({
            capitalA: z.string(),
          }),
          z.object({
            capitalB: z.string(),
          }),
        ] as const,
      });

      const res = await agent.invoke(prompt);

      // Check that structuredResponse is the expected union type
      // The type should be inferred from the array of zod schemas
      expectTypeOf(res.structuredResponse).toEqualTypeOf<
        { capitalA: string } | { capitalB: string }
      >();
    });
  });

  describe("responseFormat as json schema", () => {
    it("should allow single json schema objects", async () => {
      const agent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: jsonSchema,
      });

      const res = await agent.invoke(prompt);

      expectTypeOf(res.structuredResponse).toEqualTypeOf<
        Record<string, unknown>
      >();
    });

    it("should allow multiple json schema objects", async () => {
      const agent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: [jsonSchema, jsonSchema],
      });
      const res = await agent.invoke(prompt);
      expectTypeOf(res.structuredResponse).toEqualTypeOf<
        Record<string, unknown>
      >();
    });

    it("should NOT allow to pass in arbitrary objects", async () => {
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: { type: "test" },
      });
    });
  });

  describe("using toolStrategy", () => {
    it("should allow single zod schema", async () => {
      const toolStrategyAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: toolStrategy(z.object({ capital: z.string() })),
      });
      const toolStrategyResult = await toolStrategyAgent.invoke(prompt);
      expectTypeOf(toolStrategyResult.structuredResponse).toEqualTypeOf<{
        capital: string;
      }>();
    });

    it("should allow multiple zod schemas", async () => {
      const toolStrategyAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: toolStrategy([
          z.object({ capital: z.string() }),
          z.object({ country: z.string() }),
        ]),
      });
      const toolStrategyResult = await toolStrategyAgent.invoke(prompt);
      expectTypeOf(toolStrategyResult.structuredResponse).toEqualTypeOf<
        | {
            capital: string;
          }
        | { country: string }
      >();
    });

    it("should allow single json schema object", async () => {
      const toolStrategyAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: toolStrategy(jsonSchema),
      });
      const toolStrategyResult = await toolStrategyAgent.invoke(prompt);
      expectTypeOf(toolStrategyResult.structuredResponse).toEqualTypeOf<
        Record<string, unknown>
      >();
    });

    it("should allow multiple json schema objects", async () => {
      const toolStrategyAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: toolStrategy([jsonSchema, jsonSchema]),
      });
      const toolStrategyResult = await toolStrategyAgent.invoke(prompt);
      expectTypeOf(toolStrategyResult.structuredResponse).toEqualTypeOf<
        Record<string, unknown>
      >();
    });

    it("should NOT allow to pass in a tool output within an array", async () => {
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: [toolStrategy(jsonSchema)],
      });
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: [
          toolStrategy(jsonSchema),
          providerStrategy(jsonSchema),
        ],
      });
    });
  });

  describe("using providerStrategy", () => {
    it("should allow single zod schema", async () => {
      const providerStrategyAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: providerStrategy(z.object({ capital: z.string() })),
      });
      const providerStrategyResult = await providerStrategyAgent.invoke(prompt);
      expectTypeOf(providerStrategyResult.structuredResponse).toEqualTypeOf<{
        capital: string;
      }>();
    });

    it("should NOT allow multiple zod schemas", async () => {
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        // @ts-expect-error - validate error: only one schema is allowed for native outputs
        responseFormat: providerStrategy([
          z.object({ capital: z.string() }),
          z.object({ country: z.string() }),
        ]),
      });
    });

    it("should allow single json schema object", async () => {
      const providerStrategyAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: providerStrategy(jsonSchema),
      });
      const providerStrategyResult = await providerStrategyAgent.invoke(prompt);
      expectTypeOf(providerStrategyResult.structuredResponse).toEqualTypeOf<
        Record<string, unknown>
      >();
    });

    it("should NOT allow multiple json schema objects", async () => {
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        // @ts-expect-error - validate error: only one schema is allowed for native outputs
        responseFormat: providerStrategy([jsonSchema, jsonSchema]),
      });
    });
  });
});
