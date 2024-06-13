import assert from "assert";
import { OpenAI } from "@langchain/openai";
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { Document } from "@langchain/core/documents";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { CallbackManager } from "@langchain/core/callbacks/manager";

// Test exports
assert(typeof OpenAI === "function");
assert(typeof LLMChain === "function");
assert(typeof ChatPromptTemplate === "function");
assert(typeof HNSWLib === "function");
assert(typeof HuggingFaceTransformersEmbeddings === "function");
assert(typeof CallbackManager === "function");

// Test dynamic imports of peer dependencies
const { HierarchicalNSW } = await HNSWLib.imports();

const vs = new HNSWLib(new HuggingFaceTransformersEmbeddings({ model: "Xenova/all-MiniLM-L6-v2", }), {
  space: "ip",
  numDimensions: 3,
  index: new HierarchicalNSW("ip", 3),
});

await vs.addVectors(
  [
    [0, 1, 0],
    [0, 0, 1],
  ],
  [
    new Document({
      pageContent: "a",
    }),
    new Document({
      pageContent: "b",
    }),
  ]
);

assert((await vs.similaritySearchVectorWithScore([0, 0, 1], 1)).length === 1);

// Test CSVLoader
const loader = new CSVLoader(new Blob(["a,b,c\n1,2,3\n4,5,6"]));

const docs = await loader.load();

assert(docs.length === 2);
