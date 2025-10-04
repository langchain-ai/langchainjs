import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { FakeToolCallingChatModel } from "../../../tests/utils.js";
import { modelCallLimitMiddleware } from "../callLimit.js";
import { createAgent } from "../../index.js";

const toolCallMessage1 = new AIMessage({
  content: "foo",
  tool_calls: [
    {
      id: "call_1",
      name: "tool_1",
      args: { arg1: "arg1" },
    },
  ],
});
const toolCallMessage2 = new AIMessage({
  content: "bar",
  tool_calls: [
    {
      id: "call_1",
      name: "tool_2",
      args: { arg1: "arg2" },
    },
  ],
});
const toolCallMessage3 = new AIMessage({
  content: "baz",
  tool_calls: [
    {
      id: "call_1",
      name: "tool_3",
      args: { arg1: "arg3" },
    },
  ],
});
const responseMessage1 = new AIMessage({
  content: "baz",
});
const responseMessage2 = new AIMessage({
  content: "fuzbaz",
});
const responseMessage3 = new AIMessage({
  content: "fuzbazbaz",
});

const tools = [
  tool(() => "foobar", {
    name: "tool_1",
    description: "tool_1",
  }),
];

describe("ModelCallLimitMiddleware", () => {
  describe.each(["throw", "end"] as const)(
    "run limit with exit behavior %s",
    (exitBehavior) => {
      it("should not throw if the run limit exceeds", async () => {
        const model = new FakeToolCallingChatModel({
          responses: [
            toolCallMessage1,
            responseMessage1,
            toolCallMessage2,
            responseMessage2,
            toolCallMessage3,
            responseMessage3,
          ],
        });
        const middleware = modelCallLimitMiddleware({
          runLimit: 2,
          exitBehavior,
        });
        const agent = createAgent({
          model,
          tools,
          middleware: [middleware] as const,
        });

        const result = await agent.invoke({ messages: ["Hello, world!"] });

        /**
         * first invocation should not throw as only 2 model calls are made
         */
        expect(result.messages.at(-1)?.content).toBe("baz");

        if (exitBehavior === "throw") {
          /**
           * next invocation should throw as 3 model calls are made
           */
          await expect(
            agent.invoke({ messages: ["Hello, world!"] })
          ).rejects.toThrow(
            "Model call limits exceeded: run level call limit reached with 3 model calls (allowed: 2)"
          );
        } else {
          /**
           * next invocation should not throw as 3 model calls are made
           */
          const result = await agent.invoke({ messages: ["Hello, world!"] });
          expect(result.messages.at(-1)?.content).toBe(
            "Model call limits exceeded: run level call limit reached with 3 model calls (allowed: 2)"
          );
        }
      });
    }
  );

  describe.each(["throw", "end"] as const)(
    "thread limit with exit behavior %s",
    (exitBehavior) => {
      const checkpointer = new MemorySaver();
      const config = {
        configurable: {
          thread_id: "test-123",
        },
      };
      const middleware = modelCallLimitMiddleware({
        threadLimit: 2,
        exitBehavior,
      });

      it("should not throw if the thread limit is not exceeded", async () => {
        const model = new FakeToolCallingChatModel({
          responses: [toolCallMessage1],
        });
        const agent = createAgent({
          model,
          tools,
          checkpointer,
          middleware: [middleware] as const,
        });
        await expect(
          agent.invoke({ messages: ["Hello, world!"] }, config)
        ).resolves.not.toThrow();

        const agent2 = createAgent({
          model,
          tools,
          middleware: [middleware] as const,
          checkpointer,
        });
        await expect(
          agent2.invoke({ messages: ["Hello, world!"] }, config)
        ).resolves.not.toThrow();
      });

      it("should throw an error if the thread limit is exceeded", async () => {
        const model = new FakeToolCallingChatModel({
          responses: [toolCallMessage1],
        });
        const agent = createAgent({
          model,
          tools,
          checkpointer,
          middleware: [middleware] as const,
        });
        if (exitBehavior === "throw") {
          await expect(
            agent.invoke({ messages: ["Hello, world!"] }, config)
          ).rejects.toThrow(
            "Model call limits exceeded: thread level call limit reached with 3 model calls (allowed: 2)"
          );
        } else {
          const result = await agent.invoke(
            { messages: ["Hello, world!"] },
            config
          );
          expect(result.messages.at(-1)?.content).toBe(
            "Model call limits exceeded: thread level call limit reached with 3 model calls (allowed: 2)"
          );
        }
      });
    }
  );
});
