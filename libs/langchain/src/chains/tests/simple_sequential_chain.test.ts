import { test, expect } from "vitest";
import { BaseLLM } from "@langchain/core/language_models/llms";
import { LLMResult } from "@langchain/core/outputs";
import { PromptTemplate } from "@langchain/core/prompts";
import { VectorStoreRetriever } from "@langchain/core/vectorstores";
import { FakeEmbeddings } from "@langchain/core/utils/testing";
import { LLMChain } from "../llm_chain.js";
import { SimpleSequentialChain } from "../sequential_chain.js";
import { AnalyzeDocumentChain } from "../analyze_documents_chain.js";
import { ConversationalRetrievalQAChain } from "../conversational_retrieval_chain.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";

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

test("Test SimpleSequentialChain input chains' single input validation", async () => {
  const model1 = new FakeLLM1({});
  const model2 = new FakeLLM2({});
  const template = "Some arbitrary template with fake {input1} and {input2}.";
  const prompt = new PromptTemplate({
    template,
    inputVariables: ["input1", "input2"],
  });
  const chain1 = new LLMChain({ llm: model1, prompt });
  const chain2 = new LLMChain({ llm: model2, prompt });
  expect(() => {
    new SimpleSequentialChain({ chains: [chain1, chain2] });
  }).toThrowErrorMatchingInlineSnapshot(
    `[Error: Chains used in SimpleSequentialChain should all have one input, got 2 for llm.]`
  );
});

test("Test SimpleSequentialChain input chains' single ouput validation", async () => {
  const model1 = new FakeLLM1({});
  const fakeEmbeddings = new FakeEmbeddings();
  const anyStore = new MemoryVectorStore(fakeEmbeddings);
  const retriever = new VectorStoreRetriever({
    vectorStore: anyStore,
  });
  const template = "Some arbitrary template with fake {input}.";
  const prompt = new PromptTemplate({ template, inputVariables: ["input"] });
  const chain1 = new LLMChain({ llm: model1, prompt });
  const chain2 = new ConversationalRetrievalQAChain({
    retriever,
    combineDocumentsChain: chain1,
    questionGeneratorChain: chain1,
    returnSourceDocuments: true,
  });
  // Chain below is is not meant to work in a real-life scenario.
  // It's only combined this way to get one input/multiple outputs chain.
  const multipleOutputChain = new AnalyzeDocumentChain({
    combineDocumentsChain: chain2,
  });
  expect(() => {
    new SimpleSequentialChain({ chains: [chain1, multipleOutputChain] });
  }).toThrowErrorMatchingInlineSnapshot(
    `[Error: Chains used in SimpleSequentialChain should all have one output, got 2 for analyze_document_chain.]`
  );
});
