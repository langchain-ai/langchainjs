import { z } from "zod/v3";
import { describe, it, expectTypeOf } from "vitest";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  ContentBlock,
} from "@langchain/core/messages";

import { createMiddleware } from "../middleware.js";
import { createAgent } from "../index.js";

describe("type safe messages in createAgent", () => {
  it("should propagate right tool structure", async () => {
    const t1 = tool(
      async () =>
        ({
          foo: "bar",
        }) as const,
      {
        name: "t1",
        description: "test",
        schema: z.object({
          name: z.string(),
        }),
      }
    );

    const t2 = tool(
      async () =>
        ({
          bar: "foo",
        }) as const,
      {
        name: "t2",
        description: "test",
        schema: z.object({
          bar: z.array(z.boolean()),
        }),
      }
    );

    const m = createMiddleware({
      name: "middleware",
      stateSchema: z.object({
        middlewareState: z.string(),
      }),
      tools: [t2],
    });

    const agent = createAgent({
      model: "gpt-4o-mini",
      tools: [t1],
      middleware: [m],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Hello, world!")],
      middlewareState: "test",
    });

    const aiMessages = result.messages.filter((m) => AIMessage.isInstance(m));
    const toolCalls = aiMessages.map((m) => m.tool_calls).flat();
    const toolNames = toolCalls.map((m) => m?.name);
    expectTypeOf(toolNames).toEqualTypeOf<("t1" | "t2" | undefined)[]>();
    const toolArgs = toolCalls.map((m) => m?.args);
    expectTypeOf(toolArgs).toEqualTypeOf<
      (
        | {
            name: string;
          }
        | {
            bar: boolean[];
          }
        | undefined
      )[]
    >();

    const toolMessages = result.messages.filter((m) =>
      ToolMessage.isInstance(m)
    );
    const toolCallResultContents = toolMessages.map((m) => m.content);
    expectTypeOf(toolCallResultContents).toEqualTypeOf<
      (
        | string
        | {
            readonly foo: "bar";
          }
        | {
            readonly bar: "foo";
          }
        | (ContentBlock | ContentBlock.Text)[]
      )[]
    >();
  });
});
