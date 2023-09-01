/* eslint-disable no-process-env */
import { test } from "@jest/globals";

import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { LLM } from "../../llms/base.js";
import { CallbackManager, traceAsGroup, TraceGroup } from "../manager.js";
import { ChainTool } from "../../tools/chain.js";

class FakeLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }
}

test("Test grouping traces", async () => {
  process.env.LANGCHAIN_TRACING_V2 = "true";
  const chain = new LLMChain({
    llm: new FakeLLM({}),
    prompt: PromptTemplate.fromTemplate("hello world"),
  });

  const nextChain = new LLMChain({
    llm: new FakeLLM({}),
    prompt: PromptTemplate.fromTemplate("This is the day"),
  });

  const tool = new ChainTool({ chain, name: "fake", description: "fake" });

  const result = await traceAsGroup(
    { name: "my_chain_group" },
    async (manager: CallbackManager, arg1: string, { chain, nextChain }) => {
      const result = await chain.call({ input: arg1 }, manager);
      const nextResult = await nextChain.call(result, manager);
      const toolResult = await tool.call(nextResult, manager);
      return toolResult;
    },
    "I'm arg1",
    { chain, nextChain }
  );

  console.log(result);
});

test("Test TraceGroup object", async () => {
  const traceGroup = new TraceGroup("my_trace_group");

  const childManager = await traceGroup.start({ input: "Hello, World" });
  const prompt = PromptTemplate.fromTemplate("Hello, world!");
  const result = await prompt.invoke({}, { callbacks: childManager });
  await traceGroup.end({ value: result.value });
  expect(result.value).toBe("Hello, world!");
});
