import assert from "assert";
import { OpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogle } from "@langchain/google-gauth";
import { LLMChain } from "@langchain/classic/chains";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

// Test exports
assert(typeof OpenAI === "function");
assert(typeof LLMChain === "function");
assert(typeof ChatPromptTemplate === "function");
assert(typeof MemoryVectorStore === "function");
assert(typeof ChatOllama === "function");
assert(typeof ChatGoogle === "function");

const vs = new MemoryVectorStore(new FakeEmbeddings());

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
