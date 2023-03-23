import { test, expect } from "@jest/globals";
import { z } from "zod";

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
    "
  `);
});

test("StructuredOutputParser.fromZodSchema", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      url: z.string().describe("A link to the resource"),
      title: z.string().describe("A title for the resource"),
      authors: z.array(
        z.object({
          name: z.string().describe("The name of the author"),
          email: z.string().describe("The email of the author"),
        })
      ),
    })
  );

  expect(
    await parser.parse(
      '```json\n{"url": "value", "title": "value", "authors": [{"name": "value", "email": "value"}]}```'
    )
  ).toEqual({
    url: "value",
    title: "value",
    authors: [{ name: "value", email: "value" }],
  });

  expect(parser.getFormatInstructions()).toMatchInlineSnapshot(`
    "The output should be a markdown code snippet formatted in the following schema:

    \`\`\`json
    {
    	"url": string // A link to the resource
    	"title": string // A title for the resource
    	"authors": {
    		"name": string // The name of the author
    		"email": string // The email of the author
    	}[]
    }
    \`\`\` 
    "
  `);
});
