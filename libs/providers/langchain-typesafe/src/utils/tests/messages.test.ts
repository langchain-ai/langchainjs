import {
  AIMessage,
  ChatMessage,
  HumanMessage,
  RemoveMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { describe, expect, test } from "vitest";

import { renderMessage } from "../messages.js";

describe("renderMessage", () => {
  test("maps roles and keeps string content", () => {
    expect(renderMessage(new HumanMessage("Please help immediately."))).toBe(
      "user: Please help immediately."
    );
    expect(renderMessage(new AIMessage("Sure."))).toBe("assistant: Sure.");
    expect(renderMessage(new SystemMessage("Be terse."))).toBe(
      "system: Be terse."
    );
  });

  test("omits the message id", () => {
    const message = new HumanMessage({
      content: "hi",
      id: "MARKER_MESSAGE_ID",
    });
    expect(renderMessage(message)).not.toContain("MARKER_MESSAGE_ID");
  });

  test("renders a ToolMessage with its tool role and content", () => {
    const message = new ToolMessage({
      content: "Refund issued.",
      tool_call_id: "call_1",
    });
    expect(renderMessage(message)).toBe("tool#call_1: Refund issued.");
  });

  test("joins all-text content blocks with a newline", () => {
    const message = new HumanMessage({
      content: [
        { type: "text", text: "line one" },
        { type: "text", text: "line two" },
      ],
    });
    expect(renderMessage(message)).toBe("user: line one\nline two");
  });

  test("serializes an unrecognized content block rather than dropping it", () => {
    // A dropped block is context the classifier silently loses, which
    // surfaces as a confident wrong answer rather than an error.
    const message = new HumanMessage({
      content: [
        { type: "text", text: "look at this" },
        { type: "image_url", image_url: { url: "https://x.test/a.png" } },
      ],
    });
    const rendered = renderMessage(message);
    expect(rendered).toContain("look at this");
    expect(rendered).toContain("https://x.test/a.png");
  });

  test("renders empty content as a bare role prefix", () => {
    expect(renderMessage(new HumanMessage(""))).toBe("user: ");
  });

  test("preserves the tool name and its arguments", () => {
    // Load-bearing, measured live: dropping the arguments moves a question
    // answerable only from them to a confident WRONG answer, not an error.
    const message = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "issue_refund",
          args: { amount: 250, currency: "USD" },
          id: "call_1",
        },
      ],
    });
    expect(renderMessage(message)).toBe(
      'assistant: [called issue_refund#call_1 with {"amount":250,"currency":"USD"}]'
    );
  });

  test("renders every tool call when a message carries several", () => {
    const message = new AIMessage({
      content: "working on it",
      tool_calls: [
        { name: "lookup", args: { id: 1 }, id: "a" },
        { name: "refund", args: { amount: 250 }, id: "b" },
      ],
    });
    const rendered = renderMessage(message);
    expect(rendered).toContain("working on it");
    expect(rendered).toContain('[called lookup#a with {"id":1}]');
    expect(rendered).toContain('[called refund#b with {"amount":250}]');
  });

  test("keeps a refusal, which lives outside content", () => {
    // An assistant turn that only refuses has empty content; the refusal
    // text is in additional_kwargs. Dropping it renders `assistant: ` and
    // destroys the only thing worth classifying about that turn.
    const message = new AIMessage({
      content: "",
      additional_kwargs: { refusal: "I cannot help with that request." },
    });
    expect(renderMessage(message)).toBe(
      "assistant: [refused: I cannot help with that request.]"
    );
  });

  test("two calls to the same tool stay distinguishable by id", () => {
    // Order does not correlate a result with its call — the id does. If
    // the id is dropped, swapping which result belongs to which call
    // produces byte-identical classifier input for two conversations that
    // mean opposite things.
    const call = new AIMessage({
      content: "",
      tool_calls: [
        { name: "charge", args: { amount: 10 }, id: "a" },
        { name: "charge", args: { amount: 9999 }, id: "b" },
      ],
    });
    const okThenFail = [
      renderMessage(call),
      renderMessage(new ToolMessage({ content: "ok", tool_call_id: "a" })),
      renderMessage(
        new ToolMessage({ content: "declined", tool_call_id: "b" })
      ),
    ].join("\n");
    const failThenOk = [
      renderMessage(call),
      renderMessage(
        new ToolMessage({ content: "declined", tool_call_id: "a" })
      ),
      renderMessage(new ToolMessage({ content: "ok", tool_call_id: "b" })),
    ].join("\n");
    expect(okThenFail).not.toBe(failThenOk);
    expect(okThenFail).toContain("tool#a: ok");
    expect(failThenOk).toContain("tool#a: declined");
  });

  test("includes the message name when present", () => {
    const message = new HumanMessage({ content: "hi", name: "alice" });
    expect(renderMessage(message)).toBe("user (alice): hi");
  });

  test("maps a ChatMessage to its own role field, verbatim", () => {
    expect(renderMessage(new ChatMessage("hi", "assistant"))).toBe(
      "assistant: hi"
    );
    expect(renderMessage(new ChatMessage("hi", "moderator"))).toBe(
      "moderator: hi"
    );
  });

  test("honors __openai_role__ on a SystemMessage", () => {
    const message = new SystemMessage({
      content: "Be terse.",
      additional_kwargs: { __openai_role__: "developer" },
    });
    expect(renderMessage(message)).toBe("developer: Be terse.");
  });

  test("ignores __openai_role__ on a ToolMessage; role stays tool", () => {
    const message = new ToolMessage({
      content: "ok",
      tool_call_id: "call_1",
      additional_kwargs: { __openai_role__: "developer" },
    });
    expect(renderMessage(message)).toBe("tool#call_1: ok");
  });

  test("throws a TypeError when a SystemMessage's __openai_role__ is not a string", () => {
    const message = new SystemMessage({
      content: "Be terse.",
      additional_kwargs: { __openai_role__: 42 },
    });
    expect(() => renderMessage(message)).toThrow(TypeError);
  });

  test("throws for an unsupported message type, naming only the type", () => {
    // Raising rather than defaulting to a role is deliberate: a silently
    // mislabelled message yields a confident wrong classification.
    const message = new RemoveMessage({ id: "MARKER_REMOVE_MESSAGE_ID" });
    let thrown: unknown;
    try {
      renderMessage(message);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("remove");
  });

  test("a circular tool-call argument throws a content-free error, never V8's own", () => {
    // Regression pin for a real leak: JSON.stringify's own circular-
    // structure TypeError embeds the offending property's NAME (V8:
    // `property 'ssn' -> object with constructor 'Object'`). Tool-call args
    // are caller data, so that name is caller data too. `toBeInstanceOf`
    // alone can't tell our error from V8's own — both are TypeErrors — so
    // the exact-message assertion below is what actually distinguishes
    // them: only `renderJson`'s static ARGS_ERROR matches it, never a
    // message built from the circular value.
    const MARKER = "MARKER_DO_NOT_LEAK_12345";
    const circular: Record<string, unknown> = { q: "x" };
    circular[MARKER] = circular;
    const message = new AIMessage({
      content: "",
      tool_calls: [{ name: "search", args: circular, id: "call_9" }],
    });

    let thrown: unknown;
    try {
      renderMessage(message);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toBe(
      "TypeSafe tool-call arguments could not be serialized."
    );
  });

  test("a circular tool-call argument nested inside an array also throws the content-free error", () => {
    const MARKER = "MARKER_DO_NOT_LEAK_ARRAY_67890";
    const inner: Record<string, unknown> = { [MARKER]: "x" };
    const circularArray: unknown[] = [inner];
    inner.loop = circularArray;
    const message = new AIMessage({
      content: "",
      tool_calls: [{ name: "search", args: { items: circularArray }, id: "c" }],
    });

    let thrown: unknown;
    try {
      renderMessage(message);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toBe(
      "TypeSafe tool-call arguments could not be serialized."
    );
  });

  test("a BigInt tool-call argument also throws a content-free error", () => {
    // JSON.stringify rejects BigInt too. The same catch covers it, so the
    // message below must be the same static ARGS_ERROR, not one claiming
    // the cause was specifically a cycle.
    const MARKER = "MARKER_BIGINT_KEY";
    const message = new AIMessage({
      content: "",
      tool_calls: [{ name: "search", args: { [MARKER]: 10n }, id: "c" }],
    });

    let thrown: unknown;
    try {
      renderMessage(message);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    expect((thrown as Error).message).toBe(
      "TypeSafe tool-call arguments could not be serialized."
    );
  });

  test("does not false-positive on a non-cyclic DAG: the same object as two sibling args", () => {
    const shared = { q: "x" };
    const message = new AIMessage({
      content: "",
      tool_calls: [
        { name: "search", args: { a: shared, b: shared }, id: "call_9" },
      ],
    });
    expect(() => renderMessage(message)).not.toThrow();
  });
});
