const assert = require("assert");
const { OpenAI } = require("@langchain/openai");
const { ChatOllama } = require("@langchain/ollama");
const { ChatGoogle } = require("@langchain/google-gauth");
const { LLMChain } = require("@langchain/classic/chains");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { MemoryVectorStore } = require("@langchain/classic/vectorstores/memory");
const {
  HuggingFaceTransformersEmbeddings,
} = require("@langchain/community/embeddings/huggingface_transformers");
const { Document } = require("@langchain/core/documents");
const { RunnableLambda } = require("@langchain/core/runnables");

async function test() {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof LLMChain === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof MemoryVectorStore === "function");
  assert(typeof ChatOllama === "function");
  assert(typeof ChatGoogle === "function");

  const vs = new MemoryVectorStore(
    new HuggingFaceTransformersEmbeddings({ model: "Xenova/all-MiniLM-L6-v2" })
  );

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
  assert(typeof RunnableLambda === "function");
  let attemptCount = 0;
  const flakyRunnable = new RunnableLambda({
    func: () => {
      attemptCount += 1;
      if (attemptCount < 3) {
        throw new Error(`Attempt ${attemptCount} failed`);
      }
      return `Success after ${attemptCount} attempts`;
    },
  });

  const retryRunnable = flakyRunnable.withRetry({
    stopAfterAttempt: 3,
  });

  const result = await retryRunnable.invoke("test");
  assert(result === "Success after 3 attempts");
  assert(attemptCount === 3);
}

test()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
