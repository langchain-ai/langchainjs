import { describe, expect, test } from "vitest";

import { getLines, getMessages } from "../event_source_parse.js";

/** Feeds `text` through both halves of the parser and returns what `onMessage` saw. */
function parse(text: string, chunks?: string[]) {
  const messages: Array<Record<string, unknown>> = [];
  const onLine = getMessages((message) => messages.push({ ...message }));
  const push = getLines((line, fieldLength, flush) =>
    onLine(line, fieldLength, flush),
  );
  for (const chunk of chunks ?? [text]) {
    push(new TextEncoder().encode(chunk));
  }
  push(new Uint8Array(), true);
  return messages;
}

describe("getLines flush", () => {
  test("reports a last line the stream never terminated", () => {
    const messages = parse("data: last");
    expect(messages.map((message) => message.data)).toEqual(["last"]);
  });

  test("reports an unterminated line that arrived in its own chunk", () => {
    const messages = parse("", ["data: one\n\n", "data: partial"]);
    expect(messages.map((message) => message.data)).toEqual(["one", "partial"]);
  });

  test("still drops a trailing carriage return's newline", () => {
    const messages = parse("data: one\r\n\r\n");
    expect(messages.map((message) => message.data)).toEqual(["one"]);
  });

  test("reports a complete last line once, not twice", () => {
    const messages = parse("data: one\n");
    expect(messages.map((message) => message.data)).toEqual(["one"]);
  });

  test("an unterminated comment reports nothing", () => {
    expect(parse(": ping")).toEqual([]);
  });
});
