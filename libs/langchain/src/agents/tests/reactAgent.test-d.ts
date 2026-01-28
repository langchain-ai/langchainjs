import { z } from "zod/v3";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { describe, it, expectTypeOf } from "vitest";
import type { IterableReadableStream } from "@langchain/core/utils/stream";

import { type BuiltInState, createAgent, createMiddleware } from "../index.js";
import type { StreamOutputMap } from "@langchain/langgraph";

describe("reactAgent", () => {
  it("should throw an error if you try to pass in a function as a middleware", () => {
    const fakeMiddleware = function createFakeMiddleware() {
      return createMiddleware({
        name: "fake",
      });
    };
    createAgent({
      model: "openai:gpt-4",
      // @ts-expect-error fakeMiddleware is a function -> should be an instance of AgentMiddleware
      middleware: [fakeMiddleware],
    });
  });

  it("should require model as only required property", async () => {
    // Verify that passing only model is valid
    createAgent({ model: "openai:gpt-4" });

    // @ts-expect-error model is required
    createAgent({});

    // Verify model property type
    expectTypeOf<Parameters<typeof createAgent>[0]>()
      .toHaveProperty("model")
      .toEqualTypeOf<string | LanguageModelLike>();
  });

  it("should not require runnable config if context schema is not provided", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
    });
    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });
  });

  it("should allow a context schema that makes invoke calls require to pass in a context", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
      contextSchema: z.object({
        customRequiredContextProp: z.string(),
        customOptionalContextProp: z.string().default("default value"),
      }),
    });

    const state = {
      messages: [new HumanMessage("Hello, world!")],
    };
    await agent.invoke(state, {
      context: {
        customRequiredContextProp: "123",
      },
    });
    await agent.invoke(state, {
      context: {
        // @ts-expect-error defined as string
        customRequiredContextProp: 123,
      },
    });

    await agent.invoke(state, {
      context: {
        customRequiredContextProp: "123",
        // @ts-expect-error defined as string
        customOptionalContextProp: 456,
      },
    });
  });

  it("supports streaming", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
    });
    const stream = await agent.stream(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        encoding: "text/event-stream",
        streamMode: ["values", "updates", "messages"],
        configurable: {
          thread_id: "test-123",
        },
        recursionLimit: 10,
      }
    );
    expectTypeOf(stream).toEqualTypeOf<
      IterableReadableStream<
        StreamOutputMap<
          "values" | "updates" | "messages",
          false,
          Record<string, unknown>,
          Record<string, unknown>,
          string,
          unknown,
          unknown,
          "text/event-stream"
        >
      >
    >();

    for await (const chunk of stream) {
      expectTypeOf(chunk).toEqualTypeOf<Uint8Array>();
    }

    const multiModeStream = await agent.stream(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        streamMode: ["updates", "messages", "values"],
      }
    );

    for await (const chunk of multiModeStream) {
      const [mode, value] = chunk;
      expectTypeOf(mode).toEqualTypeOf<"updates" | "messages" | "values">();
      if (mode === "messages") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expectTypeOf(value).toEqualTypeOf<[BaseMessage, Record<string, any>]>();
      } else if (mode === "updates") {
        expectTypeOf(value).toExtend<
          Record<string, Omit<BuiltInState, "jumpTo">>
        >();
      } else {
        expectTypeOf(value.messages).toExtend<BaseMessage[]>();
      }
    }

    await agent.invoke(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        // @ts-expect-error encoding is not a valid property
        encoding: "text/event-stream",
        configurable: {
          thread_id: "test-123",
        },
        recursionLimit: 10,
      }
    );
    await agent.invoke(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        // @ts-expect-error encoding is not a valid property
        streamMode: ["values", "updates", "messages"],
        configurable: {
          thread_id: "test-123",
        },
        recursionLimit: 10,
      }
    );
  });

  it("should allow a state schema that makes invoke calls require to pass in a state", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
      stateSchema: z.object({
        foo: z.number(),
      }),
    });
    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
      foo: 123,
    });
    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
      // @ts-expect-error foo is a number
      foo: "bar",
    });
    // @ts-expect-error foo is required
    await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
    });
  });

  it("should allow a state schema that modifies the output type", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
      stateSchema: z.object({
        foo: z.number(),
      }),
    });
    const result = await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
      foo: 123,
    });
    expectTypeOf<typeof result>().toExtend<{
      messages: BaseMessage[];
      foo: number;
    }>();
    expectTypeOf<typeof result>().not.toHaveProperty("bar");
  });

  it("should omit extra properties from invoke params when no state schema is provided", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
    });
    const result = await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
      // @ts-expect-error foo is not a valid property
      foo: 123,
    });
    expectTypeOf<typeof result>().toExtend<{
      messages: BaseMessage[];
    }>();
    expectTypeOf<typeof result>().not.toHaveProperty("foo");
  });

  describe("input types", () => {
    it("default", async () => {
      const agent = createAgent({
        model: "openai:gpt-4",
      });

      // invoke
      await agent.invoke({
        messages: [{ role: "user", content: "Hello, world!" }],
      });
      await agent.invoke({
        messages: ["Hello, world!"],
      });
      await agent.invoke({
        messages: [new HumanMessage("Hello, world!")],
      });
      await agent.invoke({
        messages: { role: "user", content: "Hello, world!" },
      });
      await agent.invoke({
        messages: "Hello, world!",
      });
      await agent.invoke({
        messages: new HumanMessage("Hello, world!"),
      });

      // stream
      await agent.stream({
        messages: [{ role: "user", content: "Hello, world!" }],
      });
      await agent.stream({
        messages: ["Hello, world!"],
      });
      await agent.stream({
        messages: [new HumanMessage("Hello, world!")],
      });
      await agent.stream({
        messages: { role: "user", content: "Hello, world!" },
      });
      await agent.stream({
        messages: "Hello, world!",
      });
      await agent.stream({
        messages: new HumanMessage("Hello, world!"),
      });
    });
    it("with state schema", async () => {
      const agent = createAgent({
        model: "openai:gpt-4",
        stateSchema: z.object({
          foo: z.number(),
        }),
      });
      // invoke
      await agent.invoke({
        messages: [{ role: "user", content: "Hello, world!" }],
        foo: 123,
      });
      await agent.invoke({
        messages: [new HumanMessage("Hello, world!")],
        foo: 123,
      });
      // stream
      await agent.stream({
        messages: [{ role: "user", content: "Hello, world!" }],
        foo: 123,
      });
      await agent.stream({
        messages: [new HumanMessage("Hello, world!")],
        foo: 123,
      });
    });
  });

  it("supports base callback config", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
    });
    await agent.invoke(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        runName: "test",
        metadata: {
          test: "test",
        },
        callbacks: [
          {
            handleLLMStart: (input) => {
              expectTypeOf({ id: input.id }).toMatchObjectType<{
                id: string[];
              }>();
            },
          },
        ],
      }
    );
  });

  it("should support passing `callbacks` as an array of callbacks", async () => {
    const agent = createAgent({
      model: "openai:gpt-4",
    });
    await agent.invoke(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        callbacks: [
          {
            handleLLMStart: (input) => {
              expectTypeOf({ id: input.id }).toMatchObjectType<{
                id: string[];
              }>();
            },
          },
        ],
      }
    );
    await agent.stream(
      {
        messages: [new HumanMessage("Hello, world!")],
      },
      {
        streamMode: ["values", "updates", "messages"],
        callbacks: [
          {
            handleLLMStart: (input) => {
              expectTypeOf({ id: input.id }).toMatchObjectType<{
                id: string[];
              }>();
            },
          },
        ],
      }
    );
  });
});
