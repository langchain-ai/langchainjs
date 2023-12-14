/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { StringOutputParser } from "../../output_parsers/string.js";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "../../prompts/chat.js";
import {
  FakeLLM,
  FakeChatModel,
  FakeRetriever,
} from "../../utils/testing/index.js";
import { RunnableSequence, RunnableMap } from "../base.js";
import { RunnablePassthrough } from "../passthrough.js";

test("Create a runnable sequence with a runnable map", async () => {
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
    extraField: new FakeLLM({}),
  };
  const runnable = new RunnableMap({ steps: inputs })
    .pipe(promptTemplate)
    .pipe(llm);
  const result = await runnable.invoke("Do you know the Muffin Man?");
  console.log(result);
  expect(result.content).toEqual(
    `You are a nice assistant.\nContext:\n[{"pageContent":"foo","metadata":{}},{"pageContent":"bar","metadata":{}}]\n\nQuestion:\nDo you know the Muffin Man?`
  );
});

test("Test map inference in a sequence", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(
    "context: {context}, question: {question}"
  );
  const chain = RunnableSequence.from([
    {
      question: new RunnablePassthrough(),
      context: async () => "SOME STUFF",
    },
    prompt,
    new FakeLLM({}),
    new StringOutputParser(),
  ]);
  const response = await chain.invoke("Just passing through.");
  console.log(response);
  expect(response).toBe(
    `Human: context: SOME STUFF, question: Just passing through.`
  );
});

test("Should not allow mismatched inputs", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(
    "context: {context}, question: {question}"
  );
  const badChain = RunnableSequence.from([
    {
      // @ts-expect-error TS compiler should flag mismatched input types
      question: new FakeLLM({}),
      context: async (input: number) => input,
    },
    prompt,
    new FakeLLM({}),
    new StringOutputParser(),
  ]);
  console.log(badChain);
});

test("Should not allow improper inputs into a map in a sequence", async () => {
  const prompt = ChatPromptTemplate.fromTemplate(
    "context: {context}, question: {question}"
  );
  const map = RunnableMap.from({
    question: new FakeLLM({}),
    context: async (_input: string) => 9,
  });
  // @ts-expect-error TS compiler should flag mismatched output types
  const runnable = prompt.pipe(map);
  console.log(runnable);
});

test("Should not allow improper outputs from a map into the next item in a sequence", async () => {
  const map = RunnableMap.from({
    question: new FakeLLM({}),
    context: async (_input: string) => 9,
  });
  // @ts-expect-error TS compiler should flag mismatched output types
  const runnable = map.pipe(new FakeLLM({}));
  console.log(runnable);
});
