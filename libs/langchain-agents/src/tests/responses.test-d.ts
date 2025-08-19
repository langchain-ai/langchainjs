import { describe, expectTypeOf, it } from "vitest";
import {
  createReactAgent,
  asToolOutput,
  asNativeOutput,
  ToolOutput,
  NativeOutput,
} from "../index.js";
import { z } from "zod";
import { FakeToolCallingChatModel } from "./utils.js";

describe("response format", () => {
  it("should allow zod schemas", async () => {
    const agent = createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: z.object({
        capital: z.string(),
      }),
    });

    const agent2 = createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: [
        z.object({
          capitalA: z.string(),
        }),
        z.object({
          capitalB: z.string(),
        }),
      ],
    });

    const res2 = await agent2.invoke({
      messages: [
        { role: "user", content: "What is the capital of FakeCountry?" },
      ],
    });
    expectTypeOf(res2.structuredResponse).toEqualTypeOf<
      Record<string, unknown>
    >();

    const res = await agent.invoke({
      messages: [
        { role: "user", content: "What is the capital of FakeCountry?" },
      ],
    });

    expectTypeOf(res.structuredResponse).toEqualTypeOf({
      capital: "Paris",
    });
  });

  it("should allow native objects", async () => {
    const agent = createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: {
        type: "json_schema",
        properties: {
          capital: {
            type: "string",
          },
        },
        required: ["capital"],
      },
    });

    const res = await agent.invoke({
      messages: [
        { role: "user", content: "What is the capital of FakeCountry?" },
      ],
    });

    expectTypeOf(res.structuredResponse).toEqualTypeOf<
      Record<string, unknown>
    >();
  });

  it("should allow (multiple) tool outputs", async () => {
    createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: asToolOutput(z.object({ capital: z.string() })),
    });
    createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: ToolOutput.fromSchema(z.object({ capital: z.string() })),
    });
    createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: asToolOutput([
        z.object({ capital: z.string() }),
        z.object({ capital: z.string() }),
      ]),
    });
    createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: asToolOutput([
        ToolOutput.fromSchema(z.object({ capital: z.string() })),
        ToolOutput.fromSchema(z.object({ capital: z.string() })),
      ]),
    });
  });

  it("should allow native outputs", async () => {
    createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: asNativeOutput(z.object({ capital: z.string() })),
    });
    createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      responseFormat: NativeOutput.fromSchema(
        z.object({ capital: z.string() })
      ),
    });
    createReactAgent({
      llm: new FakeToolCallingChatModel({}),
      tools: [],
      // @ts-expect-error - validate error: only one schema is allowed for native outputs
      responseFormat: asNativeOutput([
        z.object({ capital: z.string() }),
        z.object({ capital: z.string() }),
      ]),
    });
  });
});
