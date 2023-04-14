import { z } from "zod";

import { expect, test } from "@jest/globals";

import { StructuredOutputParser } from "../structured.js";

test("StructuredOutputParser.fromNamesAndDescriptions", async () => {
  const parser = StructuredOutputParser.fromNamesAndDescriptions({
    url: "A link to the resource",
  });

  expect(await parser.parse('```json\n{"url": "value"}```')).toEqual({
    url: "value",
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"The output should be a markdown code snippet formatted in the following schema:

\`\`\`json
{
	"url": string // A link to the resource
}
\`\`\`

Including the leading and trailing "\`\`\`json" and "\`\`\`"
"
`);
});

test("StructuredOutputParser.fromZodSchema", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ url: z.string().describe("A link to the resource") })
  );

  expect(await parser.parse('```json\n{"url": "value"}```')).toEqual({
    url: "value",
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"The output should be a markdown code snippet formatted in the following schema:

\`\`\`json
{
	"url": string // A link to the resource
}
\`\`\`

Including the leading and trailing "\`\`\`json" and "\`\`\`"
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
      '```json\n{"answer": "value", "sources": ["this-source"]}```'
    )
  ).toEqual({
    answer: "value",
    sources: ["this-source"],
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"The output should be a markdown code snippet formatted in the following schema:

\`\`\`json
{
	"answer": string // answer to the user's question
	"sources": string[] // sources used to answer the question, should be websites.
}
\`\`\`

Including the leading and trailing "\`\`\`json" and "\`\`\`"
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
            address: z
              .string()
              .optional()
              .describe("The address of the author"),
          })
        ),
      })
      .describe("Only One object")
  );

  expect(
    await parser.parse(
      '```json\n{"url": "value", "title": "value", "year": 2011, "createdAt": "2023-03-29T16:07:09.600Z", "createdAtDate": "2023-03-29", "authors": [{"name": "value", "email": "value"}]}```'
    )
  ).toEqual({
    url: "value",
    title: "value",
    year: 2011,
    createdAt: "2023-03-29T16:07:09.600Z",
    createdAtDate: new Date("2023-03-29T00:00:00.000Z"),
    authors: [{ name: "value", email: "value" }],
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
"The output should be a markdown code snippet formatted in the following schema:

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
		"address": string // Optional // The address of the author
	}[]
}
\`\`\`

Including the leading and trailing "\`\`\`json" and "\`\`\`"
"
`);
});
