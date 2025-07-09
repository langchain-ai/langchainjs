/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect, test } from "@jest/globals";
import { z } from "zod";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { Operation, applyPatch } from "@langchain/core/utils/json_patch";

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputFunctionsParser } from "../openai_functions.js";
import { HttpResponseOutputParser } from "../http_response.js";

const schema = z.object({
  setup: z.string().describe("The setup for the joke"),
  punchline: z.string().describe("The punchline to the joke"),
});

const modelParams = {
  functions: [
    {
      name: "joke",
      description: "A joke",
      parameters: toJsonSchema(schema),
    },
  ],
  function_call: { name: "joke" },
};

test("Streaming JSON patch", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(
    `tell me a long joke about {foo}`
  );
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  }).withConfig(modelParams);

  const parser = new JsonOutputFunctionsParser({ diff: true });
  const chain = prompt.pipe(model).pipe(parser);

  const stream = await chain.stream({
    foo: "bears",
  });

  const chunks = [];
  let aggregate: any = {};
  for await (const chunk of stream) {
    // console.log(chunk);
    chunks.push(chunk);
    aggregate = applyPatch(aggregate, chunk as Operation[]).newDocument;
  }

  expect(chunks.length).toBeGreaterThan(1);
  // console.log(aggregate);
  expect(aggregate.setup.length).toBeGreaterThan(1);
  expect(aggregate.punchline.length).toBeGreaterThan(1);
});

test("Streaming JSON patch with an event stream output parser", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(
    `tell me a long joke about {foo}`
  );
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  }).withConfig(modelParams);

  const jsonParser = new JsonOutputFunctionsParser({ diff: true });
  const parser = new HttpResponseOutputParser({
    outputParser: jsonParser,
    contentType: "text/event-stream",
  });
  const chain = prompt.pipe(model).pipe(parser);

  const stream = await chain.stream({
    foo: "bears",
  });

  const chunks = [];
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    // console.log(decoder.decode(chunk));
    chunks.push(chunk);
  }

  expect(chunks.length).toBeGreaterThan(1);
});

test("Streaming aggregated JSON", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(
    `tell me a long joke about {foo}`
  );
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  }).withConfig(modelParams);

  const parser = new JsonOutputFunctionsParser();
  const chain = prompt.pipe(model).pipe(parser);

  const stream = await chain.stream({
    foo: "bears",
  });

  const chunks = [];
  let aggregate: any = {};
  for await (const chunk of stream) {
    // console.log(chunk);
    chunks.push(chunk);
    aggregate = chunk;
  }

  expect(chunks.length).toBeGreaterThan(1);
  // console.log(aggregate);
  expect(aggregate.setup.length).toBeGreaterThan(1);
  expect(aggregate.punchline.length).toBeGreaterThan(1);
});
