/* eslint-disable import/no-extraneous-dependencies */
import { describe, it, expectTypeOf } from "vitest";
import { z } from "zod";
import { SystemMessage, BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { type BaseStore } from "@langchain/langgraph-checkpoint";

import { createAgent, AgentRuntime } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

describe("types", () => {
  it("should work with string prompt", async () => {
    const stateSchema = z.object({
      foo: z.string(),
      bar: z.number(),
    });

    const contextSchema = z.object({
      foobar: z.object({
        baz: z.string(),
      }),
    });

    void createAgent({
      llm: new FakeToolCallingModel(),
      prompt: (state, config) => {
        // still allows to access messages
        expectTypeOf(state.messages).toEqualTypeOf<BaseMessage[]>();
        // allows to access state properties
        expectTypeOf(state.foo).toEqualTypeOf<string>();
        expectTypeOf(state.bar).toEqualTypeOf<number>();

        // allows to access context properties
        expectTypeOf(config.context?.foobar.baz).toEqualTypeOf<
          string | undefined
        >();
        expectTypeOf(config.writer).toEqualTypeOf<
          ((chunk: unknown) => void) | undefined
        >();
        expectTypeOf(config.store).toEqualTypeOf<BaseStore | undefined>();
        expectTypeOf(config.signal).toEqualTypeOf<AbortSignal | undefined>();
        expectTypeOf(config.maxConcurrency).toEqualTypeOf<number | undefined>();
        expectTypeOf(config.timeout).toEqualTypeOf<number | undefined>();
        expectTypeOf(config.metadata).toEqualTypeOf<
          Record<string, unknown> | undefined
        >();
        expectTypeOf(config).toHaveProperty("configurable");
        expectTypeOf(config.tags).toEqualTypeOf<string[] | undefined>();

        return [new SystemMessage("You are a helpful assistant.")];
      },
      preModelHook: (state) => {
        // still allows to access messages
        expectTypeOf(state.messages).toEqualTypeOf<BaseMessage[]>();
        // allows to access state properties
        expectTypeOf(state.foo).toEqualTypeOf<string>();
        expectTypeOf(state.bar).toEqualTypeOf<number>();

        return state;
      },
      postModelHook: (state) => {
        // still allows to access messages
        expectTypeOf(state.messages).toEqualTypeOf<BaseMessage[]>();
        // allows to access state properties
        expectTypeOf(state.foo).toEqualTypeOf<string>();
        expectTypeOf(state.bar).toEqualTypeOf<number>();

        return state;
      },
      stateSchema,
      contextSchema,
      tools: [],
    });
  });

  it("should provide runtime type", () => {
    const contextSchema = z.object({
      userId: z.string(),
    });

    tool(
      async (_, runtime: AgentRuntime<z.infer<typeof contextSchema>>) => {
        expectTypeOf(runtime.context).toEqualTypeOf<
          z.infer<typeof contextSchema> | undefined
        >();
        expectTypeOf(runtime.store).toEqualTypeOf<BaseStore | undefined>();
        expectTypeOf(runtime.writer).toEqualTypeOf<
          ((chunk: unknown) => void) | undefined
        >();
        expectTypeOf(runtime.signal).toEqualTypeOf<AbortSignal | undefined>();
      },
      {
        name: "test",
        description: "test",
        schema: z.object({}),
      }
    );
  });
});
