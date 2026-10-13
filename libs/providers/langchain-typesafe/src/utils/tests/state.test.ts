import {
  AIMessage,
  HumanMessage,
  RemoveMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { describe, expect, test } from "vitest";

import { serializeState } from "../state.js";

describe("serializeState", () => {
  test("rejects scalars, null and undefined at the root", () => {
    for (const bad of [null, undefined, 42, 3.14, true, false]) {
      expect(() => serializeState(bad as never)).toThrow(/TypeSafe state/);
    }
  });

  test("rejects values JSON cannot express at all, anywhere", () => {
    // bigint, function and symbol have no JSON form, so `JSON.stringify`
    // either throws or drops them silently. Rejecting them by name is the
    // only way the caller learns the value never reached the classifier.
    for (const bad of [10n, () => 1, Symbol("s")]) {
      expect(() =>
        serializeState({ ticket: { attachment: bad } } as never)
      ).toThrow(/Unsupported TypeSafe state value/);
    }
    // A non-plain object at the ROOT is still rejected, because the API
    // requires a string, object or array there.
    expect(() => serializeState(new Map() as never)).toThrow(/TypeSafe state/);
  });

  test("converts a Date and rejects every other non-plain object by name", () => {
    // A Date has one unambiguous JSON form and is useful context, so the
    // schema converts it. Everything else without a JSON form is rejected
    // rather than silently flattened: `JSON.stringify` turns a Map into
    // `{}`, which would shrink the classifier's input with no error.
    expect(serializeState({ when: new Date("2026-01-02T03:04:05Z") })).toEqual({
      when: "2026-01-02T03:04:05.000Z",
    });
    class Ticket {
      id = 7;
    }
    const rejected: [string, unknown][] = [
      ["Map", new Map([["a", 1]])],
      ["Set", new Set([1])],
      ["Ticket", new Ticket()],
      ["bigint", 10n],
      ["function", () => 1],
    ];
    for (const [name, value] of rejected) {
      expect(() => serializeState({ k: value } as never)).toThrow(
        `Unsupported TypeSafe state value: ${name}.`
      );
    }
    // The name is the deepest failure, not the outermost container.
    expect(() => serializeState({ a: [[{ b: new Set() }]] } as never)).toThrow(
      "Unsupported TypeSafe state value: Set."
    );
  });

  test("numeric-looking keys pass through; a symbol key is rejected", () => {
    // Object keys are always strings in JavaScript, so Python's
    // non-string-key check has no counterpart — a numeric-looking key is
    // already a string and survives unchanged.
    expect(serializeState({ 1: "one", nested: { 2: "two" } })).toEqual({
      "1": "one",
      nested: { "2": "two" },
    });

    // A symbol key has no JSON form. `JSON.stringify` drops it silently;
    // the schema rejects the object instead, because a silent drop is the
    // failure this package exists to avoid.
    const withSymbol: Record<string | symbol, unknown> = { kept: "yes" };
    withSymbol[Symbol("dropped")] = "no";
    expect(() => serializeState(withSymbol as never)).toThrow(
      /Unsupported TypeSafe state value/
    );
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
  });

  test("does not false-positive on a non-cyclic DAG: the same object as two siblings", () => {
    // `JSON.stringify` rejects only a reference to one of a value's own
    // ancestors, so a shared reference appearing twice as siblings is fine.
    // Pinned because any hand-rolled replacement for it would have to get
    // that distinction right, and the obvious "ever visited" set does not.
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
