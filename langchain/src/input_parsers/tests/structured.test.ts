import { z } from "zod";

import { expect, test } from "@jest/globals";

import { StructuredInputParser } from "../structured.js";

test("StructuredInputParser.fromNamesAndDescriptions", async () => {
  const parser = StructuredInputParser.fromNamesAndDescriptions({
    url: "A link to the resource",
  });

  // @ts-expect-error Intentionally test with bad value for non TS envs
  await expect(async () => await parser.parse("value")).rejects.toThrow();

  await expect(
    async () =>
      await parser.parse({
        badurl: "value",
      })
  ).rejects.toThrow();

  expect(
    await parser.parse({
      url: "value",
    })
  )
    .toEqual(`Here is the previously mentioned input data. Expect it to structurally and semantically match the previously given input schema:
\`\`\`json
${JSON.stringify({
  url: "value",
})}
\`\`\`
`);

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"The input data you receive will be a JSON value structured according to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, an array called "foo". "foo" is semantically described as "a list of test words" by the "description" meta-field, and the items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

If present, the "description" meta-field is the clearest source of semantic information for a schema property.
The property names themselves can be ambiguous, conflicting, or misleading.
Therefore, context from the "description" meta-field should override all other cues.

Here is the input data schema:
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

test("StructuredInputParser.fromZodSchema, parses and validates a simple input", async () => {
  const zodSchema = z.object({
    url: z.string().describe("A link to the resource"),
  });
  const parser = StructuredInputParser.fromZodSchema(zodSchema);

  // @ts-expect-error Intentionally test with bad value for non TS envs
  await expect(async () => await parser.parse("value")).rejects.toThrow();

  await expect(
    async () =>
      await parser.parse({
        // @ts-expect-error Intentionally test with bad value for non TS envs
        badurl: "value",
      })
  ).rejects.toThrow();

  expect(
    await parser.parse({
      url: "value",
    })
  )
    .toEqual(`Here is the previously mentioned input data. Expect it to structurally and semantically match the previously given input schema:
\`\`\`json
${JSON.stringify({
  url: "value",
})}
\`\`\`
`);
  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"The input data you receive will be a JSON value structured according to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, an array called "foo". "foo" is semantically described as "a list of test words" by the "description" meta-field, and the items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

If present, the "description" meta-field is the clearest source of semantic information for a schema property.
The property names themselves can be ambiguous, conflicting, or misleading.
Therefore, context from the "description" meta-field should override all other cues.

Here is the input data schema:
\`\`\`json
{"type":"object","properties":{"url":{"type":"string","description":"A link to the resource"}},"required":["url"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}
\`\`\`
"
`);
});

test("StructuredInputParser.fromZodSchema, parses and validates a more complex example with an enum", async () => {
  const zodSchema = z
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
          address: z.string().optional().describe("The address of the author"),
          stateProvince: z
            .nativeEnum(StateProvinceEnum)
            .optional()
            .describe("The state or province of the author"),
        })
      ),
    })
    .describe("Only One object");
  const parser = StructuredInputParser.fromZodSchema(zodSchema);

  await expect(
    async () =>
      await parser.parse({
        // @ts-expect-error Intentionally test with bad value for non TS envs
        badurl: "value",
      })
  ).rejects.toThrow();

  expect(
    await parser.parse({
      url: "value",
      title: "value",
      year: 2011,
      createdAt: "2023-03-29T16:07:09.600Z",
      createdAtDate: new Date("2023-03-29"),
      authors: [
        {
          name: "value",
          email: "value",
          stateProvince: StateProvinceEnum.Arizona,
        },
      ],
    })
  )
    .toEqual(`Here is the previously mentioned input data. Expect it to structurally and semantically match the previously given input schema:
\`\`\`json
${JSON.stringify({
  url: "value",
  title: "value",
  year: 2011,
  createdAt: "2023-03-29T16:07:09.600Z",
  createdAtDate: new Date("2023-03-29T00:00:00.000Z"),
  authors: [{ name: "value", email: "value", stateProvince: "AZ" }],
})}
\`\`\`
`);

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"The input data you receive will be a JSON value structured according to a given "JSON Schema" instance.

"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.
For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
would match an object with one required property, an array called "foo". "foo" is semantically described as "a list of test words" by the "description" meta-field, and the items within "foo" must be strings.
Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

If present, the "description" meta-field is the clearest source of semantic information for a schema property.
The property names themselves can be ambiguous, conflicting, or misleading.
Therefore, context from the "description" meta-field should override all other cues.

Here is the input data schema:
\`\`\`json
{"type":"object","properties":{"url":{"type":"string","description":"A link to the resource"},"title":{"type":"string","description":"A title for the resource"},"year":{"type":"number","description":"The year the resource was created"},"createdAt":{"type":"string","format":"date-time","description":"The date and time the resource was created"},"createdAtDate":{"type":"string","format":"date-time","description":"The date the resource was created"},"authors":{"type":"array","items":{"type":"object","properties":{"name":{"type":"string","description":"The name of the author"},"email":{"type":"string","description":"The email of the author"},"type":{"type":"string","enum":["author","editor"]},"address":{"type":"string","description":"The address of the author"},"stateProvince":{"type":"string","enum":["AL","AK","AZ"],"description":"The state or province of the author"}},"required":["name","email"],"additionalProperties":false}}},"required":["url","title","year","createdAt","authors"],"additionalProperties":false,"description":"Only One object","$schema":"http://json-schema.org/draft-07/schema#"}
\`\`\`
"
`);
});
