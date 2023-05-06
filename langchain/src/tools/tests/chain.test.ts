import { test, expect, jest } from "@jest/globals";

import { ChainTool } from "../chain.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { LLM } from "../../llms/base.js";
import { VectorDBQAChain } from "../../chains/vector_db_qa.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { FakeEmbeddings } from "../../embeddings/fake.js";

class FakeLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }
}

test("chain tool with llm chain and local callback", async () => {
  const calls: string[] = [];
  const handleToolStart = jest.fn(() => {
    calls.push("tool start");
  });
  const handleToolEnd = jest.fn(() => {
    calls.push("tool end");
  });
  const handleLLMStart = jest.fn(() => {
    calls.push("llm start");
  });
  const handleLLMEnd = jest.fn(() => {
    calls.push("llm end");
  });
  const handleChainStart = jest.fn(() => {
    calls.push("chain start");
  });
  const handleChainEnd = jest.fn(() => {
    calls.push("chain end");
  });

  const chain = new LLMChain({
    llm: new FakeLLM({}),
    prompt: PromptTemplate.fromTemplate("hello world"),
  });
  const tool = new ChainTool({ chain, name: "fake", description: "fake" });
  const result = await tool.call("hi", [
    {
      handleToolStart,
      handleToolEnd,
      handleLLMStart,
      handleLLMEnd,
      handleChainStart,
      handleChainEnd,
    },
  ]);
  expect(result).toMatchInlineSnapshot(`"hello world"`);
  expect(handleToolStart).toBeCalledTimes(1);
  expect(handleToolEnd).toBeCalledTimes(1);
  expect(handleLLMStart).toBeCalledTimes(1);
  expect(handleLLMEnd).toBeCalledTimes(1);
  expect(handleChainStart).toBeCalledTimes(1);
  expect(handleChainEnd).toBeCalledTimes(1);
  expect(calls).toMatchInlineSnapshot(`
    [
      "tool start",
      "chain start",
      "llm start",
      "llm end",
      "chain end",
      "tool end",
    ]
  `);
});

test("chain tool with vectordbqa chain", async () => {
  const calls: string[] = [];
  const handleToolStart = jest.fn(() => {
    calls.push("tool start");
  });
  const handleToolEnd = jest.fn(() => {
    calls.push("tool end");
  });
  const handleLLMStart = jest.fn(() => {
    calls.push("llm start");
  });
  const handleLLMEnd = jest.fn(() => {
    calls.push("llm end");
  });
  const handleChainStart = jest.fn(() => {
    calls.push("chain start");
  });
  const handleChainEnd = jest.fn(() => {
    calls.push("chain end");
  });

  const chain = VectorDBQAChain.fromLLM(
    new FakeLLM({}),
    await MemoryVectorStore.fromExistingIndex(new FakeEmbeddings())
  );
  const tool = new ChainTool({ chain, name: "fake", description: "fake" });
  const result = await tool.call("hi", [
    {
      handleToolStart,
      handleToolEnd,
      handleLLMStart,
      handleLLMEnd,
      handleChainStart,
      handleChainEnd,
    },
  ]);
  expect(result).toMatchInlineSnapshot(`
    "Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.



    Question: hi
    Helpful Answer:"
  `);
  expect(handleToolStart).toBeCalledTimes(1);
  expect(handleToolEnd).toBeCalledTimes(1);
  expect(handleLLMStart).toBeCalledTimes(1);
  expect(handleLLMEnd).toBeCalledTimes(1);
  expect(handleChainStart).toBeCalledTimes(3);
  expect(handleChainEnd).toBeCalledTimes(3);
  expect(calls).toMatchInlineSnapshot(`
    [
      "tool start",
      "chain start",
      "chain start",
      "chain start",
      "llm start",
      "llm end",
      "chain end",
      "chain end",
      "chain end",
      "tool end",
    ]
  `);
});
