import { describe, test, expect } from "vitest";
import { parseJsonMarkdown } from "../json.js";

// A fence's info string is a language tag; Markdown compares tags
// case-insensitively and allows spaces around them.
describe("parseJsonMarkdown fence info string", () => {
  test("reads a JSON object out of an upper-case JSON fence", () => {
    expect(parseJsonMarkdown('```JSON\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonMarkdown('```JSON\n{"a":1}')).toEqual({ a: 1 });
    expect(
      parseJsonMarkdown('Here you go:\n```JSON\n{"a":1}\n```\nDone.')
    ).toEqual({
      a: 1,
    });
  });

  test("reads a JSON object out of a fence tag with surrounding spaces", () => {
    expect(parseJsonMarkdown('``` json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonMarkdown('```  JSON  \n{"a":1}\n```')).toEqual({ a: 1 });
  });

  test("reads a JSON object out of a mixed-case tag and a CRLF fence", () => {
    expect(parseJsonMarkdown('```Json\r\n{"a":1}\r\n```')).toEqual({ a: 1 });
    expect(parseJsonMarkdown('```json\r\n{"a":1}\r\n```')).toEqual({ a: 1 });
  });

  test("keeps reading a bare fence and unfenced text", () => {
    expect(parseJsonMarkdown('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonMarkdown('{"a":1}')).toEqual({ a: 1 });
  });

  test("does not treat another language tag as JSON", () => {
    // The tag is not JSON, so the payload is handed to the parser as-is and
    // strict parsing rejects it. This is the pre-existing behavior.
    expect(() =>
      parseJsonMarkdown('```javascript\n{"a":1}\n```', JSON.parse)
    ).toThrow();
    expect(() =>
      parseJsonMarkdown('```json5\n{"a":1}\n```', JSON.parse)
    ).toThrow();
  });
});
