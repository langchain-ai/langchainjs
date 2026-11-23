import { test, expect } from "vitest";
import { RunnableBranch } from "../branch.js";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import { FakeStreamingLLM } from "../../utils/testing/index.js";
import { RunnableSequence } from "../base.js";
import { StringOutputParser } from "../../output_parsers/string.js";
import { awaitAllCallbacks } from "../../callbacks/promises.js";

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
  // If callbacks are backgrounded
  await awaitAllCallbacks();
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
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.join("")).toContain("LANGCHAIN");

  const stream2 = await fullChain.stream({
    question: "What is up? Explain in one sentence",
  });

  const chunks2 = [];
  for await (const chunk of stream2) {
    chunks2.push(chunk);
  }
  expect(chunks2.length).toBeGreaterThan(1);
  expect(chunks2.join("")).toContain("GENERAL");
});

// A matched branch that returns a falsy value has still answered. Keying the default
// branch on the *output* rather than on "no condition matched" discarded that answer
// and silently ran the default instead (#11583).
test.each([
  ["zero", 0],
  ["empty string", ""],
  ["false", false],
  ["null", null],
  ["NaN", NaN],
  ["undefined", undefined],
])(
  "RunnableBranch invoke returns a falsy branch output (%s)",
  async (_name, falsy) => {
    let defaultRuns = 0;
    const branch = RunnableBranch.from([
      [(x: number) => x > 0, () => falsy],
      () => {
        defaultRuns += 1;
        return -1;
      },
    ]);

    expect(await branch.invoke(5)).toEqual(falsy);
    // Not just the wrong value: the default branch was actually executed.
    expect(defaultRuns).toBe(0);

    // The default still runs when no condition matches.
    expect(await branch.invoke(-5)).toBe(-1);
    expect(defaultRuns).toBe(1);
  }
);

test("RunnableBranch batch keeps falsy branch outputs", async () => {
  const branch = RunnableBranch.from([
    [(x: number) => x > 0 && x < 5, () => 0],
    [(x: number) => x > 5, () => NaN],
    () => -1,
  ]);
  expect(await branch.batch([1, 10, -1])).toEqual([0, NaN, -1]);
});

test("RunnableBranch stream already kept falsy branch outputs", async () => {
  // The streaming path keys its default on `stream === undefined`, so it never had
  // the bug; pinned here so the two paths cannot drift apart again.
  const branch = RunnableBranch.from([
    [(x: number) => x > 0, () => 0],
    () => -1,
  ]);
  const chunks = [];
  for await (const chunk of await branch.stream(5)) {
    chunks.push(chunk);
  }
  expect(chunks).toEqual([0]);
});
