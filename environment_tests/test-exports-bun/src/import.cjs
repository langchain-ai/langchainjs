async function test() {
  const { default: assert } = await import("assert");
  const { OpenAI } = await import("@langchain/openai");
  const { ChatPromptTemplate } = await import("@langchain/core/prompts");
  const { OpenAIEmbeddings } = await import("@langchain/openai");

  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof OpenAIEmbeddings === "function");
}

test()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
