import { describe, it, expect } from "vitest";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
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
});

describe("run limit state across runs", () => {
  it("should start a new run with a fresh run count after a failed run", async () => {
    const checkpointer = new MemorySaver();
    const config = {
      configurable: {
        thread_id: "failed-run-thread",
      },
    };
    const middleware = modelCallLimitMiddleware({
      runLimit: 2,
      exitBehavior: "end",
    });

    class FailAfterFirstCall extends FakeToolCallingChatModel {
      async _generate(
        messages: BaseMessage[],
        options: this["ParsedCallOptions"],
        runManager?: CallbackManagerForLLMRun
      ): Promise<ChatResult> {
        if (this.idx >= 1) {
          throw new Error("model exploded");
        }
        return super._generate(messages, options, runManager);
      }
    }

    /**
     * First run: one model call (a tool call), then the model explodes, so
     * the run fails before the afterAgent hook can reset the run count.
     */
    const failingModel = new FailAfterFirstCall({
      responses: [toolCallMessage1],
      sleep: 0,
    });
    const agent1 = createAgent({
      model: failingModel,
      tools,
      checkpointer,
      middleware: [middleware],
    });
    await expect(
      agent1.invoke({ messages: ["Hello"] }, config)
    ).rejects.toThrow("model exploded");

    /**
     * Second run on the same thread: a new run must start with a fresh
     * run-level count, so a single model call is within the limit.
     */
    const workingModel = new FakeToolCallingChatModel({
      // two model calls (tool call + final answer), exactly at the limit.
      // Fresh message instances are required so the run 2 messages do not
      // reuse run 1 ids (the messages channel dedupes by id).
      responses: [
        new AIMessage({
          content: "foo",
          tool_calls: [
            { id: "call_2", name: "tool_1", args: { arg1: "arg1" } },
          ],
        }),
        new AIMessage({ content: "baz" }),
      ],
      sleep: 0,
    });
    const agent2 = createAgent({
      model: workingModel,
      tools,
      checkpointer,
      middleware: [middleware],
    });
    const result = await agent2.invoke({ messages: ["Again"] }, config);
    expect(result.messages.at(-1)?.content).toBe("baz");
  });

  it("should start a new run with a fresh run count after a run ended by the limit", async () => {
    const checkpointer = new MemorySaver();
    const config = {
      configurable: {
        thread_id: "limited-run-thread",
      },
    };
    const middleware = modelCallLimitMiddleware({
      runLimit: 2,
      exitBehavior: "end",
    });

    /**
     * First run: 3 model calls trip the run limit and jump to the end, so
     * the afterAgent hook never gets to reset the run count.
     */
    const limitedModel = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "foo",
          tool_calls: [
            { id: "call_a", name: "tool_1", args: { arg1: "arg1" } },
          ],
        }),
        new AIMessage({
          content: "bar",
          tool_calls: [
            { id: "call_b", name: "tool_1", args: { arg1: "arg1" } },
          ],
        }),
        new AIMessage({
          content: "fuz",
          tool_calls: [
            { id: "call_c", name: "tool_1", args: { arg1: "arg1" } },
          ],
        }),
      ],
      sleep: 0,
    });
    const agent1 = createAgent({
      model: limitedModel,
      tools,
      checkpointer,
      middleware: [middleware],
    });
    const limitedResult = await agent1.invoke({ messages: ["Hello"] }, config);
    expect(limitedResult.messages.at(-1)?.content).toContain(
      "Model call limits exceeded"
    );

    /**
     * Second run on the same thread: a new run must start with a fresh
     * run-level count, so two model calls (exactly at the limit) pass.
     * Fresh message instances are required so the run 2 messages do not
     * reuse run 1 ids (the messages channel dedupes by id).
     */
    const workingModel = new FakeToolCallingChatModel({
      responses: [
        new AIMessage({
          content: "foo",
          tool_calls: [
            { id: "call_d", name: "tool_1", args: { arg1: "arg1" } },
          ],
        }),
        new AIMessage({ content: "baz" }),
      ],
      sleep: 0,
    });
    const agent2 = createAgent({
      model: workingModel,
      tools,
      checkpointer,
      middleware: [middleware],
    });
    const result = await agent2.invoke({ messages: ["Again"] }, config);
    expect(result.messages.at(-1)?.content).toBe("baz");
  });
});
