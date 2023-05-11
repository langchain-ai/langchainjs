import { test, expect } from "@jest/globals";
import { Document } from "../../document.js";
import { BaseLLM } from "../../llms/base.js";
import { loadQAMapReduceChain } from "../question_answering/load.js";
import { LLMResult } from "../../schema/index.js";

class FakeLLM extends BaseLLM {
  nrMapCalls = 0;

  nrReduceCalls = 0;

  _llmType(): string {
    return "fake";
  }

  async _generate(prompts: string[]): Promise<LLMResult> {
    return {
      generations: prompts.map((prompt) => {
        let completion = "";
        if (prompt.startsWith("Use the following portion")) {
          this.nrMapCalls += 1;
          completion = "a portion of context";
        } else if (prompt.startsWith("Given the following extracted")) {
          this.nrReduceCalls += 1;
          completion = "a final answer";
        }
        return [
          {
            text: completion,
            score: 0,
          },
        ];
      }),
    };
  }
}

test("Test MapReduceDocumentsChain", async () => {
  const model = new FakeLLM({});
  const chain = loadQAMapReduceChain(model);
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];

  const res = await chain.call({
    input_documents: docs,
    question: "Where did harrison go to college",
  });
  console.log({ res });

  expect(res).toEqual({
    text: "a final answer",
  });
  expect(model.nrMapCalls).toBe(0); // below maxTokens
  expect(model.nrReduceCalls).toBe(1);
});

test("Test MapReduceDocumentsChain with content above maxTokens", async () => {
  const model = new FakeLLM({});
  const chain = loadQAMapReduceChain(model);
  const aString = "a".repeat(10000);
  const bString = "b".repeat(10000);
  const docs = [
    new Document({ pageContent: aString }),
    new Document({ pageContent: bString }),
  ];

  const res = await chain.call({
    input_documents: docs,
    question: "Is the letter c present in the document",
  });
  console.log({ res });

  expect(res).toEqual({
    text: "a final answer",
  });
  expect(model.nrMapCalls).toBe(2); // above maxTokens
  expect(model.nrReduceCalls).toBe(1);
});

test("Test MapReduceDocumentsChain with content above maxTokens and intermediate steps", async () => {
  const model = new FakeLLM({});
  const chain = loadQAMapReduceChain(model, {
    returnIntermediateSteps: true,
  });
  const aString = "a".repeat(10000);
  const bString = "b".repeat(10000);
  const docs = [
    new Document({ pageContent: aString }),
    new Document({ pageContent: bString }),
  ];

  const res = await chain.call({
    input_documents: docs,
    question: "Is the letter c present in the document",
  });
  console.log({ res });

  expect(res).toEqual({
    text: "a final answer",
    intermediateSteps: ["a portion of context", "a portion of context"],
  });
  expect(model.nrMapCalls).toBe(2); // above maxTokens
  expect(model.nrReduceCalls).toBe(1);
});
