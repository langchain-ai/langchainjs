import { expect, test } from "@jest/globals";

import { CombiningOutputParser } from "../combining.js";
import { StructuredOutputParser } from "../structured.js";
import { RegexParser } from "../regex.js";

test("CombiningOutputParser", async () => {
  const parser = new CombiningOutputParser(
    StructuredOutputParser.fromNamesAndDescriptions({
      url: "A link to the resource",
    }),
    new RegexParser(
      /Confidence: (A|B|C), Explanation: (.*)/,
      ["confidence", "explanation"],
      "noConfidence"
    )
  );

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
    "Return the following 2 outputs, each formatted as described below:

    Output 1:
    The output should be formatted as a JSON instance that conforms to the JSON schema below.

    As an example, for the schema {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
    the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of the schema. The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

    Here is the output schema:
    \`\`\`
    {"type":"object","properties":{"url":{"type":"string","description":"A link to the resource"}},"required":["url"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
    \`\`\`

    Output 2:
    Your response should match the following regex: /Confidence: (A|B|C), Explanation: (.*)/
    "
  `);

  expect(
    await parser.parse(
      `Output 0:
{"url": "https://en.wikipedia.org/wiki/Paris"}

Output 1:
Confidence: A, Explanation: Because it is the capital of France.`
    )
  ).toMatchInlineSnapshot(`
    {
      "confidence": "A",
      "explanation": "Because it is the capital of France.",
      "url": "https://en.wikipedia.org/wiki/Paris",
    }
  `);

  expect(
    await parser.parse(
      '```\n{"url": "https://en.wikipedia.org/wiki/Paris"}\n```\nConfidence: A, Explanation: Because it is the capital of France.'
    )
  ).toMatchInlineSnapshot(`
    {
      "confidence": "A",
      "explanation": "Because it is the capital of France.",
      "url": "https://en.wikipedia.org/wiki/Paris",
    }
  `);
});
