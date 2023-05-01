import { test } from "@jest/globals";
import { z } from "zod";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { StructuredInputParser } from "../structured.js";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import { PromptTemplate } from "../../prompts/index.js";

test("Test StructuredInputParser with a simple input", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
  const inputParser = StructuredInputParser.fromZodSchema(
    z.string().describe("a word")
  );
  const chain = new LLMChain({
    llm: chat,
    prompt: new PromptTemplate({
      template: `Answer the user's question factually and as best you can.

{input_format_instructions}

{input}

{query}`,
      inputVariables: ["query", "input"],
      partialVariables: {
        input_format_instructions: inputParser.getFormatInstructions(),
      },
    }),
  });

  const res = await chain.call({
    query: `How many letters does the input have?.`,
    input: await inputParser.parse("LangChain"),
  });

  console.log({ res });
});

test("Test StructuredInputParser with a more complex input", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
  const inputParser = StructuredInputParser.fromZodSchema(
    z
      .array(
        z.object({
          id: z.string().describe("the unique record id"),
          fields: z.object({
            title: z.string().describe("the book title"),
            seriesId: z
              .string()
              .describe("id of the series the book belongs to"),
            createdAt: z
              .string()
              .datetime()
              .describe("publication date of the book"),
            reprintedAt: z
              .string()
              .datetime()
              .describe("reprint date of the book")
              .optional(),
          }),
        })
      )
      .describe("an array of database records, each representing a book")
  );
  const chain = new LLMChain({
    llm: chat,
    prompt: new PromptTemplate({
      template: `Answer the user's question factually and as best you can.

{input_format_instructions}

{input}

{query}`,
      inputVariables: ["query", "input"],
      partialVariables: {
        input_format_instructions: inputParser.getFormatInstructions(),
      },
    }),
  });

  const inputData = await inputParser.parse([
    {
      id: "rec0",
      fields: {
        title: "Novel 1",
        seriesId: "1",
        createdAt: "1996-08-01T00:00:00.000Z",
        reprintedAt: "2014-08-01T00:00:00.000Z",
      },
    },
    {
      id: "rec1",
      fields: {
        title: "Novel 2",
        seriesId: "1",
        createdAt: "1999-08-01T00:00:00.000Z",
        reprintedAt: "2014-08-01T00:00:00.000Z",
      },
    },
    {
      id: "rec3",
      fields: {
        title: "Novel 3",
        seriesId: "2",
        createdAt: "2010-08-31T00:00:00.000Z",
      },
    },
    {
      id: "rec4",
      fields: {
        title: "Novel 4",
        seriesId: "2",
        createdAt: "2011-09-01T00:00:00.000Z",
      },
    },
  ]);

  const res = await chain.call({
    query: `List all the books published before 2000.`,
    input: inputData,
  });

  console.log({ res });
});

test("Test StructuredInputParser with a StructuredOutputParser", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
  const zodSchema = z
    .array(
      z.object({
        id: z.string().describe("the unique record id"),
        fields: z.object({
          title: z.string().describe("the book title"),
          seriesId: z.string().describe("id of the series the book belongs to"),
          createdAt: z
            .string()
            .datetime()
            .describe("publication date of the book"),
          reprintedAt: z
            .string()
            .datetime()
            .describe("reprint date of the book")
            .optional(),
        }),
      })
    )
    .describe("an array of database records, each representing a book");
  const inputParser = StructuredInputParser.fromZodSchema(zodSchema);
  const outputParser = StructuredOutputParser.fromZodSchema(zodSchema);
  const chain = new LLMChain({
    llm: chat,
    prompt: new PromptTemplate({
      template: `Answer the user's question factually and as best you can.

{input_format_instructions}

{input}

{output_format_instructions}

{query}`,
      inputVariables: ["query", "input"],
      partialVariables: {
        input_format_instructions: inputParser.getFormatInstructions(),
        output_format_instructions: outputParser.getFormatInstructions(),
      },
    }),
  });

  const inputData = await inputParser.parse([
    {
      id: "rec0",
      fields: {
        title: "Novel 1",
        seriesId: "1",
        createdAt: "1996-08-01T00:00:00.000Z",
        reprintedAt: "2014-08-01T00:00:00.000Z",
      },
    },
    {
      id: "rec1",
      fields: {
        title: "Novel 2",
        seriesId: "1",
        createdAt: "1999-08-01T00:00:00.000Z",
        reprintedAt: "2014-08-01T00:00:00.000Z",
      },
    },
    {
      id: "rec3",
      fields: {
        title: "Novel 3",
        seriesId: "2",
        createdAt: "2010-08-31T00:00:00.000Z",
      },
    },
    {
      id: "rec4",
      fields: {
        title: "Novel 4",
        seriesId: "2",
        createdAt: "2011-09-01T00:00:00.000Z",
      },
    },
  ]);

  const res = await chain.call({
    query: `List all the books published before 2000.`,
    input: inputData,
  });

  console.log(await outputParser.parse(res.text));
});
