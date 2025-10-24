import "web-streams-polyfill/polyfill";
import { test, expect } from "@jest/globals";
import { FakeStreamingLLM } from "../testing/index.js";
import { StringOutputParser } from "../../output_parsers/string.js";

test("Stream the entire way through", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm.pipe(new StringOutputParser()).stream("Hi there!");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});
