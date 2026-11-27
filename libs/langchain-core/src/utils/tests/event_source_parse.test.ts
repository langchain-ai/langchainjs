import { describe, expect, test } from "vitest";

import { getLines, getMessages } from "../event_source_parse.js";

/** Feeds `text` through both halves of the parser and returns what `onMessage` saw. */
function parse(text: string) {
  const messages: Array<Record<string, unknown>> = [];
  const onLine = getMessages((message) => messages.push({ ...message }));
  const push = getLines((line, fieldLength, flush) =>
    onLine(line, fieldLength, flush),
  );
  push(new TextEncoder().encode(text));
  push(new Uint8Array(), true);
  return { messages };
}

describe("getMessages", () => {
  test("dispatches a message for each block that carries fields", () => {
    const { messages } = parse("data: one\n\ndata: two\n\n");
    expect(messages.map((message) => message.data)).toEqual(["one", "two"]);
  });

  test("joins several data lines with a newline", () => {
    const { messages } = parse("data: one\ndata: two\n\n");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.data).toBe("one\ntwo");
  });

  test("dispatches nothing for a keep-alive comment", () => {
    const { messages } = parse(": ping\n\n");
    expect(messages).toEqual([]);
  });

  test("does not let a comment carry into the next message", () => {
    const { messages } = parse(": ping\n\ndata: after\n\n");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.data).toBe("after");
  });

  test("dispatches a last message that never got its blank line", () => {
    const { messages } = parse("data: last\n");
    expect(messages.map((message) => message.data)).toEqual(["last"]);
  });
});
