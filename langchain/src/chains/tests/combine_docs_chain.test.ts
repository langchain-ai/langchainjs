import { test, expect } from "@jest/globals";
import { Document } from "../../document.js";
import { BaseLLM } from "../../llms/index.js";
import { loadQAChain } from "../question_answering/load.js";
import { LLMResult } from "../../schema/index.js";

test("Test MapReduceDocumentsChain", async () => {
  let nrMapCalls = 0;
  let nrReduceCalls = 0;

  class FakeLLM extends BaseLLM {
    _llmType(): string {
      return "fake";
    }

    async _generate(prompts: string[], _?: string[]): Promise<LLMResult> {
      return {
        generations: prompts.map((prompt) => {
          let completion = "";
          if (prompt.startsWith("Use the following portion")) {
            nrMapCalls += 1;
            completion = "a portion of context";
          } else if (prompt.startsWith("Given the following extracted")) {
            nrReduceCalls += 1;
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

  const model = new FakeLLM({});
  const chain = loadQAChain(model, { type: "map_reduce" });
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
  expect(nrMapCalls).toBe(0); // below maxTokens
  expect(nrReduceCalls).toBe(1);
});
