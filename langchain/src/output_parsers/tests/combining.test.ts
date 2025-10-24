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
    "Return the following 2 outputs, each formatted as described below. Include the delimiter characters "-----" in your response:

    -----Output 1-----
    You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

    "JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

    For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
    would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
    Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

    Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

    Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
    \`\`\`json
    {"type":"object","properties":{"url":{"type":"string","description":"A link to the resource"}},"required":["url"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
    \`\`\`
    -----

    -----Output 2-----
    Your response should match the following regex: /Confidence: (A|B|C), Explanation: (.*)/
    -----
    "
  `);

  expect(
    await parser.parse(
      `-----Output 0-----
{"url": "https://en.wikipedia.org/wiki/Paris"}
-----

-----Output 1-----
Confidence: A, Explanation: Because it is the capital of France.
-----`
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
