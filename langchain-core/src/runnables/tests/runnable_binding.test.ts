/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "@jest/globals";
import { StringOutputParser } from "../../output_parsers/string.js";
import { FakeChatModel, FakeStreamingLLM } from "../../utils/testing/index.js";

test("Bind kwargs to a runnable", async () => {
  const llm = new FakeChatModel({});
  const result = await llm
    .bind({ stop: ["testing"] })
    .pipe(new StringOutputParser())
    .invoke("Hi there!");
  console.log(result);
  expect(result).toEqual("testing");
});

test("Bind kwargs to a runnable with a batch call", async () => {
  const llm = new FakeChatModel({});
  const result = await llm
    .bind({ stop: ["testing"] })
    .pipe(new StringOutputParser())
    .batch(["Hi there!", "hey hey", "Hi there!", "hey hey"]);
  console.log(result);
  expect(result).toEqual(["testing", "testing", "testing", "testing"]);
});

test("Stream with RunnableBinding", async () => {
  const llm = new FakeStreamingLLM({}).bind({ stop: ["dummy"] });
  const stream = await llm.pipe(new StringOutputParser()).stream("Hi there!");
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});

test("Stream through a RunnableBinding if the bound runnable implements transform", async () => {
  const llm = new FakeStreamingLLM({}).bind({ stop: ["dummy"] });
  const outputParser = new StringOutputParser().bind({ callbacks: [] });
  const stream = await llm.pipe(outputParser).stream("Hi there!");
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});
