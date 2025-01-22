import { ChatOpenAI } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { LLMGraphTransformer } from "./llm.js";
import { GraphDocument, Node, Relationship } from "../../graphs/document.js";

test.skip("convertToGraphDocuments", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
  });

  const llmGraphTransformer = new LLMGraphTransformer({
    llm: model,
  });

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await llmGraphTransformer.convertToGraphDocuments([
    new Document({ pageContent: "Elon Musk is suing OpenAI" }),
  ]);
});

test("convertToGraphDocuments with allowed", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
  });

  const llmGraphTransformer = new LLMGraphTransformer({
    llm: model,
    allowedNodes: ["PERSON", "ORGANIZATION"],
    allowedRelationships: ["SUES"],
  });

  const result = await llmGraphTransformer.convertToGraphDocuments([
    new Document({ pageContent: "Elon Musk is suing OpenAI" }),
  ]);

  expect(result).toEqual([
    new GraphDocument({
      nodes: [
        new Node({ id: "Elon Musk", type: "Person" }),
        new Node({ id: "OpenAI", type: "Organization" }),
      ],
      relationships: [
        new Relationship({
          source: new Node({ id: "Elon Musk", type: "Person" }),
          target: new Node({ id: "OpenAI", type: "Organization" }),
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

test("convertToGraphDocuments with allowed lowercased", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
  });

  const llmGraphTransformer = new LLMGraphTransformer({
    llm: model,
    allowedNodes: ["Person", "Organization"],
    allowedRelationships: ["SUES"],
  });

  const result = await llmGraphTransformer.convertToGraphDocuments([
    new Document({ pageContent: "Elon Musk is suing OpenAI" }),
  ]);

  expect(result).toEqual([
    new GraphDocument({
      nodes: [
        new Node({ id: "Elon Musk", type: "Person" }),
        new Node({ id: "OpenAI", type: "Organization" }),
      ],
      relationships: [
        new Relationship({
          source: new Node({ id: "Elon Musk", type: "Person" }),
          target: new Node({ id: "OpenAI", type: "Organization" }),
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

test("convertToGraphDocuments with node properties", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
  });

  const llmGraphTransformer = new LLMGraphTransformer({
    llm: model,
    allowedNodes: ["Person"],
    allowedRelationships: ["KNOWS"],
    nodeProperties: ["age", "country"],
  });

  const result = await llmGraphTransformer.convertToGraphDocuments([
    new Document({ pageContent: "John is 30 years old and lives in Spain" }),
  ]);

  expect(result).toEqual([
    new GraphDocument({
      nodes: [
        new Node({
          id: "John",
          type: "Person",
          properties: {
            age: "30",
            country: "Spain",
          },
        }),
      ],
      relationships: [],
      source: new Document({
        pageContent: "John is 30 years old and lives in Spain",
        metadata: {},
      }),
    }),
  ]);
});

test("convertToGraphDocuments with relationship properties", async () => {
  const model = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4o-mini",
  });

  const llmGraphTransformer = new LLMGraphTransformer({
    llm: model,
    allowedNodes: ["Person"],
    allowedRelationships: ["KNOWS"],
    relationshipProperties: ["since"],
  });

  const result = await llmGraphTransformer.convertToGraphDocuments([
    new Document({ pageContent: "John has known Mary since 2020" }),
  ]);

  expect(result).toEqual([
    new GraphDocument({
      nodes: [
        new Node({ id: "John", type: "Person" }),
        new Node({ id: "Mary", type: "Person" }),
      ],
      relationships: [
        new Relationship({
          source: new Node({ id: "John", type: "Person" }),
          target: new Node({ id: "Mary", type: "Person" }),
          type: "KNOWS",
          properties: {
            since: "2020",
          },
        }),
      ],
      source: new Document({
        pageContent: "John has known Mary since 2020",
        metadata: {},
      }),
    }),
  ]);
});
