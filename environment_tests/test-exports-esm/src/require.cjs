const assert = require("assert");
const { OpenAI } = require("@langchain/openai");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { Document } = require("@langchain/core/documents");
const { FakeEmbeddings } = require("@langchain/core/utils/testing");

async function test() {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof ChatPromptTemplate === "function");


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
}

test()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
