import { test, expect } from "@jest/globals";
import { z } from "zod";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { AIMessage } from "@langchain/core/messages";

import { FunctionCallStructuredOutputParser } from "../structured_output.js";

test("structured output parser", async () => {
  const parser = new FunctionCallStructuredOutputParser(
    toJsonSchema(
      z.object({
        name: z.string().describe("Human name"),
        surname: z.string().describe("Human surname"),
        age: z.number().describe("Human age"),
        appearance: z.string().describe("Human appearance description"),
        shortBio: z.string().describe("Short bio secription"),
        university: z
          .string()
          .optional()
          .describe("University name if attended"),
        gender: z.string().describe("Gender of the human"),
        interests: z
          .array(z.string())
          .describe("json array of strings human interests"),
      })
    )
  );

  const result = await parser.parseResult([
    {
      text: "",
      message: new AIMessage({
        content: "",
        additional_kwargs: {
          function_call: {
            name: "",
            arguments: JSON.stringify({
              name: "Anna",
              surname: "Kowalska",
              age: 30,
              appearance:
                "Anna has shoulder-length brown hair and green eyes. She has a slim build and stands at around 5'6\" tall.",
              shortBio:
                "Anna is a kind and compassionate person who loves to help others. She works as a nurse at a local hospital in Poland. In her free time, she enjoys reading, cooking, and spending time with her friends and family. Anna is also passionate about traveling and exploring new places.",
              university: null,
              gender: "female",
              interests: ["reading", "cooking", "traveling"],
            }),
          },
        },
      }),
    },
  ]);

  // console.log("result", result);

  expect(result.name).toEqual("Anna");
  expect(result.surname).toEqual("Kowalska");
  expect(result.age).toEqual(30);
  expect(result).toHaveProperty("appearance");
  expect(result).toHaveProperty("shortBio");
  expect(result).not.toHaveProperty("university");
  expect(result.gender).toEqual("female");
  expect(result.interests.length).toEqual(3);
});

test("structured output parser with Zod input", async () => {
  const parser = new FunctionCallStructuredOutputParser({
    zodSchema: z.object({
      name: z.string().describe("Human name"),
      surname: z.string().describe("Human surname"),
      age: z.number().describe("Human age"),
      appearance: z.string().describe("Human appearance description"),
      shortBio: z.string().describe("Short bio secription"),
      university: z.string().optional().describe("University name if attended"),
      gender: z.string().describe("Gender of the human"),
      interests: z
        .array(z.string())
        .describe("json array of strings human interests"),
    }),
  });

  const result = await parser.parseResult([
    {
      text: "",
      message: new AIMessage({
        content: "",
        additional_kwargs: {
          function_call: {
            name: "",
            arguments: JSON.stringify({
              name: "Anna",
              surname: "Kowalska",
              age: 30,
              appearance:
                "Anna has shoulder-length brown hair and green eyes. She has a slim build and stands at around 5'6\" tall.",
              shortBio:
                "Anna is a kind and compassionate person who loves to help others. She works as a nurse at a local hospital in Poland. In her free time, she enjoys reading, cooking, and spending time with her friends and family. Anna is also passionate about traveling and exploring new places.",
              university: null,
              gender: "female",
              interests: ["reading", "cooking", "traveling"],
            }),
          },
        },
      }),
    },
  ]);

  // console.log("result", result);

  expect(result.name).toEqual("Anna");
  expect(result.surname).toEqual("Kowalska");
  expect(result.age).toEqual(30);
  expect(result).toHaveProperty("appearance");
  expect(result).toHaveProperty("shortBio");
  expect(result).not.toHaveProperty("university");
  expect(result.gender).toEqual("female");
  expect(result.interests.length).toEqual(3);
});
