import assert from "assert";
import { OpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { CallbackManager } from "@langchain/core/callbacks/manager";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

// Test exports
assert(typeof OpenAI === "function");
assert(typeof ChatPromptTemplate === "function");
assert(typeof FakeEmbeddings === "function");
assert(typeof CallbackManager === "function");


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
