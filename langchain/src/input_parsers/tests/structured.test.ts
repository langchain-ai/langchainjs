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
"The input data you receive will be structured according to the following schema.
If present, the clearest source of semantic information for each field is the provided description (starting with "//") immediately following the field.
The field names themselves or inferences from the schema structure can be ambiguous or misleading.
Therefore, this description should override information from all other contexts.

Input data schema:
\`\`\`json
{
	"url": string // A link to the resource
}
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
"The input data you receive will be structured according to the following schema.
If present, the clearest source of semantic information for each field is the provided description (starting with "//") immediately following the field.
The field names themselves or inferences from the schema structure can be ambiguous or misleading.
Therefore, this description should override information from all other contexts.

Input data schema:
\`\`\`json
{
	"url": string // A link to the resource
}
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
"The input data you receive will be structured according to the following schema.
If present, the clearest source of semantic information for each field is the provided description (starting with "//") immediately following the field.
The field names themselves or inferences from the schema structure can be ambiguous or misleading.
Therefore, this description should override information from all other contexts.

Input data schema:
\`\`\`json
{ // Only One object
	"url": string // A link to the resource
	"title": string // A title for the resource
	"year": number // The year the resource was created
	"createdAt": datetime // The date and time the resource was created
	"createdAtDate": date // Optional // The date the resource was created
	"authors": {
		"name": string // The name of the author
		"email": string // The email of the author
		"type": "author" | "editor" // Optional
		"address": string // Optional // The address of the author
		"stateProvince": "AL" | "AK" | "AZ" // Optional // The state or province of the author
	}[]
}
\`\`\`
"
`);
});
