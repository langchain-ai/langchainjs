import { test, expect } from "vitest";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { Document } from "../../documents/document.js";
import { RunLog } from "../../tracers/log_stream.js";
import { RunnableLambda, RunnableSequence, RunnableMap } from "../base.js";
import {
  FakeLLM,
  FakeChatModel,
  FakeRetriever,
} from "../../utils/testing/index.js";

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
  const retrieverOutputDocs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
  ];
  const inputs = {
    question: (input: string) => input,
    documents: RunnableSequence.from([
      new FakeRetriever({
        output: retrieverOutputDocs,
      }),
      (docs: Document[]) => JSON.stringify(docs),
    ]).withConfig({ runName: "CUSTOM_NAME" }),
    extraField: new FakeLLM({
      response: "testing",
    }).withConfig({ tags: ["only_one"] }),
  };

  const runnable = new RunnableMap({
    steps: inputs,
  })
    .pipe(promptTemplate)
    .pipe(llm);
  const stream = await runnable.streamLog(
    "Do you know the Muffin Man?",
    {},
    {
      includeTags: ["only_one"],
      includeNames: ["CUSTOM_NAME"],
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
  expect((finalState as RunLog).state.logs.FakeLLM).toBeDefined();
  expect(
    (finalState as RunLog).state.logs.FakeLLM.final_output.generations[0][0]
      .text
  ).toEqual("testing");
  expect((finalState as RunLog).state.logs.CUSTOM_NAME).toBeDefined();
  expect(
    (finalState as RunLog).state.logs.CUSTOM_NAME.final_output.output
  ).toEqual(JSON.stringify(retrieverOutputDocs));
});

const slowGenerator = RunnableLambda.from(async function* () {
  for (let i = 0; i < 10; i += 1) {
    yield `chunk-${i}`;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
});

test("Runnable streamLog returns when the consumer breaks early", async () => {
  const start = Date.now();
  let count = 0;
  for await (const patch of slowGenerator.streamLog("hello")) {
    expect(patch).toBeDefined();
    count += 1;
    if (count >= 1) break;
  }
  expect(count).toBe(1);
  expect(Date.now() - start).toBeLessThan(1000);
});

test("Runnable streamEvents v1 returns when the consumer breaks early", async () => {
  const start = Date.now();
  for await (const event of slowGenerator.streamEvents("hello", {
    version: "v1",
  })) {
    expect(event).toBeDefined();
    break;
  }
  expect(Date.now() - start).toBeLessThan(1000);
});

test("Runnable streamLog still streams every chunk to completion", async () => {
  const seen: string[] = [];
  for await (const patch of slowGenerator.streamLog("hello")) {
    for (const op of patch.ops) {
      if (op.path === "/streamed_output/-") {
        seen.push(op.value as string);
      }
    }
  }
  expect(seen).toHaveLength(10);
});
