import { describe, it, expect, vi } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import z from "zod";

import { createAgent, stopWhenToolCall, JsonSchemaFormat } from "../index.js";

import returnDirectSpec from "./specifications/returnDirect.json";

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

const predicateMap = {
  stopWhenToolCall,
} as const;

// Agent prompt used across all tests
const AGENT_PROMPT = `You are a strict polling bot.

- Only use the "pollJob" tool until it returns { status: "succeeded" }.
- If status is "pending", call the tool again. Do not produce a final answer.
- When it is "succeeded", return exactly: "Attempts: <number>" with no extra text.`;

interface TestCase {
  name: string;
  returnDirect: boolean;
  responseFormat?: JsonSchemaFormat;
  stopWhen:
    | {
        predicate: keyof typeof predicateMap;
        args: any[];
      }[]
    | undefined;
  expectedToolCalls: number;
  expectedLastMessage: string | RegExp;
  expectedStructuredResponse: any;
  only?: boolean;
}

describe("return_direct Matrix Tests", () => {
  const testCases = returnDirectSpec as TestCase[];

  testCases.forEach((testCase) => {
    let testFn = it.concurrent;
    if (testCase.only) {
      testFn = it.only;
    }
    testFn(testCase.name, async () => {
      // Create LLM instance
      const llm = new ChatAnthropic({
        model: "claude-3-5-sonnet-20240620",
        temperature: 0, // Make it deterministic
      });

      // Create poll tool with specified returnDirect setting
      const { tool, mock } = makePollTool(testCase.returnDirect);

      // Create agent with specified configuration
      const baseConfig = {
        llm,
        tools: [tool],
        prompt: AGENT_PROMPT,
        ...(testCase.stopWhen && {
          stopWhen: testCase.stopWhen.map((stopWhen) =>
            predicateMap[stopWhen.predicate](stopWhen.args[0], stopWhen.args[1])
          ),
        }),
      };

      const agent = testCase.responseFormat
        ? createAgent({
            ...baseConfig,
            responseFormat: testCase.responseFormat,
          })
        : createAgent(baseConfig);

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
      if (testCase.expectedStructuredResponse !== null) {
        expect((result as any).structuredResponse).toEqual(
          testCase.expectedStructuredResponse
        );
      } else {
        expect((result as any).structuredResponse).toBeUndefined();
      }
    });
  });
});
