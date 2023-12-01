/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from "zod";
import { test } from "@jest/globals";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import { RunnableSequence } from "../runnable/index.js";
import { OutputParserException } from "../output_parser.js";

import { FakeChatModel } from "./lib.js";
import { PromptTemplate } from "../../prompts/prompt.js";

test("Create a runnable sequence and run it", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ outputValue: z.string().describe("A test value") })
  );
  const text = `\`\`\`
{"outputValue": "testing"}
\`\`\``;
  const runnable = promptTemplate.pipe(llm).pipe(parser);
  const result = await runnable.invoke({ input: text });
  console.log(result);
  expect(result).toEqual({ outputValue: "testing" });
});

test("Create a runnable sequence with a static method with invalid output and catch the error", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ outputValue: z.string().describe("A test value") })
  );
  const runnable = RunnableSequence.from([promptTemplate, llm, parser]);
  await expect(async () => {
    const result = await runnable.invoke({ input: "Hello sequence!" });
    console.log(result);
  }).rejects.toThrow(OutputParserException);
});
