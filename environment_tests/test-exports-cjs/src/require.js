const assert = require("assert");
const { OpenAI } = require("@langchain/openai");
const { ChatOllama } = require("@langchain/ollama");
const { ChatGoogle } = require("@langchain/google-gauth");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { RunnableLambda } = require("@langchain/core/runnables");

async function test() {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof ChatOllama === "function");
  assert(typeof ChatGoogle === "function");

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
