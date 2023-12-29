/* eslint-disable no-promise-executor-return */

import { test } from "@jest/globals";
import { FakeStreamingLLM } from "../../utils/testing/index.js";
import { BytesOutputParser } from "../bytes.js";

test("BytesOutputParser", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm.pipe(new BytesOutputParser()).stream("Hi there!");
  const chunks = [];
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    chunks.push(decoder.decode(chunk));
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});
