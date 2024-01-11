/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { StringOutputParser } from "../../output_parsers/string.js";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "../../prompts/chat.js";
import { concat } from "../../utils/stream.js";
import {
  FakeLLM,
  FakeChatModel,
  FakeRetriever,
  FakeStreamingLLM,
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

test("Should stream chunks from each step as they are produced", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a nice assistant."],
    "{question}",
  ]);

  const chat = new FakeChatModel({});

  const llm = new FakeStreamingLLM({ sleep: 0 });

  const chain = RunnableSequence.from([
    prompt,
    RunnableMap.from({
      passthrough: new RunnablePassthrough(),
      chat,
      llm,
    }),
  ]);

  const stream = await chain.stream({ question: "What is your name?" });

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  expect(chunks.length).toBeGreaterThan(3);
  expect(chunks.reduce(concat)).toEqual(
    await chain.invoke({ question: "What is your name?" })
  );

  const chainWithSelect = chain.pipe((output) => output.llm);

  expect(await chainWithSelect.invoke({ question: "What is your name?" }))
    .toEqual(`System: You are a nice assistant.
Human: What is your name?`);
});

test("Should stream chunks through runnable passthrough and assign", async () => {
  const llm = new FakeStreamingLLM({ sleep: 0 });

  const chain = RunnableSequence.from([
    llm,
    RunnableMap.from({
      llm: new RunnablePassthrough(),
    }),
  ]);

  const stream = await chain.stream("What is your name?");

  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  expect(chunks).toEqual([
    { llm: "W" },
    { llm: "h" },
    { llm: "a" },
    { llm: "t" },
    { llm: " " },
    { llm: "i" },
    { llm: "s" },
    { llm: " " },
    { llm: "y" },
    { llm: "o" },
    { llm: "u" },
    { llm: "r" },
    { llm: " " },
    { llm: "n" },
    { llm: "a" },
    { llm: "m" },
    { llm: "e" },
    { llm: "?" },
  ]);
  expect(chunks.reduce(concat)).toEqual(
    await chain.invoke("What is your name?")
  );

  const chainWithAssign = chain.pipe(
    RunnablePassthrough.assign({
      chat: RunnableSequence.from([(input) => input.llm, llm]),
    })
  );

  const stream2 = await chainWithAssign.stream("What is your name?");

  const chunks2 = [];

  for await (const chunk of stream2) {
    chunks2.push(chunk);
  }

  expect(chunks2).toEqual([
    { llm: "W" },
    { llm: "h" },
    { llm: "a" },
    { llm: "t" },
    { llm: " " },
    { llm: "i" },
    { llm: "s" },
    { llm: " " },
    { llm: "y" },
    { llm: "o" },
    { llm: "u" },
    { llm: "r" },
    { llm: " " },
    { llm: "n" },
    { llm: "a" },
    { llm: "m" },
    { llm: "e" },
    { llm: "?" },
    { chat: "W" },
    { chat: "h" },
    { chat: "a" },
    { chat: "t" },
    { chat: " " },
    { chat: "i" },
    { chat: "s" },
    { chat: " " },
    { chat: "y" },
    { chat: "o" },
    { chat: "u" },
    { chat: "r" },
    { chat: " " },
    { chat: "n" },
    { chat: "a" },
    { chat: "m" },
    { chat: "e" },
    { chat: "?" },
  ]);
  expect(chunks2.reduce(concat)).toEqual(
    await chainWithAssign.invoke("What is your name?")
  );

  const chainWithPick = chainWithAssign.pick("llm");

  const chunks3 = [];

  for await (const chunk of await chainWithPick.stream("What is your name?")) {
    chunks3.push(chunk);
  }

  expect(chunks3).toEqual([
    "W",
    "h",
    "a",
    "t",
    " ",
    "i",
    "s",
    " ",
    "y",
    "o",
    "u",
    "r",
    " ",
    "n",
    "a",
    "m",
    "e",
    "?",
  ]);
  expect(chunks3.reduce(concat)).toEqual(
    await chainWithPick.invoke("What is your name?")
  );

  const chainWithPickMulti = chainWithAssign.pick(["llm"]);

  const chunks4 = [];

  for await (const chunk of await chainWithPickMulti.stream(
    "What is your name?"
  )) {
    chunks4.push(chunk);
  }

  expect(chunks4).toEqual([
    { llm: "W" },
    { llm: "h" },
    { llm: "a" },
    { llm: "t" },
    { llm: " " },
    { llm: "i" },
    { llm: "s" },
    { llm: " " },
    { llm: "y" },
    { llm: "o" },
    { llm: "u" },
    { llm: "r" },
    { llm: " " },
    { llm: "n" },
    { llm: "a" },
    { llm: "m" },
    { llm: "e" },
    { llm: "?" },
  ]);
  expect(chunks4.reduce(concat)).toEqual(
    await chainWithPickMulti.invoke("What is your name?")
  );
});
