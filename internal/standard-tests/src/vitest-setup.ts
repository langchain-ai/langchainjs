import { expect } from "vitest";
import { langchainMatchers } from "./matchers.ts";

expect.extend(langchainMatchers);

interface CustomMatchers<R = unknown> {
  toBeHumanMessage(expected?: string | { content?: string; id?: string }): R;
  toBeAIMessage(expected?: string | { content?: string; name?: string }): R;
  toBeSystemMessage(
    expected?: string | { content?: string; additional_kwargs?: object }
  ): R;
  toBeToolMessage(
    expected?:
      | string
      | {
          content?: string;
          name?: string;
          status?: string;
          tool_call_id?: string;
        }
  ): R;
  toHaveToolCalls(
    expected: Array<{
      name?: string;
      id?: string;
      args?: Record<string, unknown>;
    }>
  ): R;
  toHaveToolCallCount(expected: number): R;
  toContainToolCall(expected: {
    name?: string;
    id?: string;
    args?: Record<string, unknown>;
  }): R;
  toHaveToolMessages(
    expected: Array<{
      content?: string;
      name?: string;
      status?: string;
      tool_call_id?: string;
    }>
  ): R;
  toHaveBeenInterrupted(expectedValue?: unknown): R;
  toHaveStructuredResponse(expected?: Record<string, unknown>): R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Matchers<T = any> extends CustomMatchers<T> {}
}
