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
"The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of the schema. The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Here is the output schema:
\`\`\`
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
"The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of the schema. The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Here is the output schema:
\`\`\`
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
"The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of the schema. The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Here is the output schema:
\`\`\`
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
"The output should be formatted as a JSON instance that conforms to the JSON schema below.

As an example, for the schema {{"properties": {{"foo": {{"title": "Foo", "description": "a list of strings", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of the schema. The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

Here is the output schema:
\`\`\`
{"type":"object","properties":{"url":{"type":"string","description":"A link to the resource"},"title":{"type":"string","description":"A title for the resource"},"year":{"type":"number","description":"The year the resource was created"},"createdAt":{"type":"string","format":"date-time","description":"The date and time the resource was created"},"createdAtDate":{"type":"string","format":"date-time","description":"The date the resource was created"},"authors":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"The name of the author"},"email":{"type":"string","description":"The email of the author"},"type":{"type":"string","enum":["author","editor"]},"address":{"type":"string","description":"The address of the author"},"stateProvince":{"type":"string","enum":["AL","AK","AZ"],"description":"The state or province of the author"}},"required":["name","email"],"additionalProperties":false}}},"required":["url","title","year","createdAt","authors"],"additionalProperties":false,"description":"Only One object","$schema":"http://json-schema.org/draft-07/schema#"}
\`\`\`
"
`);
});
