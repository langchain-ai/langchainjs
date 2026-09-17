import {
  AIMessage,
  HumanMessage,
  RemoveMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { describe, expect, test } from "vitest";

import { expectNoLeak } from "../../tests/helpers/no-leak.js";
import { serializeState } from "../state.js";

describe("serializeState", () => {
  test("rejects scalars, null and undefined at the root", () => {
    for (const bad of [null, undefined, 42, 3.14, true, false]) {
      expect(() => serializeState(bad as never)).toThrow(/TypeSafe state/);
    }
  });

  test("rejects unsupported values anywhere", () => {
    expect(() =>
      serializeState({ ticket: { attachment: new Set([1]) } } as never)
    ).toThrow(/Unsupported TypeSafe state value/);
    expect(() => serializeState(new Map() as never)).toThrow(/TypeSafe state/);
  });

  test("has no non-string-key case to reject, unlike Python", () => {
    // Python must reject dicts with non-string keys. JavaScript cannot
    // have them: every object key is a string or a symbol, and
    // Object.entries skips symbols entirely. Both cases are pinned here
    // so nobody adds a key-type check that can never fire.
    const numericLooking = { 1: "one", nested: { 2: "two" } };
    expect(serializeState(numericLooking)).toEqual({
      "1": "one",
      nested: { "2": "two" },
    });

    const withSymbol: Record<string | symbol, unknown> = { kept: "yes" };
    withSymbol[Symbol("dropped")] = "no";
    expect(serializeState(withSymbol as never)).toEqual({ kept: "yes" });
  });

  test("accepts a null-prototype object at the root and when nested", () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare.note = "hi";
    expect(serializeState(bare as never)).toEqual({ note: "hi" });
  });

  test("passes strings, arrays and objects through", () => {
    expect(serializeState("plain")).toBe("plain");
    expect(serializeState([])).toEqual([]);
    expect(serializeState(["one", 2, null])).toEqual(["one", 2, null]);
    expect(serializeState({ priority: 1, note: null })).toEqual({
      priority: 1,
      note: null,
    });
  });

  test("serializes a single message as a labelled transcript line", () => {
    expect(serializeState(new HumanMessage("Please help immediately."))).toBe(
      "user: Please help immediately."
    );
  });

  test("serializes a message sequence as a conversation array", () => {
    expect(
      serializeState([
        new SystemMessage("Be terse."),
        new HumanMessage("Hello"),
        new AIMessage("Hi"),
      ])
    ).toEqual(["system: Be terse.", "user: Hello", "assistant: Hi"]);
  });

  test("converts messages nested inside objects and arrays in place", () => {
    expect(
      serializeState({
        ticket: {
          priority: 2,
          messages: [new HumanMessage("a"), new AIMessage("b")],
          draft: new AIMessage("c"),
        },
      })
    ).toEqual({
      ticket: {
        priority: 2,
        messages: ["user: a", "assistant: b"],
        draft: "assistant: c",
      },
    });
  });

  test("serializes a tool message with its role and name", () => {
    expect(
      serializeState(
        new ToolMessage({
          content: "Search result",
          tool_call_id: "call_1",
          name: "search",
        })
      )
    ).toBe("tool#call_1 (search): Search result");
  });

  test("propagates the throw for an unsupported message type nested anywhere", () => {
    // Task 3 amended the message renderer to throw (rather than
    // silently degrade) for a message type with no OpenAI role, e.g. a
    // LangGraph RemoveMessage sentinel. serializeState must not catch or
    // filter that throw at any nesting depth: loud beats silent here.
    const MARKER = "MARKER_REMOVE_MESSAGE_ID";
    const remove = new RemoveMessage({ id: MARKER });
    expect(() => serializeState(remove)).toThrow(/"remove"/);

    let thrown: unknown;
    try {
      serializeState({ ticket: { messages: [remove] } } as never);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/"remove"/);
    expectNoLeak(thrown, MARKER);
  });

  test("throws a clean, content-free error for a self-referential object", () => {
    // Without cycle detection this recurses until the stack overflows,
    // non-deterministically surfacing either a RangeError or an
    // unrelated-looking TypeError from deep inside BaseMessage.isInstance.
    // LangGraph state is developer-assembled and can legitimately contain
    // cycles, so this must fail the same clean way every time — and,
    // unlike the historical `messages.ts` leak this guards against
    // elsewhere in the package, without naming the property that cycled.
    const MARKER = "MARKER_DO_NOT_LEAK_STATE_OBJECT";
    const cyclic: Record<string, unknown> = {};
    cyclic[MARKER] = cyclic;

    let thrown: unknown;
    try {
      serializeState(cyclic as never);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toBe(
      "Circular reference detected in TypeSafe state."
    );
    expectNoLeak(thrown, MARKER);
  });

  test("throws a clean, content-free error for a self-referential array", () => {
    const MARKER = "MARKER_DO_NOT_LEAK_STATE_ARRAY";
    const cyclic: unknown[] = [{ [MARKER]: "x" }];
    cyclic.push(cyclic);

    let thrown: unknown;
    try {
      serializeState(cyclic as never);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toBe(
      "Circular reference detected in TypeSafe state."
    );
    expectNoLeak(thrown, MARKER);
  });

  test("does not false-positive on a non-cyclic DAG: the same object as two siblings", () => {
    // The easy thing to break when adding cycle detection: a WeakSet that
    // tracks "ever visited" rather than "on the current path" would wrongly
    // reject this, since `shared` legitimately appears twice.
    const shared = { note: "hi" };
    const sharedMessages = [new HumanMessage("hi")];
    expect(
      serializeState({
        a: shared,
        b: shared,
        firstThread: sharedMessages,
        secondThread: sharedMessages,
      })
    ).toEqual({
      a: { note: "hi" },
      b: { note: "hi" },
      firstThread: ["user: hi"],
      secondThread: ["user: hi"],
    });
  });
});
