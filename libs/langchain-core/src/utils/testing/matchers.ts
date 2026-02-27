/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseMessage } from "../../messages/base.js";
import { HumanMessage } from "../../messages/human.js";
import { AIMessage } from "../../messages/ai.js";
import { SystemMessage } from "../../messages/system.js";
import { ToolMessage } from "../../messages/tool.js";

/**
 * The `this` context Vitest provides to custom matchers via `expect.extend`.
 * See: https://vitest.dev/guide/extending-matchers.html
 */
interface ExpectExtendThis {
  isNot: boolean;
  equals(a: unknown, b: unknown): boolean;
  utils: {
    matcherHint(name: string, received?: string, expected?: string): string;
    printReceived(value: unknown): string;
    printExpected(value: unknown): string;
  };
}

/**
 * The return value shape for a custom matcher.
 * See: https://vitest.dev/guide/extending-matchers.html
 */
interface ExpectationResult {
  pass: boolean;
  message: () => string;
  actual?: unknown;
  expected?: unknown;
}

function getMessageTypeName(msg: unknown): string {
  if (!BaseMessage.isInstance(msg)) return typeof msg;
  return msg.constructor.name || msg.type;
}

function makeMessageTypeMatcher(
  typeName: string,
  isInstance: (obj: unknown) => boolean
) {
  return function (
    this: ExpectExtendThis,
    received: unknown,
    expected?: string | Record<string, unknown>
  ): ExpectationResult {
    const { isNot, utils } = this;

    const instancePass = isInstance(received);
    if (!instancePass) {
      return {
        pass: false,
        message: () =>
          `${utils.matcherHint(`toBe${typeName}`, undefined, undefined)}\n\n` +
          `Expected: ${isNot ? "not " : ""}${typeName}\n` +
          `Received: ${getMessageTypeName(received)}`,
        actual: getMessageTypeName(received),
        expected: typeName,
      };
    }

    if (expected === undefined) {
      return {
        pass: true,
        message: () =>
          `${utils.matcherHint(`toBe${typeName}`, undefined, undefined)}\n\n` +
          `Expected: not ${typeName}\n` +
          `Received: ${typeName}`,
      };
    }

    const msg = received as BaseMessage;
    if (typeof expected === "string") {
      const contentPass = msg.content === expected;
      return {
        pass: contentPass,
        message: () =>
          `${utils.matcherHint(`toBe${typeName}`, undefined, undefined)}\n\n` +
          `Expected: ${typeName} with content ${utils.printExpected(expected)}\n` +
          `Received: ${typeName} with content ${utils.printReceived(msg.content)}`,
        actual: msg.content,
        expected,
      };
    }

    const fieldsPass = Object.entries(expected).every(([key, value]) =>
      this.equals((msg as any)[key], value)
    );
    return {
      pass: fieldsPass,
      message: () => {
        const receivedFields: Record<string, unknown> = {};
        for (const key of Object.keys(expected)) {
          receivedFields[key] = (msg as any)[key];
        }
        return (
          `${utils.matcherHint(`toBe${typeName}`, undefined, undefined)}\n\n` +
          `Expected: ${typeName} matching ${utils.printExpected(expected)}\n` +
          `Received: ${typeName} with ${utils.printReceived(receivedFields)}`
        );
      },
      actual: (() => {
        const receivedFields: Record<string, unknown> = {};
        for (const key of Object.keys(expected)) {
          receivedFields[key] = (msg as any)[key];
        }
        return receivedFields;
      })(),
      expected,
    };
  };
}

export const toBeHumanMessage = makeMessageTypeMatcher(
  "HumanMessage",
  HumanMessage.isInstance
);

export const toBeAIMessage = makeMessageTypeMatcher(
  "AIMessage",
  AIMessage.isInstance
);

export const toBeSystemMessage = makeMessageTypeMatcher(
  "SystemMessage",
  SystemMessage.isInstance
);

export const toBeToolMessage = makeMessageTypeMatcher(
  "ToolMessage",
  ToolMessage.isInstance
);

export function toHaveToolCalls(
  this: ExpectExtendThis,
  received: unknown,
  expected: Array<Record<string, unknown>>
): ExpectationResult {
  const { isNot, utils } = this;

  if (!AIMessage.isInstance(received)) {
    return {
      pass: false,
      message: () =>
        `${utils.matcherHint("toHaveToolCalls")}\n\n` +
        `Expected: AIMessage\n` +
        `Received: ${getMessageTypeName(received)}`,
    };
  }

  const actual = received.tool_calls ?? [];

  if (actual.length !== expected.length) {
    return {
      pass: false,
      message: () =>
        `${utils.matcherHint("toHaveToolCalls")}\n\n` +
        `Expected ${isNot ? "not " : ""}${expected.length} tool call(s), received ${actual.length}`,
      actual: actual.length,
      expected: expected.length,
    };
  }

  for (let i = 0; i < expected.length; i++) {
    const match = Object.entries(expected[i]).every(([key, value]) =>
      this.equals((actual[i] as any)[key], value)
    );
    if (!match) {
      return {
        pass: false,
        message: () => {
          const receivedFields: Record<string, unknown> = {};
          for (const key of Object.keys(expected[i])) {
            receivedFields[key] = (actual[i] as any)[key];
          }
          return (
            `${utils.matcherHint("toHaveToolCalls")}\n\n` +
            `Tool call at index ${i} did not match:\n` +
            `Expected: ${utils.printExpected(expected[i])}\n` +
            `Received: ${utils.printReceived(receivedFields)}`
          );
        },
        actual: actual[i],
        expected: expected[i],
      };
    }
  }

  return {
    pass: true,
    message: () =>
      `${utils.matcherHint("toHaveToolCalls")}\n\n` +
      `Expected AIMessage not to have matching tool calls`,
  };
}

export function toHaveToolCallCount(
  this: ExpectExtendThis,
  received: unknown,
  expected: number
): ExpectationResult {
  const { isNot, utils } = this;

  if (!AIMessage.isInstance(received)) {
    return {
      pass: false,
      message: () =>
        `${utils.matcherHint("toHaveToolCallCount")}\n\n` +
        `Expected: AIMessage\n` +
        `Received: ${getMessageTypeName(received)}`,
    };
  }

  const actual = received.tool_calls?.length ?? 0;
  const pass = actual === expected;

  return {
    pass,
    message: () =>
      `${utils.matcherHint("toHaveToolCallCount")}\n\n` +
      `Expected ${isNot ? "not " : ""}${expected} tool call(s)\n` +
      `Received: ${actual}`,
    actual,
    expected,
  };
}

export function toContainToolCall(
  this: ExpectExtendThis,
  received: unknown,
  expected: Record<string, unknown>
): ExpectationResult {
  const { isNot, utils } = this;

  if (!AIMessage.isInstance(received)) {
    return {
      pass: false,
      message: () =>
        `${utils.matcherHint("toContainToolCall")}\n\n` +
        `Expected: AIMessage\n` +
        `Received: ${getMessageTypeName(received)}`,
    };
  }

  const actual = received.tool_calls ?? [];
  const found = actual.some((tc) =>
    Object.entries(expected).every(([key, value]) =>
      this.equals((tc as any)[key], value)
    )
  );

  return {
    pass: found,
    message: () =>
      `${utils.matcherHint("toContainToolCall")}\n\n` +
      `Expected AIMessage ${isNot ? "not " : ""}to contain a tool call matching ${utils.printExpected(expected)}\n` +
      `Received tool calls: ${utils.printReceived(actual.map((tc) => ({ name: tc.name, id: tc.id })))}`,
    actual: actual.map((tc) => ({ name: tc.name, id: tc.id })),
    expected,
  };
}

export function toHaveToolMessages(
  this: ExpectExtendThis,
  received: unknown,
  expected: Array<Record<string, unknown>>
): ExpectationResult {
  const { isNot, utils } = this;

  if (!Array.isArray(received)) {
    return {
      pass: false,
      message: () =>
        `${utils.matcherHint("toHaveToolMessages")}\n\n` +
        `Expected an array of messages\n` +
        `Received: ${typeof received}`,
    };
  }

  const toolMessages = (received as BaseMessage[]).filter(
    ToolMessage.isInstance
  );

  if (toolMessages.length !== expected.length) {
    return {
      pass: false,
      message: () =>
        `${utils.matcherHint("toHaveToolMessages")}\n\n` +
        `Expected ${isNot ? "not " : ""}${expected.length} tool message(s), found ${toolMessages.length}`,
      actual: toolMessages.length,
      expected: expected.length,
    };
  }

  for (let i = 0; i < expected.length; i++) {
    const match = Object.entries(expected[i]).every(([key, value]) =>
      this.equals((toolMessages[i] as any)[key], value)
    );
    if (!match) {
      return {
        pass: false,
        message: () => {
          const receivedFields: Record<string, unknown> = {};
          for (const key of Object.keys(expected[i])) {
            receivedFields[key] = (toolMessages[i] as any)[key];
          }
          return (
            `${utils.matcherHint("toHaveToolMessages")}\n\n` +
            `Tool message at index ${i} did not match:\n` +
            `Expected: ${utils.printExpected(expected[i])}\n` +
            `Received: ${utils.printReceived(receivedFields)}`
          );
        },
        actual: toolMessages[i],
        expected: expected[i],
      };
    }
  }

  return {
    pass: true,
    message: () =>
      `${utils.matcherHint("toHaveToolMessages")}\n\n` +
      `Expected messages not to contain matching tool messages`,
  };
}

export function toHaveBeenInterrupted(
  this: ExpectExtendThis,
  received: unknown,
  expectedValue?: unknown
): ExpectationResult {
  const { isNot, utils } = this;

  const result = received as Record<string, any>;
  const interrupts = result?.__interrupt__;
  const hasInterrupt = Array.isArray(interrupts) && interrupts.length > 0;

  if (!hasInterrupt) {
    return {
      pass: false,
      message: () =>
        `${utils.matcherHint("toHaveBeenInterrupted")}\n\n` +
        `Expected result ${isNot ? "not " : ""}to have been interrupted\n` +
        `Received __interrupt__: ${utils.printReceived(interrupts)}`,
    };
  }

  if (expectedValue === undefined) {
    return {
      pass: true,
      message: () =>
        `${utils.matcherHint("toHaveBeenInterrupted")}\n\n` +
        `Expected result not to have been interrupted\n` +
        `Received ${interrupts.length} interrupt(s)`,
    };
  }

  const actualValue = interrupts[0]?.value;
  const valuePass = this.equals(actualValue, expectedValue);

  return {
    pass: valuePass,
    message: () =>
      `${utils.matcherHint("toHaveBeenInterrupted")}\n\n` +
      `Expected interrupt value: ${utils.printExpected(expectedValue)}\n` +
      `Received interrupt value: ${utils.printReceived(actualValue)}`,
    actual: actualValue,
    expected: expectedValue,
  };
}

export function toHaveStructuredResponse(
  this: ExpectExtendThis,
  received: unknown,
  expected?: Record<string, unknown>
): ExpectationResult {
  const { isNot, utils } = this;

  const result = received as Record<string, any>;
  const structuredResponse = result?.structuredResponse;
  const isDefined = structuredResponse !== undefined;

  if (!isDefined) {
    return {
      pass: false,
      message: () =>
        `${utils.matcherHint("toHaveStructuredResponse")}\n\n` +
        `Expected result ${isNot ? "not " : ""}to have a structured response\n` +
        `Received structuredResponse: undefined`,
    };
  }

  if (expected === undefined) {
    return {
      pass: true,
      message: () =>
        `${utils.matcherHint("toHaveStructuredResponse")}\n\n` +
        `Expected result not to have a structured response`,
    };
  }

  const fieldsPass = Object.entries(expected).every(([key, value]) =>
    this.equals(structuredResponse[key], value)
  );

  return {
    pass: fieldsPass,
    message: () =>
      `${utils.matcherHint("toHaveStructuredResponse")}\n\n` +
      `Expected structured response: ${utils.printExpected(expected)}\n` +
      `Received structured response: ${utils.printReceived(structuredResponse)}`,
    actual: structuredResponse,
    expected,
  };
}

/**
 * Returns the first message in the array matching the given message class.
 * Replaces the pattern: `messages.find(X.isInstance) as X`
 */
export function firstOfType<T extends BaseMessage>(
  messages: BaseMessage[],
  cls: { isInstance(obj: unknown): obj is T }
): T | undefined {
  for (const msg of messages) {
    if (cls.isInstance(msg)) {
      return msg;
    }
  }
  return undefined;
}

/**
 * Returns the last message in the array matching the given message class.
 * Replaces the pattern: `[...msgs].reverse().find(X.isInstance) as X`
 */
export function lastOfType<T extends BaseMessage>(
  messages: BaseMessage[],
  cls: { isInstance(obj: unknown): obj is T }
): T | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (cls.isInstance(msg)) {
      return msg;
    }
  }
  return undefined;
}

/**
 * Returns all messages in the array matching the given message class.
 * Replaces the pattern: `messages.filter(X.isInstance) as X[]`
 */
export function messagesOfType<T extends BaseMessage>(
  messages: BaseMessage[],
  cls: { isInstance(obj: unknown): obj is T }
): T[] {
  return messages.filter((msg): msg is T => cls.isInstance(msg));
}
