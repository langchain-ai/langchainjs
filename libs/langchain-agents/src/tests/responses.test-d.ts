import { describe, expectTypeOf, it } from "vitest";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { Tool } from "@langchain/core/tools";
import { z } from "zod";

import {
  createAgent,
  toolOutput,
  nativeOutput,
  stopWhenMaxSteps,
} from "../index.js";
import type { JsonSchemaFormat } from "../types.js";
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
    interface CreateReactAgentParameters {
      llm: LanguageModelLike;
      tools: Tool[];
      responseFormat: JsonSchemaFormat | JsonSchemaFormat[];
    }

    const createAgentParameters: CreateReactAgentParameters = {
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

    interface CreateReactAgentParametersWithZod {
      llm: LanguageModelLike;
      tools: Tool[];
      responseFormat: z.ZodSchema<{ capital: string }>;
    }

    const createAgentParametersWithZod: CreateReactAgentParametersWithZod = {
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
    interface CreateReactAgentParameters {
      llm: LanguageModelLike;
      tools: Tool[];
      responseFormat?: z.ZodSchema<{ capital: string }>;
    }

    const createAgentParameters: CreateReactAgentParameters = {
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
      experimental_stopWhen: [stopWhenMaxSteps(1)],
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
        // @ts-expect-error - arbitrary objects are not valid JSON schemas
        responseFormat: { type: "test" },
      });
    });
  });

  describe("using toolOutput", () => {
    it("should allow single zod schema", async () => {
      const toolOutputAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: toolOutput(z.object({ capital: z.string() })),
      });
      const toolOutputResult = await toolOutputAgent.invoke(prompt);
      expectTypeOf(toolOutputResult.structuredResponse).toEqualTypeOf<{
        capital: string;
      }>();
    });

    it("should allow multiple zod schemas", async () => {
      const toolOutputAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: toolOutput([
          z.object({ capital: z.string() }),
          z.object({ country: z.string() }),
        ]),
      });
      const toolOutputResult = await toolOutputAgent.invoke(prompt);
      expectTypeOf(toolOutputResult.structuredResponse).toEqualTypeOf<
        | {
            capital: string;
          }
        | { country: string }
      >();
    });

    it("should allow single json schema object", async () => {
      const toolOutputAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: toolOutput(jsonSchema),
      });
      const toolOutputResult = await toolOutputAgent.invoke(prompt);
      expectTypeOf(toolOutputResult.structuredResponse).toEqualTypeOf<
        Record<string, unknown>
      >();
    });

    it("should allow multiple json schema objects", async () => {
      const toolOutputAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: toolOutput([jsonSchema, jsonSchema]),
      });
      const toolOutputResult = await toolOutputAgent.invoke(prompt);
      expectTypeOf(toolOutputResult.structuredResponse).toEqualTypeOf<
        Record<string, unknown>
      >();
    });

    it("should NOT allow to pass in a tool output within an array", async () => {
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        // @ts-expect-error - validate error: only one schema is allowed for native outputs
        responseFormat: [toolOutput(jsonSchema)],
      });
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        // @ts-expect-error - validate error: only one schema is allowed for native outputs
        responseFormat: [toolOutput(jsonSchema), nativeOutput(jsonSchema)],
      });
    });
  });

  describe("using nativeOutput", () => {
    it("should allow single zod schema", async () => {
      const nativeOutputAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: nativeOutput(z.object({ capital: z.string() })),
      });
      const nativeOutputResult = await nativeOutputAgent.invoke(prompt);
      expectTypeOf(nativeOutputResult.structuredResponse).toEqualTypeOf<{
        capital: string;
      }>();
    });

    it("should NOT allow multiple zod schemas", async () => {
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        // @ts-expect-error - validate error: only one schema is allowed for native outputs
        responseFormat: nativeOutput([
          z.object({ capital: z.string() }),
          z.object({ country: z.string() }),
        ]),
      });
    });

    it("should allow single json schema object", async () => {
      const nativeOutputAgent = createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        responseFormat: nativeOutput(jsonSchema),
      });
      const nativeOutputResult = await nativeOutputAgent.invoke(prompt);
      expectTypeOf(nativeOutputResult.structuredResponse).toEqualTypeOf<
        Record<string, unknown>
      >();
    });

    it("should NOT allow multiple json schema objects", async () => {
      createAgent({
        llm: new FakeToolCallingChatModel({}),
        tools: [],
        // @ts-expect-error - validate error: only one schema is allowed for native outputs
        responseFormat: nativeOutput([jsonSchema, jsonSchema]),
      });
    });
  });
});
