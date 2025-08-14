import { describe, it, expect, vi } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import z from "zod";

import { createReactAgent, stopWhenToolCall } from "../index.js";

// Response format schema used in some test cases
const responseFormatSchema = z.object({
  attempts: z.number(),
  succeeded: z.boolean(),
});

/**
 * A deterministic poll tool: returns "pending" for the first 10 calls, then "succeeded".
 * @param returnDirect - Whether the tool should return directly
 * @returns A tool that polls a job and returns the status and number of attempts.
 */
function makePollTool(returnDirect: boolean) {
  let attempts = 0;

  const mock = vi.fn(() => {
    attempts += 1;
    return { status: attempts >= 10 ? "succeeded" : "pending", attempts };
  });

  return {
    tool: tool(mock, {
      name: "pollJob",
      description:
        "Check the status of a long-running job. Returns { status: 'pending' | 'succeeded', attempts: number }.",
      returnDirect,
      schema: z.object({}), // no args
    }),
    mock,
  };
}

// Agent prompt used across all tests
const AGENT_PROMPT = `You are a strict polling bot.

- Only use the "pollJob" tool until it returns { status: "succeeded" }.
- If status is "pending", call the tool again. Do not produce a final answer.
- When it is "succeeded", return exactly: "Attempts: <number>" with no extra text.`;

describe("return_direct Matrix Tests", () => {
  const testCases = [
    {
      name: "Scenario: ❌ return_direct, ❌ response_format, ❌ stop_when",
      returnDirect: false,
      responseFormat: undefined,
      stopWhen: undefined,
      expectedToolCalls: 10,
      expectedLastMessage: "Attempts: 10",
      expectedStructuredResponse: undefined,
    },
    {
      name: "Scenario: ❌ return_direct, ✅ response_format, ❌ stop_when",
      returnDirect: false,
      responseFormat: responseFormatSchema,
      stopWhen: undefined,
      expectedToolCalls: 10,
      expectedLastMessage:
        /\{\s*"status":\s*"succeeded",\s*"attempts":\s*10\s*\}/,
      expectedStructuredResponse: { attempts: 10, succeeded: true },
    },
    {
      name: "Scenario: ❌ return_direct, ❌ response_format, ✅ stop_when",
      returnDirect: false,
      responseFormat: undefined,
      stopWhen: [stopWhenToolCall("pollJob", 5)],
      expectedToolCalls: 5,
      expectedLastMessage:
        "A stop condition was met: Tool call count for pollJob is 5 and exceeded the limit of 5",
      expectedStructuredResponse: undefined,
    },
    {
      name: "Scenario: ❌ return_direct, ✅ response_format, ✅ stop_when",
      returnDirect: false,
      responseFormat: responseFormatSchema,
      stopWhen: [stopWhenToolCall("pollJob", 5)],
      expectedToolCalls: 5,
      expectedLastMessage:
        "A stop condition was met: Tool call count for pollJob is 5 and exceeded the limit of 5",
      expectedStructuredResponse: { attempts: 5, succeeded: false },
    },
    {
      name: "Scenario: ✅ return_direct, ❌ response_format, ❌ stop_when",
      returnDirect: true,
      responseFormat: undefined,
      stopWhen: undefined,
      expectedToolCalls: 1,
      expectedLastMessage: /\{\s*"status":\s*"pending",\s*"attempts":\s*1\s*\}/,
      expectedStructuredResponse: undefined,
    },
    {
      name: "Scenario: ✅ return_direct, ✅ response_format, ❌ stop_when",
      returnDirect: true,
      responseFormat: responseFormatSchema,
      stopWhen: undefined,
      expectedToolCalls: 1,
      expectedLastMessage: /\{\s*"status":\s*"pending",\s*"attempts":\s*1\s*\}/,
      expectedStructuredResponse: { attempts: 1, succeeded: false },
    },
    {
      name: "Scenario: ✅ return_direct, ❌ response_format, ✅ stop_when",
      returnDirect: true,
      responseFormat: undefined,
      stopWhen: [stopWhenToolCall("pollJob", 5)],
      expectedToolCalls: 1,
      expectedLastMessage: /\{\s*"status":\s*"pending",\s*"attempts":\s*1\s*\}/,
      expectedStructuredResponse: undefined,
    },
    {
      name: "Scenario: ✅ return_direct, ✅ response_format, ✅ stop_when",
      returnDirect: true,
      responseFormat: responseFormatSchema,
      stopWhen: [stopWhenToolCall("pollJob", 5)],
      expectedToolCalls: 1,
      expectedLastMessage: /\{\s*"status":\s*"pending",\s*"attempts":\s*1\s*\}/,
      expectedStructuredResponse: { attempts: 1, succeeded: false },
    },
  ];

  testCases.forEach((testCase) => {
    it.concurrent(testCase.name, async () => {
      // Create LLM instance
      const llm = new ChatAnthropic({
        model: "claude-3-5-sonnet-20240620",
        temperature: 0, // Make it deterministic
      });

      // Create poll tool with specified returnDirect setting
      const { tool, mock } = makePollTool(testCase.returnDirect);

      // Create agent with specified configuration
      const agent = createReactAgent({
        llm,
        tools: [tool],
        prompt: AGENT_PROMPT,
        ...(testCase.responseFormat && {
          responseFormat: testCase.responseFormat,
        }),
        ...(testCase.stopWhen && { stopWhen: testCase.stopWhen }),
      });

      // Invoke the agent
      const result = await agent.invoke({
        messages: [
          new HumanMessage(
            "Poll the job until it's done and tell me how many attempts it took."
          ),
        ],
      });

      // Count tool calls
      expect(mock).toHaveBeenCalledTimes(testCase.expectedToolCalls);

      // Check last message content
      const lastMessage = result.messages.at(-1);
      const lastMessageContent = lastMessage?.content;

      if (typeof testCase.expectedLastMessage === "string") {
        expect(lastMessageContent).toBe(testCase.expectedLastMessage);
      } else {
        // It's a regex
        expect(lastMessageContent).toMatch(testCase.expectedLastMessage);
      }

      // Check structured response
      if (testCase.expectedStructuredResponse !== undefined) {
        expect(result.structuredResponse).toEqual(
          testCase.expectedStructuredResponse
        );
      } else {
        expect(result.structuredResponse).toBeUndefined();
      }
    });
  });
});
