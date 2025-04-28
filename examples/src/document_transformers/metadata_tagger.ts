import { z } from "zod";
import { createMetadataTaggerFromZod } from "langchain/document_transformers/openai_functions";
import { ChatOpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

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
const taggedDocuments = await metadataTagger.transformDocuments(documents);

console.log(taggedDocuments);

/*
  [
    Document {
      pageContent: 'Review of The Bee Movie\n' +
        'By Roger Ebert\n' +
        'This is the greatest movie ever made. 4 out of 5 stars.',
      metadata: {
        movie_title: 'The Bee Movie',
        critic: 'Roger Ebert',
        tone: 'positive',
        rating: 4
      }
    },
    Document {
      pageContent: 'Review of The Godfather\n' +
        'By Anonymous\n' +
        '\n' +
        'This movie was super boring. 1 out of 5 stars.',
      metadata: {
        movie_title: 'The Godfather',
        critic: 'Anonymous',
        tone: 'negative',
        rating: 1,
        reliable: false
      }
    }
  ]
*/
