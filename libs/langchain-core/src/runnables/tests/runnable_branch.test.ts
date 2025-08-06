/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test, expect } from "vitest";
import { RunnableBranch } from "../branch.js";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import { FakeStreamingLLM } from "../../utils/testing/index.js";
import { RunnableSequence } from "../base.js";
import { StringOutputParser } from "../../output_parsers/string.js";

test("RunnableBranch invoke", async () => {
  const condition = (x: number) => x > 0;
  const add = (x: number) => x + 1;
  const subtract = (x: number) => x - 1;
  const branch = RunnableBranch.from([
    [condition, add],
    [condition, add],
    subtract,
  ]);
  const result = await branch.invoke(1);
  expect(result).toEqual(2);
  const result2 = await branch.invoke(-1);
  expect(result2).toEqual(-2);
});

test("RunnableBranch batch", async () => {
  const branch = RunnableBranch.from([
    [(x: number) => x > 0 && x < 5, (x: number) => x + 1],
    [(x: number) => x > 5, (x: number) => x * 10],
    (x: number) => x - 1,
  ]);
  const batchResult = await branch.batch([1, 10, 0]);
  expect(batchResult).toEqual([2, 100, -1]);
});

test("RunnableBranch handles error", async () => {
  let error;
  const branch = RunnableBranch.from([
    [
      (x: string) => x.startsWith("a"),
      () => {
        throw new Error("Testing");
      },
    ],
    (x) => `${x} passed`,
  ]);
  const result = await branch.invoke("branch", {
    callbacks: [
      {
        handleChainError: (e) => {
          error = e;
        },
      },
    ],
  });
  // If callbacks are backgrounded
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(result).toBe("branch passed");
  expect(error).toBeUndefined();
  await expect(async () => {
    await branch.invoke("alpha", {
      callbacks: [
        {
          handleChainError: (e) => {
            error = e;
          },
        },
      ],
    });
  }).rejects.toThrow();
  expect(error).toBeDefined();
});

test("RunnableBranch invoke", async () => {
  const promptTemplate = ChatPromptTemplate.fromTemplate(`{question}`);

  const model = new FakeStreamingLLM({
    sleep: 1,
  });
  const classificationChain = RunnableSequence.from([
    promptTemplate,
    model,
    new StringOutputParser(),
  ]);
  const generalChain =
    ChatPromptTemplate.fromTemplate(`GENERAL CHAIN`).pipe(model);
  const langChainChain =
    ChatPromptTemplate.fromTemplate(`LANGCHAIN CHAIN`).pipe(model);

  const branch = RunnableBranch.from([
    [
      (x: { topic: string; question: string }) =>
        x.topic.toLowerCase().includes("langchain"),
      langChainChain,
    ],
    generalChain,
  ]);
  const fullChain = RunnableSequence.from([
    {
      topic: classificationChain,
      question: (input: { question: string }) => input.question,
    },
    branch,
    new StringOutputParser(),
  ]);

  const stream = await fullChain.stream({
    question: "How do I use langchain? Explain in one sentence",
  });

  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.join("")).toContain("LANGCHAIN");

  const stream2 = await fullChain.stream({
    question: "What is up? Explain in one sentence",
  });

  const chunks2 = [];
  for await (const chunk of stream2) {
    console.log(chunk);
    chunks2.push(chunk);
  }
  expect(chunks2.length).toBeGreaterThan(1);
  expect(chunks2.join("")).toContain("GENERAL");
});
