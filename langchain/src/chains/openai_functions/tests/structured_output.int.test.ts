import { test, expect } from "@jest/globals";
import { z } from "zod";

import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { createStructuredOutputChainFromZod } from "../structured_output.js";

test("structured output chain", async () => {
  const chain = createStructuredOutputChainFromZod(
    z.object({
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
    {
      prompt: new ChatPromptTemplate({
        promptMessages: [
          SystemMessagePromptTemplate.fromTemplate(
            "Generate details of a hypothetical person."
          ),
          HumanMessagePromptTemplate.fromTemplate(
            "Person description: {inputText}"
          ),
        ],
        inputVariables: ["inputText"],
      }),
      llm: new ChatOpenAI({ model: "gpt-3.5-turbo-0613", temperature: 0 }),
      outputKey: "person",
    }
  );

  const response = await chain.call({ inputText: "A man, living in Poland." });
  // console.log("response", response);

  expect(response.person).toHaveProperty("name");
  expect(response.person).toHaveProperty("surname");
  expect(response.person).toHaveProperty("age");
  expect(response.person).toHaveProperty("appearance");
  expect(response.person).toHaveProperty("shortBio");
  expect(response.person).toHaveProperty("age");
  expect(response.person).toHaveProperty("gender");
  expect(response.person).toHaveProperty("interests");
  expect(response.person.interests.length).toBeGreaterThan(0);
});
