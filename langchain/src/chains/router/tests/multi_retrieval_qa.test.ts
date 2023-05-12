import { test, expect } from "@jest/globals";
import { MultiRetrievalQAChain } from "../multi_retrieval_qa.js";
import { BaseLLM } from "../../../llms/base.js";
import { BaseRetriever, LLMResult } from "../../../schema/index.js";
import { Document } from "../../../document.js";
import { PromptTemplate } from "../../../prompts/prompt.js";

class FakeRetrievers extends BaseRetriever {
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    return [
      new Document({
        pageContent: `Test document ${query} ${this.name}`,
        metadata: {},
      }),
    ];
  }
}

let pickedRetriever: string;

class FakeLLM extends BaseLLM {
  _llmType(): string {
    return "fake";
  }

  async _generate(
    prompts: string[],
    _: this["ParsedCallOptions"]
  ): Promise<LLMResult> {
    function buildResponse(name: string) {
      return `\`\`\`\n{\n\t"destination": "${name}",\n\t"next_inputs": {\n\t\t"query": "<from ${name}>"\n\t}\n}\n\`\`\``;
    }
    const flatPrompt = prompts.join("\n");

    let response: string;
    if (flatPrompt.includes("Retriever prompt")) {
      response = flatPrompt;
    } else if (flatPrompt.includes("Helpful Answer")) {
      response = `Helpful Answer ${pickedRetriever}`;
    } else {
      // randomly choose 1 out of three responses
      const random = Math.random();
      if (random < 0.33) {
        pickedRetriever = "retriever1";
      } else if (random < 0.66) {
        pickedRetriever = "retriever2";
      } else {
        pickedRetriever = "retriever3";
      }
      response = buildResponse(pickedRetriever);
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

test("Test MultiRetrievalQAChain No Defaults With Retriever Prompts", async () => {
  const llm = new FakeLLM({});
  const retrieverNames = ["retriever1", "retriever2", "retriever3"];
  const retrieverDescriptions = [
    "description1",
    "description2",
    "description3",
  ];
  const retrievers = retrieverNames.map((name) => new FakeRetrievers(name));

  const retrieverPrompts = retrieverNames.map(
    (name) =>
      new PromptTemplate({
        template: `Retriever prompt for ${name} {context} {question}`,
        inputVariables: ["context", "question"],
      })
  );

  const multiRetrievalQAChain = MultiRetrievalQAChain.fromRetrievers(
    llm,
    retrieverNames,
    retrieverDescriptions,
    retrievers,
    retrieverPrompts
  );

  const { text: result } = await multiRetrievalQAChain.call({
    input: "test input",
  });

  expect(result).toContain(pickedRetriever);
});

test("Test MultiRetrievalQAChain No Defaults No Retriever Prompts", async () => {
  const llm = new FakeLLM({});
  const retrieverNames = ["retriever1", "retriever2", "retriever3"];
  const retrieverDescriptions = [
    "description1",
    "description2",
    "description3",
  ];
  const retrievers = retrieverNames.map((name) => new FakeRetrievers(name));

  const multiRetrievalQAChain = MultiRetrievalQAChain.fromRetrievers(
    llm,
    retrieverNames,
    retrieverDescriptions,
    retrievers
  );

  const { text: result } = await multiRetrievalQAChain.call({
    input: "test input",
  });

  expect(result).toEqual(`Helpful Answer ${pickedRetriever}`);
});
