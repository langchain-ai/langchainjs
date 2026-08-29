import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { FakeToolCallingChatModel } from "../../tests/utils.js";
import { modelCallLimitMiddleware } from "../modelCallLimit.js";
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
const toolCallMessageForRunLimit = new AIMessage({
  content: "",
  tool_calls: [
    {
      id: "call_1",
      name: "tool_1",
      args: { arg1: "arg1" },
    },
    {
      id: "call_2",
      name: "tool_2",
      args: { arg1: "arg2" },
    },
    {
      id: "call_3",
      name: "tool_3",
      args: { arg1: "arg3" },
    },
  ],
});
const toolCallMessage2 = new AIMessage({
  content: "",
  tool_calls: [
    {
      id: "call_1",
      name: "tool_2",
      args: { arg1: "arg2" },
    },
  ],
});
const toolCallMessage3 = new AIMessage({
  content: "",
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

const tools = [
  tool(() => "foobar", {
    name: "tool_1",
    description: "tool_1",
  }),
  tool(() => "barfoo", {
    name: "tool_2",
    description: "tool_2",
  }),
  tool(() => "barfoo", {
    name: "tool_3",
    description: "tool_3",
  }),
];

describe("ModelCallLimitMiddleware", () => {
  describe.each(["error", "end"] as const)(
    "run limit with exit behavior %s",
    (exitBehavior) => {
      it("should not throw if the run limit exceeds", async () => {
        // First invocation: 2 model calls (within limit)
        //   Call 1: Makes tool calls for 3 tools -> tools execute -> Call 2: Final response
        // Second invocation: 3 model calls (exceeds limit of 2)
        //   Call 1: Makes tool call -> tool executes -> Call 2: Makes tool call -> tool executes -> Call 3: Should fail
        const model = new FakeToolCallingChatModel({
          responses: [
            // First invocation - Call 1: Makes 3 tool calls
            toolCallMessageForRunLimit,
            // First invocation - Call 2: Final response after tools execute
            responseMessage1,
            // Second invocation - Call 1: Makes 1 tool call
            toolCallMessage1,
            // Second invocation - Call 2: Makes 1 tool call (after first tool executes)
            toolCallMessage2,
            // Second invocation - Call 3: Makes 1 tool call (should fail here - limit exceeded)
            toolCallMessage3,
            // Second invocation - Call 4: Final response (should never reach this)
            responseMessage2,
          ],
        });
        const middleware = modelCallLimitMiddleware({
          runLimit: 2,
          exitBehavior,
        });
        const agent = createAgent({
          model,
          tools,
          middleware: [middleware],
        });

        const result = await agent.invoke({ messages: ["Hello, world!"] });

        /**
         * first invocation should not throw as only 2 model calls are made
         */
        expect(result.messages.at(-1)?.content).toBe("baz");

        if (exitBehavior === "error") {
          /**
           * next invocation should throw as 3 model calls are made
           */
          await expect(
            agent.invoke({ messages: ["Hello, world!"] })
          ).rejects.toThrow(
            "Model call limits exceeded: run level call limit reached with 2 model calls"
          );
        } else {
          /**
           * next invocation should not throw as 3 model calls are made
           */
          const result = await agent.invoke({ messages: ["Hello, world!"] });
          expect(result.messages.at(-1)?.content).toBe(
            "Model call limits exceeded: run level call limit reached with 2 model calls"
          );
        }
      });
    }
  );

  describe.each(["error", "end"] as const)(
    "thread limit with exit behavior %s",
    (exitBehavior) => {
      const checkpointer = new MemorySaver();
      const config = {
        configurable: {
          thread_id: "test-123",
        },
      };
      const middleware = modelCallLimitMiddleware({
        threadLimit: 3,
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
          middleware: [middleware],
        });
        await expect(
          agent.invoke({ messages: ["Hello, world!"] }, config)
        ).resolves.not.toThrow();

        const agent2 = createAgent({
          model,
          tools,
          middleware: [middleware],
          checkpointer,
        });
        if (exitBehavior === "error") {
          const result = await agent2.invoke(
            { messages: ["Hello, world!"] },
            config
          );
          await expect(result.runModelCallCount).toBe(0);
          await expect(result.threadModelCallCount).toBe(3);
        } else {
          const result = await agent2.invoke(
            { messages: ["Hello, world!"] },
            config
          );
          await expect(result.runModelCallCount).toBe(0);
          await expect(result.threadModelCallCount).toBe(3);
          expect(result.messages.at(-1)?.content).not.toContain(
            "Model call limits exceeded"
          );
        }
      });

      it("should throw an error if the thread limit is exceeded", async () => {
        const model = new FakeToolCallingChatModel({
          responses: [toolCallMessage1],
        });
        const agent = createAgent({
          model,
          tools,
          checkpointer,
          middleware: [middleware],
        });
        if (exitBehavior === "error") {
          await expect(
            agent.invoke({ messages: ["Hello, world!"] }, config)
          ).rejects.toThrow(
            "Model call limits exceeded: thread level call limit reached with 3 model calls"
          );
        } else {
          const result = await agent.invoke(
            { messages: ["Hello, world!"] },
            config
          );
          expect(result.messages.at(-1)?.content).toBe(
            "Model call limits exceeded: thread level call limit reached with 3 model calls"
          );
        }
      });
    }
  );

  describe("run limit with exitBehavior 'end' — afterAgent resets runModelCallCount", () => {
    /**
     * Regression test for a graph topology bug in ReactAgent where
     * #createBeforeModelRouter routed to bare END instead of exitNode when
     * jumpTo: 'end' was returned from beforeModel. This bypassed all afterAgent
     * hooks, leaving runModelCallCount permanently stuck at the limit value in
     * the LangGraph checkpoint. Every subsequent user turn would hit beforeModel
     * with count >= limit and immediately terminate with no model call.
     *
     * Fix: #createBeforeModelRouter now routes to exitNode (first afterAgent node)
     * on jumpTo: 'end', matching the behaviour of #createBeforeAgentRouter.
     * This guarantees afterAgent — and its runModelCallCount reset — always runs.
     */
    it("resets runModelCallCount after limit hit so subsequent turns can proceed", async () => {
      const checkpointer = new MemorySaver();
      const config = { configurable: { thread_id: "reset-test-123" } };

      // Turn 1: agent makes 2 calls (hits runLimit=2), exitBehavior='end' fires.
      // Turn 2: without the fix, runModelCallCount=2 is still in checkpoint →
      //         beforeModel immediately jumps to END with no model call.
      //         With the fix, afterAgent resets it to 0 → model call succeeds.
      const model = new FakeToolCallingChatModel({
        responses: [
          // Turn 1 — Call 1: tool call
          toolCallMessage1,
          // Turn 1 — Call 2: another tool call (hits limit here, run ends via exitBehavior)
          toolCallMessage2,
          // Turn 2 — Call 1: final response (only reached if reset worked)
          responseMessage1,
        ],
      });

      const agent = createAgent({
        model,
        tools,
        checkpointer,
        middleware: [
          modelCallLimitMiddleware({ runLimit: 2, exitBehavior: "end" }),
        ],
      });

      // Turn 1: hits the run limit
      const turn1 = await agent.invoke(
        { messages: ["Hello, world!"] },
        config
      );
      expect(turn1.messages.at(-1)?.content).toContain(
        "Model call limits exceeded"
      );
      // runModelCallCount must be 0 after afterAgent fires (not stuck at 2)
      expect(turn1.runModelCallCount).toBe(0);

      // Turn 2: must succeed — if runModelCallCount was stuck the model would
      // never be called and the response would be another limit-exceeded message.
      const turn2 = await agent.invoke(
        { messages: ["Continue please"] },
        config
      );
      expect(turn2.messages.at(-1)?.content).toBe("baz");
      expect(turn2.runModelCallCount).toBe(0);
    });
  });
});
