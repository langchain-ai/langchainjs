/* eslint-disable no-process-env */
import { Document } from "@langchain/core/documents";
import { WatsonxRerank } from "../ibm.js";

const query = "What is the capital of the United States?";
const docs = [
  new Document({
    pageContent:
      "Carson City is the capital city of the American state of Nevada. At the 2010 United States Census, Carson City had a population of 55,274.",
  }),
  new Document({
    pageContent:
      "The Commonwealth of the Northern Mariana Islands is a group of islands in the Pacific Ocean that are a political division controlled by the United States. Its capital is Saipan.",
  }),
  new Document({
    pageContent:
      "Charlotte Amalie is the capital and largest city of the United States Virgin Islands. It has about 20,000 people. The city is on the island of Saint Thomas.",
  }),
  new Document({
    pageContent:
      "Washington, D.C. (also known as simply Washington or D.C., and officially as the District of Columbia) is the capital of the United States. It is a federal district. The President of the USA and many major national government offices are in the territory. This makes it the political center of the United States of America.",
  }),
  new Document({
    pageContent:
      "Capital punishment (the death penalty) has existed in the United States since before the United States was a country. As of 2017, capital punishment is legal in 30 of the 50 states. The federal government (including the United States military) also uses capital punishment.",
  }),
];
describe("Integration tests on WatsonxRerank", () => {
  describe(".compressDocuments() method", () => {
    test("Basic call", async () => {
      const instance = new WatsonxRerank({
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        version: "2024-05-31",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const result = await instance.compressDocuments(docs, query);
      expect(result.length).toBe(docs.length);
      result.forEach((item) =>
        expect(typeof item.metadata.relevanceScore).toBe("number")
      );
    });

    test("Basic call with truncation", async () => {
      const instance = new WatsonxRerank({
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        version: "2024-05-31",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
        truncateInputTokens: 512,
      });
      const longerDocs: Document[] = docs.map((item) => ({
        pageContent: item.pageContent.repeat(100),
        metadata: {},
      }));
      const result = await instance.compressDocuments(longerDocs, query);
      expect(result.length).toBe(docs.length);
      result.forEach((item) =>
        expect(typeof item.metadata.relevanceScore).toBe("number")
      );
    });
  });

  describe(".rerank() method", () => {
    test("Basic call", async () => {
      const instance = new WatsonxRerank({
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        version: "2024-05-31",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const result = await instance.rerank(docs, query);
      expect(result.length).toBe(docs.length);
      result.forEach((item) => {
        expect(typeof item.relevanceScore).toBe("number");
        expect(item.input).toBeUndefined();
      });
    });
    test("Basic call with options", async () => {
      const instance = new WatsonxRerank({
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        version: "2024-05-31",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const result = await instance.rerank(docs, query, {
        returnOptions: {
          topN: 3,
          inputs: true,
        },
      });
      expect(result.length).toBe(3);
      result.forEach((item) => {
        expect(typeof item.relevanceScore).toBe("number");
        expect(item.input).toBeDefined();
      });
    });
    test("Basic call with truncation", async () => {
      const instance = new WatsonxRerank({
        model: "cross-encoder/ms-marco-minilm-l-12-v2",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        version: "2024-05-31",
        projectId: process.env.WATSONX_AI_PROJECT_ID ?? "testString",
      });
      const longerDocs = docs.map((item) => ({
        pageContent: item.pageContent.repeat(100),
      }));
      const result = await instance.rerank(longerDocs, query, {
        truncateInputTokens: 512,
      });
      result.forEach((item) => {
        expect(typeof item.relevanceScore).toBe("number");
        expect(item.input).toBeUndefined();
      });
    });
  });
});
