import { test, expect } from "vitest";
import { getMessages } from "../event_source_parse.js";

const feed = (field: string, value: string) => {
  const line = new TextEncoder().encode(`${field}: ${value}`);
  const colon = line.indexOf(58);
  let retries: number[] = [];
  let messages: { retry?: number }[] = [];
  const onLine = getMessages(
    (msg) => messages.push({ retry: msg.retry }),
    undefined,
    (r) => retries.push(r)
  );
  onLine(line, colon);
  onLine(new Uint8Array(), 0);
  return { retries, messages };
};

test("parses a spec-compliant retry field", () => {
  const { retries, messages } = feed("retry", "3000");
  expect(retries).toEqual([3000]);
  expect(messages[0].retry).toBe(3000);
});

test("ignores retry values that are not pure ASCII digits", () => {
  for (const value of ["12abc", "-5", "12.5", "1e3", "+7", "1 2", ""]) {
    const { retries, messages } = feed("retry", value);
    expect(retries, value).toEqual([]);
    expect(messages[0].retry, value).toBeUndefined();
  }
});
