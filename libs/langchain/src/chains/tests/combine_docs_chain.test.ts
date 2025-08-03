import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { BaseLLM } from "@langchain/core/language_models/llms";
import { LLMResult } from "@langchain/core/outputs";
import { loadQAMapReduceChain } from "../question_answering/load.js";
import { loadSummarizationChain } from "../index.js";

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

  const res = await chain.invoke({
    input_documents: docs,
    question: "Where did harrison go to college",
  });
  // console.log({ res });

  expect(res).toEqual({
    text: "a final answer",
  });
  expect(model.nrMapCalls).toBe(0); // below maxTokens
  expect(model.nrReduceCalls).toBe(1);
});

test("Test MapReduceDocumentsChain with content above maxTokens and intermediate steps", async () => {
  const model = new FakeLLM({});
  const chain = loadQAMapReduceChain(model, {
    returnIntermediateSteps: true,
  });
  const aString = "a".repeat(4000);
  const bString = "b".repeat(4000);
  const docs = [
    new Document({ pageContent: aString }),
    new Document({ pageContent: bString }),
  ];

  const res = await chain.invoke({
    input_documents: docs,
    question: "Is the letter c present in the document",
  });
  // console.log({ res });

  expect(res).toEqual({
    text: "a final answer",
    intermediateSteps: ["a portion of context", "a portion of context"],
  });
  expect(model.nrMapCalls).toBe(2); // above maxTokens
  expect(model.nrReduceCalls).toBe(1);
});

test("Test RefineDocumentsChain", async () => {
  const model = new FakeLLM({});
  const chain = loadSummarizationChain(model, { type: "refine" });
  const docs = [
    new Document({ pageContent: "harrison went to harvard" }),
    new Document({ pageContent: "ankush went to princeton" }),
  ];

  expect(chain.inputKeys).toEqual(["input_documents"]);

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chain.run(docs);
  // console.log({ res });
});
