import { test, expect } from "@jest/globals";
import { BaseLLM } from "../../llms/base.js";
import { LLMResult } from "../../schema/index.js";
import { LLMChain } from "../llm_chain.js";
import { PromptTemplate } from "../../prompts/index.js";
import { SequentialChain } from "../sequential_chain.js";

class FakeLLM1 extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake_1";
  }

  async _generate(_prompts: string[]): Promise<LLMResult> {
    return {
      generations: [
        [
          {
            text: "The answer is XXX.",
          },
        ],
      ],
    };
  }
}

class FakeLLM2 extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake_2";
  }

  async _generate(prompts: string[]): Promise<LLMResult> {
    let response = "I don't know what you are talking about.";
    if (prompts[0].includes("XXX")) {
      response = "final answer";
    }
    return {
      generations: [
        [
          {
            text: response,
          },
        ],
      ],
    };
  }
}

test("Test SequentialChain", async () => {
  const model1 = new FakeLLM1({});
  const model2 = new FakeLLM2({});
  const template1 = "Some arbitrary template with fake {input1} and {input2}.";
  const template2 = "Some arbitrary template with fake {input3}.";
  const prompt1 = new PromptTemplate({
    template: template1,
    inputVariables: ["input1", "input2"],
  });
  const prompt2 = new PromptTemplate({
    template: template2,
    inputVariables: ["input3"],
  });
  const chain1 = new LLMChain({
    llm: model1,
    prompt: prompt1,
    outputKey: "input3",
  });
  const chain2 = new LLMChain({ llm: model2, prompt: prompt2 });
  const combinedChain = new SequentialChain({
    chains: [chain1, chain2],
    inputVariables: ["input1", "input2"],
    outputVariables: ["text"],
  });
  const response = await combinedChain.call({
    input1: "test1",
    input2: "test2",
  });
  expect(response).toMatchInlineSnapshot(`
    {
      "text": "final answer",
    }
  `);
});

test("Test SequentialChain input/output chains' validation", () => {
  const model1 = new FakeLLM1({});
  const template1 = "Some arbitrary template with fake {input1} and {input2}.";
  const prompt1 = new PromptTemplate({
    template: template1,
    inputVariables: ["input1", "input2"],
  });
  const chain1 = new LLMChain({
    llm: model1,
    prompt: prompt1,
    outputKey: "input3",
  });
  const model2 = new FakeLLM2({});
  const template2 = "Some arbitrary template with fake {input3}.";
  const prompt2 = new PromptTemplate({
    template: template2,
    inputVariables: ["input3"],
  });
  const chain2 = new LLMChain({ llm: model2, prompt: prompt2 });

  expect(() => {
    /* eslint-disable no-new */
    new SequentialChain({
      chains: [chain1, chain2],
      inputVariables: ["input1"],
      outputVariables: ["text"],
    });
  }).toThrowErrorMatchingInlineSnapshot(
    `"Missing variables for chain "llm_chain": "input2". Only got the following variables: "input1"."`
  );
  expect(() => {
    /* eslint-disable no-new */
    new SequentialChain({
      chains: [chain1, chain2],
      inputVariables: ["input1", "input2"],
      outputVariables: ["nonexistent"],
    });
  }).toThrowErrorMatchingInlineSnapshot(
    `"The following output variables were expected to be in the final chain output but were not found: "nonexistent"."`
  );
});

test("Test SequentialChain chains' intermediate variables validation", () => {
  const model1 = new FakeLLM1({});
  const template1 = "Some arbitrary template with fake {input1} and {input2}.";
  const prompt1 = new PromptTemplate({
    template: template1,
    inputVariables: ["input1", "input2"],
  });
  const chain1 = new LLMChain({
    llm: model1,
    prompt: prompt1,
    outputKey: "nonexistent",
  });
  const model2 = new FakeLLM2({});
  const template2 = "Some arbitrary template with fake {input3}.";
  const prompt2 = new PromptTemplate({
    template: template2,
    inputVariables: ["input3"],
  });
  const chain2 = new LLMChain({ llm: model2, prompt: prompt2 });

  expect(() => {
    /* eslint-disable no-new */
    new SequentialChain({
      chains: [chain1, chain2],
      inputVariables: ["input1", "input2"],
      outputVariables: ["text"],
    });
  }).toThrowErrorMatchingInlineSnapshot(
    `"Missing variables for chain "llm_chain": "input3". Only got the following variables: "input1", "input2", "nonexistent"."`
  );
});
