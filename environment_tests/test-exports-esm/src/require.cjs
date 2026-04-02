const assert = require("assert");
const { OpenAI } = require("@langchain/openai");
const { ChatPromptTemplate } = require("@langchain/core/prompts");

async function test() {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof ChatPromptTemplate === "function");
}

test()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
