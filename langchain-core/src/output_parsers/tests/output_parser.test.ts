/* eslint-disable no-promise-executor-return */

import { test } from "@jest/globals";
import { LLM } from "../../language_models/llms.js";
import { BytesOutputParser } from "../bytes.js";
import { GenerationChunk } from "../../outputs.js";

class FakeStreamingLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }

  async *_streamResponseChunks(input: string) {
    for (const c of input) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield { text: c, generationInfo: {} } as GenerationChunk;
    }
  }
}

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
