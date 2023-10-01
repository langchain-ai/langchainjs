/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from "@jest/globals";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { RunnableMap, RunnableSequence } from "../runnable/index.js";
import { Document } from "../../document.js";
import { RunLog } from "../../callbacks/handlers/log_stream.js";
import { FakeLLM, FakeRetriever, FakeChatModel } from "./lib.js";

test("Runnable streamLog method", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeLLM({});
  const runnable = promptTemplate.pipe(llm);
  const result = await runnable.streamLog({ input: "Hello world!" });
  let finalState;
  for await (const chunk of result) {
    if (finalState === undefined) {
      finalState = chunk;
    } else {
      finalState = finalState.concat(chunk);
    }
  }
  expect((finalState as RunLog).state.final_output).toEqual({
    output: "Hello world!",
  });
});

test("Runnable streamLog method with a more complicated sequence", async () => {
  const promptTemplate = ChatPromptTemplate.fromMessages<{
    documents: string;
    question: string;
  }>([
    SystemMessagePromptTemplate.fromTemplate(`You are a nice assistant.`),
    HumanMessagePromptTemplate.fromTemplate(
      `Context:\n{documents}\n\nQuestion:\n{question}`
    ),
  ]);
  const llm = new FakeChatModel({});
  const inputs = {
    question: (input: string) => input,
    documents: RunnableSequence.from([
      new FakeRetriever(),
      (docs: Document[]) => JSON.stringify(docs),
    ]),
    extraField: new FakeLLM({
      response: "testing",
    }).withConfig({ tags: ["only_one"] }),
  };
  const runnable = new RunnableMap({ steps: inputs })
    .pipe(promptTemplate)
    .pipe(llm);
  const stream = await runnable.streamLog(
    "Do you know the Muffin Man?",
    {},
    {
      includeTags: ["only_one"],
    }
  );
  let finalState;
  for await (const chunk of stream) {
    if (finalState === undefined) {
      finalState = chunk;
    } else {
      finalState = finalState.concat(chunk);
    }
  }
  expect((finalState as RunLog).state.logs.length).toEqual(1);
  expect(
    (finalState as RunLog).state.logs[0].final_output.generations[0][0].text
  ).toEqual("testing");
});
