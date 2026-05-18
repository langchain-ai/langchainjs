import assert from "assert";
import { OpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { FakeEmbeddings } from "@langchain/core/utils/testing";

async function test() {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof Document === "function");
  assert(typeof FakeEmbeddings === "function");
}

test()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
