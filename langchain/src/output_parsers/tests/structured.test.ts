import { z } from "zod";

import { expect, test } from "@jest/globals";

import { StructuredOutputParser } from "../structured.js";

test("StructuredOutputParser.fromNamesAndDescriptions", async () => {
  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    url: "A link to the resource",
  });

  expect(await parser.parse('```\n{"url": "value"}```')).toEqual({
    url: "value",
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
\`\`\`json
{"type":"object","properties":{"url":{"type":"string","description":"A link to the resource"}},"required":["url"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
\`\`\`
"
`);
});

enum StateProvinceEnum {
  Alabama = "AL",
  Alaska = "AK",
  Arizona = "AZ",
}

test("StructuredOutputParser.fromZodSchema", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ url: z.string().describe("A link to the resource") })
  );

  expect(await parser.parse('```\n{"url": "value"}```')).toEqual({
    url: "value",
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
\`\`\`json
{"type":"object","properties":{"url":{"type":"string","description":"A link to the resource"}},"required":["url"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
\`\`\`
"
`);
});

test("StructuredOutputParser.fromZodSchema", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      answer: z.string().describe("answer to the user's question"),
      sources: z
        .array(z.string())
        .describe("sources used to answer the question, should be websites."),
    })
  );

  expect(
    await parser.parse(
      '```\n{"answer": "value", "sources": ["this-source"]}```'
    )
  ).toEqual({
    answer: "value",
    sources: ["this-source"],
  });

  expect(
    await parser.parse(
      '```json\n{"answer": "value", "sources": ["this-source"]}```'
    )
  ).toEqual({
    answer: "value",
    sources: ["this-source"],
  });

  expect(
    await parser.parse(
      'some other stuff```json\n{"answer": "value", "sources": ["this-source"]}```some other stuff at the end'
    )
  ).toEqual({
    answer: "value",
    sources: ["this-source"],
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
\`\`\`json
{"type":"object","properties":{"answer":{"type":"string","description":"answer to the user's question"},"sources":{"type":"array","items":{"type":"string"},"description":"sources used to answer the question, should be websites."}},"required":["answer","sources"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
\`\`\`
"
`);
});

test("StructuredOutputParser.fromZodSchema", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z
      .object({
        url: z.string().describe("A link to the resource"),
        title: z.string().describe("A title for the resource"),
        year: z.number().describe("The year the resource was created"),
        createdAt: z
          .string()
          .datetime()
          .describe("The date and time the resource was created"),
        createdAtDate: z.coerce
          .date()
          .describe("The date the resource was created")
          .optional(),
        authors: z.array(
          z.object({
            name: z.string().describe("The name of the author"),
            email: z.string().describe("The email of the author"),
            type: z.enum(["author", "editor"]).optional(),
            address: z
              .string()
              .optional()
              .describe("The address of the author"),
            stateProvince: z
              .nativeEnum(StateProvinceEnum)
              .optional()
              .describe("The state or province of the author"),
          })
        ),
      })
      .describe("Only One object")
  );

  expect(
    await parser.parse(
      '```\n{"url": "value", "title": "value", "year": 2011, "createdAt": "2023-03-29T16:07:09.600Z", "createdAtDate": "2023-03-29", "authors": [{"name": "value", "email": "value", "stateProvince": "AZ"}]}```'
    )
  ).toEqual({
    url: "value",
    title: "value",
    year: 2011,
    createdAt: "2023-03-29T16:07:09.600Z",
    createdAtDate: new Date("2023-03-29T00:00:00.000Z"),
    authors: [{ name: "value", email: "value", stateProvince: "AZ" }],
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
\`\`\`json
{"type":"object","properties":{"url":{"type":"string","description":"A link to the resource"},"title":{"type":"string","description":"A title for the resource"},"year":{"type":"number","description":"The year the resource was created"},"createdAt":{"type":"string","format":"date-time","description":"The date and time the resource was created"},"createdAtDate":{"type":"string","format":"date-time","description":"The date the resource was created"},"authors":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"The name of the author"},"email":{"type":"string","description":"The email of the author"},"type":{"type":"string","enum":["author","editor"]},"address":{"type":"string","description":"The address of the author"},"stateProvince":{"type":"string","enum":["AL","AK","AZ"],"description":"The state or province of the author"}},"required":["name","email"],"additionalProperties":false}}},"required":["url","title","year","createdAt","authors"],"additionalProperties":false,"description":"Only One object","$schema":"http://json-schema.org/draft-07/schema#"}
\`\`\`
"
`);
});
