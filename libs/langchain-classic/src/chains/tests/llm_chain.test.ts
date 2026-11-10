import { test, expect } from "vitest";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { FakeLLM } from "@langchain/core/utils/testing";
import { LLMChain } from "../llm_chain.js";

test("LLMChain.serialize() serializes a PromptTemplate prompt", () => {
  const chain = new LLMChain({
    llm: new FakeLLM({}),
    prompt: PromptTemplate.fromTemplate("Tell me about {topic}"),
  });

  expect(chain.serialize()).toMatchObject({
    _type: "llm_chain",
    llm: { _type: "fake" },
    prompt: {
      _type: "prompt",
      input_variables: ["topic"],
      template: "Tell me about {topic}",
    },
  });
});

test("LLMChain.serialize() throws a clear error for a prompt it cannot serialize", () => {
  const chain = new LLMChain({
    llm: new FakeLLM({}),
    prompt: ChatPromptTemplate.fromMessages([["human", "{topic}"]]),
  });

  expect(() => chain.serialize()).toThrow(
    'LLMChain cannot serialize a "chat" prompt. Use .toJSON() instead.'
  );
});

test("LLMChain.deserialize() points to .toJSON()", async () => {
  await expect(
    LLMChain.deserialize({
      _type: "llm_chain",
      llm: { _type: "fake", _model: "base_llm" },
      prompt: { _type: "prompt", input_variables: [], template: "Hi" },
    })
  ).rejects.toThrow("Use .toJSON() instead");
});
