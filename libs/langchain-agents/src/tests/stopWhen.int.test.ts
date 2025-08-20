import { describe, it, expect, vi } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import type { InteropZodType } from "@langchain/core/utils/types";
import z from "zod";

import {
  type PredicateFunction,
  createReactAgent,
  stopWhen,
  stopWhenToolCall,
  stopWhenMaxSteps,
} from "../index.js";

interface TestScenario {
  name: string;
  stopWhen: PredicateFunction<any>[];
  toolParams?: PollToolParams;
  expectedToolCalls: number;
  responseFormat?: InteropZodType;
  expectedLastMessage: string;
  expectedStructuredResponse: any;
  only?: boolean;
  skip?: boolean;
}

// Response format schema used in some test cases
const responseFormat = z.object({
  attempts: z.number(),
  succeeded: z.boolean(),
});

// define a llm
const llm = new ChatAnthropic({
  model: "claude-opus-4-0",
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

const testScenarios: TestScenario[] = [
  {
    name: "No stop condition - runs until task completion (10 tool calls)",
    stopWhen: [],
    expectedToolCalls: 10,
    expectedLastMessage: "Attempts: 10",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Tool call limit (before completion) - stops at 5 tool calls",
    stopWhen: [stopWhenToolCall("pollJob", 5)],
    expectedToolCalls: 5,
    expectedLastMessage:
      "A stop condition was met: Tool call count for pollJob is 5 and exceeded the limit of 5",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Tool call limit (after completion) - completes normally at 10 calls",
    stopWhen: [stopWhenToolCall("pollJob", 15)],
    expectedToolCalls: 10,
    expectedLastMessage: "Attempts: 10",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Max steps limit (before completion) - stops after 3 LLM calls",
    stopWhen: [stopWhenMaxSteps(3)],
    expectedToolCalls: 3,
    expectedLastMessage:
      "A stop condition was met: Model call count is 3 and reached the limit of 3",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Max steps limit (after completion) - completes normally",
    stopWhen: [stopWhenMaxSteps(20)],
    expectedToolCalls: 10,
    expectedLastMessage: "Attempts: 10",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Array of conditions (first triggers) - stops at 5 tool calls",
    stopWhen: [stopWhenToolCall("pollJob", 5), stopWhenMaxSteps(10)],
    expectedToolCalls: 5,
    expectedLastMessage:
      "A stop condition was met: Tool call count for pollJob is 5 and exceeded the limit of 5",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Array of conditions (second triggers) - stops after 2 LLM calls",
    stopWhen: [stopWhenToolCall("pollJob", 20), stopWhenMaxSteps(2)],
    expectedToolCalls: 2,
    expectedLastMessage:
      "A stop condition was met: Model call count is 2 and reached the limit of 2",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Duplicate conditions - most restrictive wins",
    stopWhen: [stopWhenToolCall("pollJob", 5), stopWhenToolCall("pollJob", 3)],
    expectedToolCalls: 3,
    expectedLastMessage:
      "A stop condition was met: Tool call count for pollJob is 3 and exceeded the limit of 3",
    expectedStructuredResponse: undefined,
  },
  {
    name: "Stop condition + response_format - provides structured response",
    stopWhen: [stopWhenToolCall("pollJob", 5)],
    expectedToolCalls: 5,
    expectedLastMessage:
      "A stop condition was met: Tool call count for pollJob is 5 and exceeded the limit of 5",
    expectedStructuredResponse: { attempts: 5, succeeded: false },
    responseFormat,
  },
  {
    name: "Content-based stop - stops when specific word appears",
    stopWhen: [stopWhenMessageContains("ERROR") as any],
    toolParams: { injectWord: "ERROR", injectAfter: 5 },
    expectedToolCalls: 5,
    expectedLastMessage:
      'A stop condition was met: Stop condition met: Message contains "ERROR"',
    expectedStructuredResponse: undefined,
  },
];

describe("stopWhen Tests", () => {
  testScenarios.forEach((scenario) => {
    const testFn = scenario.only
      ? it.only
      : scenario.skip
      ? it.skip
      : it.concurrent;
    testFn(scenario.name, async () => {
      const { tool: pollJob, mock } = makePollTool(scenario.toolParams);

      const agent = createReactAgent({
        llm,
        tools: [pollJob],
        prompt: AGENT_PROMPT,
        stopWhen: scenario.stopWhen,
        responseFormat: scenario.responseFormat as InteropZodType,
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
      expect((result as any).structuredResponse).toEqual(
        scenario.expectedStructuredResponse
      );
    });
  });
});
