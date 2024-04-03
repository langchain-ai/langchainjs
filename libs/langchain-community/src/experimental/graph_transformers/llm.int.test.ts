import { ChatOpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { LLMGraphTransformer } from "./llm.js";
import {
  GraphDocument,
  Node,
  Relationship,
} from "../../graphs/graph_document.js";

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

test("convertToGraphDocuments with allowed", async () => {
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
    new GraphDocument({
      nodes: [
        new Node({ id: "Elon Musk", type: "PERSON" }),
        new Node({ id: "OpenAI", type: "ORGANIZATION" }),
      ],
      relationships: [
        new Relationship({
          source: new Node({ id: "Elon Musk", type: "PERSON" }),
          target: new Node({ id: "OpenAI", type: "ORGANIZATION" }),
          type: "SUES",
        }),
      ],
      source: new Document({
        pageContent: "Elon Musk is suing OpenAI",
        metadata: {},
      }),
    }),
  ]);
});
