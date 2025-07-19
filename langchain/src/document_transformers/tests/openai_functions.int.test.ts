import { z } from "zod";
import { expect, test } from "@jest/globals";

import { Document } from "@langchain/core/documents";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { createMetadataTaggerFromZod } from "../openai_functions.js";

const taggingChainTemplate = `Extract the desired information from the following passage.
Anonymous critics are actually Roger Ebert.

Passage:
{input}
`;

test("Test OpenAIFunctions MetadataTagger", async () => {
  const zodSchema = z.object({
    movie_title: z.string(),
    critic: z.string(),
    tone: z.enum(["positive", "negative"]),
    rating: z
      .optional(z.number())
      .describe("The number of stars the critic rated the movie"),
  });

  const metadataTagger = createMetadataTaggerFromZod(zodSchema, {
    llm: new ChatOpenAI({ model: "gpt-3.5-turbo" }),
    prompt: PromptTemplate.fromTemplate(taggingChainTemplate),
  });

  const documents = [
    new Document({
      pageContent:
        "Review of The Bee Movie\nBy Roger Ebert\nThis is the greatest movie ever made. 4 out of 5 stars.",
    }),
    new Document({
      pageContent:
        "Review of The Godfather\nBy Anonymous\n\nThis movie was super boring. 1 out of 5 stars.",
      metadata: { reliable: false },
    }),
  ];
  const newDocuments = await metadataTagger.transformDocuments(documents);
  // console.log(newDocuments);

  expect(newDocuments.length).toBe(2);
  expect(newDocuments[0].metadata.movie_title).toBe("The Bee Movie");
  expect(newDocuments[1].metadata.movie_title).toBe("The Godfather");
});
