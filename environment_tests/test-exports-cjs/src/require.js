const assert = require("assert");
const { OpenAI } = require("@langchain/openai");
const { ChatOllama } = require("@langchain/ollama");
const { ChatGoogle } = require("@langchain/google-gauth");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { RunnableLambda } = require("@langchain/core/runnables");
const uuid = require("@langchain/core/utils/uuid");

async function test() {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof ChatOllama === "function");
  assert(typeof ChatGoogle === "function");

  assert(typeof RunnableLambda === "function");

  assert(typeof uuid.v1 === "function");
  assert(typeof uuid.v4 === "function");
  assert(typeof uuid.v5 === "function");
  assert(typeof uuid.v7 === "function");
  assert(typeof uuid.parse === "function");
  assert(typeof uuid.stringify === "function");
  assert(typeof uuid.validate === "function");
  assert(typeof uuid.version === "function");
  assert(typeof uuid.MAX === "string");
  assert(typeof uuid.NIL === "string");
  assert(/^[0-9a-f-]{36}$/.test(uuid.v4()));
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
