import { test, expect } from "@jest/globals";
import { BaseLLM } from "../../llms/base.js";
import { LLMResult } from "../../schema/index.js";
import { LLMChain } from "../llm_chain.js";
import { PromptTemplate } from "../../prompts/index.js";
import { SimpleSequentialChain } from "../simple_sequential_chain.js";

class FakeLLM1 extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake_1";
  }

  async _generate(_prompts: string[], _?: string[]): Promise<LLMResult> {
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

  async _generate(prompts: string[], _?: string[]): Promise<LLMResult> {
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

test("Test SimpleSequentialChain", async () => {
  const model1 = new FakeLLM1({});
  const model2 = new FakeLLM2({});
  const template = "Some arbitrary template with fake {input}.";
  const prompt = new PromptTemplate({ template, inputVariables: ["input"] });
  const chain1 = new LLMChain({ llm: model1, prompt });
  const chain2 = new LLMChain({ llm: model2, prompt });
  const combinedChain = new SimpleSequentialChain({ chains: [chain1, chain2] });
  const response = await combinedChain.run("initial question");
  expect(response).toEqual("final answer");
});
