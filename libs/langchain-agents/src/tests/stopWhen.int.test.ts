import { describe, it, expect, vi } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import z from "zod";

import {
  createReactAgent,
  stopWhen,
  stopWhenToolCall,
  stopWhenMaxSteps,
} from "../index.js";

// Response format schema used in some test cases
// const responseFormatSchema = z.object({
//   attempts: z.number(),
//   succeeded: z.boolean(),
// });

// define a llm
const llm = new ChatAnthropic({
  model: "claude-3-5-sonnet-20240620",
  temperature: 0,
});

interface PollToolParams {
  injectWord?: string;
  injectAfter?: number;
}

/**
 * A deterministic poll tool: returns "pending" for the first 10 calls, then "succeeded".
 * @returns A tool that polls a job and returns the status and number of attempts.
 */
function makePollTool(params?: PollToolParams) {
  let attempts = 0;

  const mock = vi.fn(() => {
    attempts += 1;
    const possix =
      params?.injectWord && attempts >= (params?.injectAfter || 0)
        ? ` (${params.injectWord})`
        : "";
    return {
      status: attempts >= 10 ? "succeeded" : `pending${possix}`,
      attempts,
    };
  });

  return {
    tool: tool(mock, {
      name: "pollJob",
      description:
        "Check the status of a long-running job. Returns { status: 'pending' | 'succeeded', attempts: number }.",
      schema: z.object({}), // no args
    }),
    mock,
    resetAttempts: () => {
      attempts = 0;
    },
  };
}

function stopWhenMessageContains(message: string) {
  return stopWhen((state) => {
    return {
      shouldStop: state.messages.some((msg) =>
        typeof msg.content === "string"
          ? msg.content.includes(message)
          : JSON.stringify(msg.content).includes(message)
      ),
      description: `Stop condition met: Message contains "${message}"`,
    };
  });
}

// Agent prompt used across all tests
const AGENT_PROMPT = `You are a strict polling bot.

- Only use the "pollJob" tool until it returns { status: "succeeded" }.
- If status is "pending", call the tool again. Do not produce a final answer.
- When it is "succeeded", return exactly: "Attempts: <number>" with no extra text.`;

const testScenarios = [
  {
    name: "No stop condition - runs until task completion (10 tool calls)",
    stopWhen: [],
    toolParams: undefined,
    expectedToolCalls: 10,
    responseFormat: undefined,
    expectedLastMessage: "Attempts: 10",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Tool call limit (before completion) - stops at 5 tool calls",
    stopWhen: [stopWhenToolCall("pollJob", 5)],
    toolParams: undefined,
    expectedToolCalls: 5,
    responseFormat: undefined,
    expectedLastMessage:
      "A stop condition was met: Tool call count for pollJob is 5 and exceeded the limit of 5",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Tool call limit (after completion) - completes normally at 10 calls",
    stopWhen: [stopWhenToolCall("pollJob", 15)],
    toolParams: undefined,
    expectedToolCalls: 10,
    responseFormat: undefined,
    expectedLastMessage: "Attempts: 10",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Max steps limit (before completion) - stops after 3 LLM calls",
    stopWhen: [stopWhenMaxSteps(3)],
    toolParams: undefined,
    expectedToolCalls: 3,
    responseFormat: undefined,
    expectedLastMessage:
      "A stop condition was met: Model call count is 3 and reached the limit of 3",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Max steps limit (after completion) - completes normally",
    stopWhen: [stopWhenMaxSteps(20)],
    toolParams: undefined,
    expectedToolCalls: 10,
    responseFormat: undefined,
    expectedLastMessage: "Attempts: 10",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Array of conditions (first triggers) - stops at 5 tool calls",
    stopWhen: [stopWhenToolCall("pollJob", 5), stopWhenMaxSteps(10)],
    toolParams: undefined,
    expectedToolCalls: 5,
    responseFormat: undefined,
    expectedLastMessage:
      "A stop condition was met: Tool call count for pollJob is 5 and exceeded the limit of 5",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Array of conditions (second triggers) - stops after 2 LLM calls",
    stopWhen: [stopWhenToolCall("pollJob", 20), stopWhenMaxSteps(2)],
    toolParams: undefined,
    expectedToolCalls: 2,
    responseFormat: undefined,
    expectedLastMessage:
      "A stop condition was met: Model call count is 2 and reached the limit of 2",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Duplicate conditions - most restrictive wins",
    stopWhen: [stopWhenToolCall("pollJob", 5), stopWhenToolCall("pollJob", 3)],
    toolParams: undefined,
    expectedToolCalls: 3,
    responseFormat: undefined,
    expectedLastMessage:
      "A stop condition was met: Tool call count for pollJob is 3 and exceeded the limit of 3",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Stop condition + response_format - provides structured response",
    stopWhen: [stopWhenToolCall("pollJob", 5)],
    toolParams: undefined,
    expectedToolCalls: 5,
    expectedLastMessage:
      "A stop condition was met: Tool call count for pollJob is 5 and exceeded the limit of 5",
    expectedStructuredResponse: { attempts: 5, succeeded: false },

    /**
     * Todo Fix: `stopWhen` doesn't work with `responseFormat`
     */
    skip: true,
  },
  {
    name: "Content-based stop - stops when specific word appears",
    stopWhen: [stopWhenMessageContains("ERROR")],
    toolParams: { injectWord: "ERROR", injectAfter: 5 },
    expectedToolCalls: 5,
    expectedLastMessage:
      'A stop condition was met: Stop condition met: Message contains "ERROR"',
    expectedStructuredResponse: undefined,
  },
];

describe("stopWhen Tests", () => {
  testScenarios.forEach((scenario) => {
    it.concurrent(scenario.name, async ({ skip }) => {
      if (scenario.skip) {
        return skip();
      }

      const { tool: pollJob, mock } = makePollTool(scenario.toolParams);

      const agent = createReactAgent({
        llm,
        tools: [pollJob],
        prompt: AGENT_PROMPT,
        stopWhen: scenario.stopWhen,
      });

      const result = await agent.invoke({
        messages: [
          new HumanMessage(
            "Poll the job until it's done and tell me how many attempts it took."
          ),
        ],
      });

      expect(mock).toHaveBeenCalledTimes(scenario.expectedToolCalls);
      expect(result.messages.at(-1)?.content).toBe(
        scenario.expectedLastMessage
      );
      expect(result.structuredResponse).toEqual(
        scenario.expectedStructuredResponse
      );
    });
  });
});
