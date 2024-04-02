import { ChatOpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { LLMGraphTransformer } from "./llm.js";

test.skip("convertToGraphDocuments", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4-turbo-preview",
  });

  const llmGraphTransformer = new LLMGraphTransformer({
    llm: model,
  });

  const result = await llmGraphTransformer.convertToGraphDocuments([
    new Document({ pageContent: "Elon Musk is suing OpenAI" }),
  ]);

  console.log(result);
});

test.skip("convertToGraphDocuments with allowed", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4-turbo-preview",
  });

  const llmGraphTransformer = new LLMGraphTransformer({
    llm: model,
    allowedNodes: ["PERSON", "ORGANIZATION"],
    allowedRelationships: ["SUES"],
  });

  const result = await llmGraphTransformer.convertToGraphDocuments([
    new Document({ pageContent: "Elon Musk is suing OpenAI" }),
  ]);

  console.log(JSON.stringify(result));

  expect(result).toEqual([
    {
      nodes: [
        { id: "Elon Musk", type: "PERSON" },
        { id: "OpenAI", type: "ORGANIZATION" },
      ],
      relationships: [
        {
          source: { id: "Elon Musk", type: "PERSON" },
          target: { id: "OpenAI", type: "ORGANIZATION" },
          type: "SUES",
        },
      ],
      source: { pageContent: "Elon Musk is suing OpenAI", metadata: {} },
    },
  ]);
});
