// import { z } from "zod";
import { test } from "@jest/globals";
import { LLM } from "../../llms/base.js";
import {
  BaseChatModel,
  createChatMessageChunkEncoderStream,
} from "../../chat_models/base.js";
import { AIMessage, BaseMessage, ChatResult } from "../index.js";
import { PromptTemplate } from "../../prompts/index.js";
// import { StructuredOutputParser } from "../../output_parsers/structured.js";

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
    const text = `\`\`\`
{"outputValue": "testing"}
\`\`\``;
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
  const stream = await llm.stream("Hi there!");
  const reader = stream
    .pipeThrough(createChatMessageChunkEncoderStream())
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    console.log(chunk);
    done = chunk.done;
  }
});

test("Pipe from one runnable to the next", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeLLM({});
  const runnable = promptTemplate.pipe(llm);
  const result = await runnable.invoke({ input: "Hello world!" });
  console.log(result);
  expect(result).toBe("Hello world!");
});

test("Create a runnable sequence and run it", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  // const parser = StructuredOutputParser.fromZodSchema(
  //   z.object({ outputValue: z.string().describe("A test value") })
  // );
  const runnable = promptTemplate.pipe(llm);
  const result = await runnable.invoke({ input: "Hello sequence!" });
  console.log(result);
  expect(result).toBe({ outputValue: "testing" });
});
