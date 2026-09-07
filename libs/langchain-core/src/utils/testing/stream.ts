import type { AIMessage } from "../../messages/index.js";
import type { UsageMetadata } from "../../messages/metadata.js";
import { ChatModelStream } from "../../language_models/stream.js";

/**
 * The `this` context that Vitest provides to custom matchers via `expect.extend`.
 * @see https://vitest.dev/guide/extending-matchers.html
 */
interface ExpectExtendThis {
  isNot?: boolean;
  equals(a: unknown, b: unknown): boolean;
  utils: {
    matcherHint(
      name: string,
      received?: string,
      expected?: string,
      options?: { isNot?: boolean }
    ): string;
    printReceived(value: unknown): string;
    printExpected(value: unknown): string;
  };
}

interface ExpectationResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
  expected?: unknown;
}

function isChatModelStream(received: unknown): received is ChatModelStream {
  if (received == null || typeof received !== "object") {
    return false;
  }
  const stream = received as ChatModelStream;
  return (
    typeof stream.text !== "undefined" &&
    typeof stream.toolCalls !== "undefined" &&
    typeof stream.reasoning !== "undefined" &&
    typeof stream.usage !== "undefined" &&
    typeof stream.output !== "undefined" &&
    typeof stream[Symbol.asyncIterator] === "function"
  );
}

function matchesPartialObject(
  actual: Record<string, unknown> | undefined,
  expected: Record<string, unknown>,
  equals: ExpectExtendThis["equals"]
): boolean {
  if (actual == null) {
    return false;
  }
  return Object.entries(expected).every(([key, value]) =>
    equals(actual[key], value)
  );
}

function matchesStreamUsage(
  actual: UsageMetadata | undefined,
  expected: StreamUsageExpectation,
  equals: ExpectExtendThis["equals"]
): boolean {
  if (actual == null) {
    return false;
  }
  return matchesPartialObject(
    actual as Record<string, unknown>,
    expected as Record<string, unknown>,
    equals
  );
}

function getOutputText(message: AIMessage): string | undefined {
  const content = message.content as Array<{ type: string; text?: string }>;
  return content.find((block) => block.type === "text")?.text;
}

function matchesStreamOutput(
  message: AIMessage,
  expected: StreamOutputExpectation,
  equals: ExpectExtendThis["equals"]
): boolean {
  if (expected.id !== undefined && message.id !== expected.id) {
    return false;
  }
  if (expected.text !== undefined && getOutputText(message) !== expected.text) {
    return false;
  }
  if (expected.toolCalls !== undefined) {
    const calls = message.tool_calls ?? [];
    if (calls.length !== expected.toolCalls.length) {
      return false;
    }
    for (let i = 0; i < expected.toolCalls.length; i++) {
      const call = calls[i];
      const exp = expected.toolCalls[i]!;
      if (call?.name !== exp.name || !equals(call.args, exp.args)) {
        return false;
      }
    }
  }
  if (
    expected.usage !== undefined &&
    !matchesStreamUsage(message.usage_metadata, expected.usage, equals)
  ) {
    return false;
  }
  if (
    expected.responseMetadata !== undefined &&
    !matchesPartialObject(
      message.response_metadata as Record<string, unknown>,
      expected.responseMetadata,
      equals
    )
  ) {
    return false;
  }
  return true;
}

function invalidStreamResult(
  received: unknown,
  matcherName: string,
  utils: ExpectExtendThis["utils"]
): ExpectationResult {
  return {
    pass: false,
    message: () =>
      `${utils.matcherHint(matcherName)}\n\n` +
      `Expected: ChatModelStream (return value of model.streamEvents("Hello"))\n` +
      `Received: ${utils.printReceived(received)}`,
    actual: received,
    expected: "ChatModelStream",
  };
}

function applyNot(pass: boolean, isNot?: boolean): boolean {
  return isNot ? !pass : pass;
}

export async function toHaveStreamText(
  this: ExpectExtendThis,
  received: unknown,
  expected: string
): Promise<ExpectationResult> {
  const { isNot, utils } = this;
  const matcherName = "toHaveStreamText";

  if (!isChatModelStream(received)) {
    return invalidStreamResult(received, matcherName, utils);
  }

  const actual = await received.text;
  const pass = applyNot(actual === expected, isNot);

  return {
    pass,
    message: () =>
      `${utils.matcherHint(matcherName, undefined, undefined, { isNot })}\n\n` +
      `Expected stream text: ${isNot ? "not " : ""}${utils.printExpected(expected)}\n` +
      `Received stream text: ${utils.printReceived(actual)}`,
    actual,
    expected,
  };
}

export async function toHaveStreamReasoning(
  this: ExpectExtendThis,
  received: unknown,
  expected: string
): Promise<ExpectationResult> {
  const { isNot, utils } = this;
  const matcherName = "toHaveStreamReasoning";

  if (!isChatModelStream(received)) {
    return invalidStreamResult(received, matcherName, utils);
  }

  const actual = await received.reasoning;
  const pass = applyNot(actual === expected, isNot);

  return {
    pass,
    message: () =>
      `${utils.matcherHint(matcherName, undefined, undefined, { isNot })}\n\n` +
      `Expected stream reasoning: ${isNot ? "not " : ""}${utils.printExpected(expected)}\n` +
      `Received stream reasoning: ${utils.printReceived(actual)}`,
    actual,
    expected,
  };
}

export type StreamToolCallExpectation = {
  name: string;
  args: Record<string, unknown>;
};

export type StreamUsageExpectation = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_token_details?: Record<string, unknown>;
  output_token_details?: Record<string, unknown>;
};

export type StreamOutputExpectation = {
  id?: string;
  text?: string;
  toolCalls?: StreamToolCallExpectation[];
  usage?: StreamUsageExpectation;
  responseMetadata?: Record<string, unknown>;
};

export async function toHaveStreamToolCalls(
  this: ExpectExtendThis,
  received: unknown,
  expected: StreamToolCallExpectation[]
): Promise<ExpectationResult> {
  const { isNot, utils } = this;
  const matcherName = "toHaveStreamToolCalls";

  if (!isChatModelStream(received)) {
    return invalidStreamResult(received, matcherName, utils);
  }

  const actual = await received.toolCalls;

  let pass =
    actual.length === expected.length &&
    expected.every((exp, i) => {
      const call = actual[i];
      return call?.name === exp.name && this.equals(call.args, exp.args);
    });
  pass = applyNot(pass, isNot);

  return {
    pass,
    message: () =>
      `${utils.matcherHint(matcherName, undefined, undefined, { isNot })}\n\n` +
      `Expected stream tool calls: ${utils.printExpected(expected)}\n` +
      `Received stream tool calls: ${utils.printReceived(
        actual.map((tc) => ({ name: tc.name, args: tc.args }))
      )}`,
    actual: actual.map((tc) => ({ name: tc.name, args: tc.args })),
    expected,
  };
}

export async function toHaveStreamUsage(
  this: ExpectExtendThis,
  received: unknown,
  expected: StreamUsageExpectation
): Promise<ExpectationResult> {
  const { isNot, utils } = this;
  const matcherName = "toHaveStreamUsage";

  if (!isChatModelStream(received)) {
    return invalidStreamResult(received, matcherName, utils);
  }

  const actual = await received.usage;
  const pass = applyNot(
    matchesStreamUsage(actual, expected, this.equals),
    isNot
  );

  return {
    pass,
    message: () =>
      `${utils.matcherHint(matcherName, undefined, undefined, { isNot })}\n\n` +
      `Expected stream usage: ${utils.printExpected(expected)}\n` +
      `Received stream usage: ${utils.printReceived(actual)}`,
    actual,
    expected,
  };
}

export async function toHaveStreamOutput(
  this: ExpectExtendThis,
  received: unknown,
  expected: StreamOutputExpectation
): Promise<ExpectationResult> {
  const { isNot, utils } = this;
  const matcherName = "toHaveStreamOutput";

  if (!isChatModelStream(received)) {
    return invalidStreamResult(received, matcherName, utils);
  }

  const message = await received.output;
  const pass = applyNot(
    matchesStreamOutput(message, expected, this.equals),
    isNot
  );

  return {
    pass,
    message: () =>
      `${utils.matcherHint(matcherName, undefined, undefined, { isNot })}\n\n` +
      `Expected stream output: ${utils.printExpected(expected)}\n` +
      `Received stream output: ${utils.printReceived({
        id: message.id,
        text: getOutputText(message),
        tool_calls: message.tool_calls?.map((tc) => ({
          name: tc.name,
          args: tc.args,
        })),
        usage_metadata: message.usage_metadata,
        response_metadata: message.response_metadata,
      })}`,
    actual: message,
    expected,
  };
}

/** Stream matchers for `expect.extend()`. */
export const streamMatchers = {
  toHaveStreamText,
  toHaveStreamReasoning,
  toHaveStreamToolCalls,
  toHaveStreamUsage,
  toHaveStreamOutput,
};

/**
 * Custom assertion helpers for values returned by `BaseChatModel.streamEvents()`.
 *
 * These matchers consume the stream lazily through the corresponding
 * `ChatModelStream` promise-backed properties.
 *
 * @typeParam R - The assertion return type provided by the test framework.
 */
export interface StreamMatchers<R = unknown> {
  /**
   * Asserts that the stream resolves to the expected concatenated text.
   *
   * @param expected - The exact text expected from `ChatModelStream.text`.
   */
  toHaveStreamText(expected: string): R;

  /**
   * Asserts that the stream resolves to the expected concatenated reasoning text.
   *
   * @param expected - The exact reasoning text expected from `ChatModelStream.reasoning`.
   */
  toHaveStreamReasoning(expected: string): R;

  /**
   * Asserts that the stream resolves to the expected ordered tool calls.
   *
   * @param expected - Tool call names and arguments expected from `ChatModelStream.toolCalls`.
   */
  toHaveStreamToolCalls(expected: StreamToolCallExpectation[]): R;

  /**
   * Asserts that the stream resolves to usage metadata matching the expected fields.
   *
   * @param expected - A partial usage metadata object expected from `ChatModelStream.usage`.
   */
  toHaveStreamUsage(expected: StreamUsageExpectation): R;

  /**
   * Asserts that the final streamed output message matches the expected fields.
   *
   * @param expected - A partial output expectation checked against `ChatModelStream.output`.
   */
  toHaveStreamOutput(expected: StreamOutputExpectation): R;
}
