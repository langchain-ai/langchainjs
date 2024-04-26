import { test, expect } from "@jest/globals";
import { PromptTemplate } from "@langchain/core/prompts";
import { BaseLLM } from "@langchain/core/language_models/llms";
import { LLMResult } from "@langchain/core/outputs";
import { ConstitutionalChain } from "../constitutional_ai/constitutional_chain.js";
import { ConstitutionalPrinciple } from "../constitutional_ai/constitutional_principle.js";
import { LLMChain } from "../llm_chain.js";

class FakeLLM extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake";
  }

  async _generate(prompts: string[]): Promise<LLMResult> {
    return {
      generations: prompts.map((prompt) => [
        {
          text: prompt,
          score: 0,
        },
      ]),
    };
  }
}

test("Test ConstitutionalChain", async () => {
  const llm = new FakeLLM({});
  const qaPrompt = new PromptTemplate({
    template: "Q: {question} A:",
    inputVariables: ["question"],
  });

  const qaChain = new LLMChain({
    llm,
    prompt: qaPrompt,
  });

  const critiqueWord = "Tell me if this answer is good.";
  const revisionWord = "Give a better answer.";

  const constitutionalChain = ConstitutionalChain.fromLLM(llm, {
    chain: qaChain,
    constitutionalPrinciples: [
      new ConstitutionalPrinciple({
        critiqueRequest: critiqueWord,
        revisionRequest: revisionWord,
      }),
    ],
  });

  const { output } = await constitutionalChain.invoke({
    question: "What is the meaning of life?",
  });
  expect(output).toContain(critiqueWord);
  expect(output).toContain(revisionWord);
});
