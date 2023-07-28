import { test } from "@jest/globals";
import { LLM } from "../../llms/base.js";
import { BaseChatModel } from "../../chat_models/base.js";
import { AIMessage, BaseMessage, ChatResult } from "../index.js";

class FakeLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }
}

class FakeChatModel extends BaseChatModel {
  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const text = "response";
    return {
      generations: [
        {
          message: new AIMessage(text),
          text,
        },
      ],
      llmOutput: {},
    };
  }
}

test("Test batch", async () => {
  const llm = new FakeLLM({});
  const results = await llm.batch(["Hi there!", "Hey hey"]);
  expect(results.length).toBe(2);
});

test("Test stream", async () => {
  const llm = new FakeLLM({});
  const stream = await llm.stream("Hi there!");
  const reader = stream
    .pipeThrough(new TextEncoderStream())
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
  }
});

test("Test chat model stream", async () => {
  const llm = new FakeChatModel({});
  const stream = await llm.streamBytes("Hi there!");
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    console.log(chunk);
    done = chunk.done;
  }
});
