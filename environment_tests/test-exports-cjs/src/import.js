async function test() {
  const { default: assert } = await import("assert");
  const { OpenAI } = await import("@langchain/openai");
  const { ChatOllama } = await import("@langchain/ollama");
  const { ChatGoogle } = await import("@langchain/google-gauth");
  const { ChatPromptTemplate } = await import("@langchain/core/prompts");

  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof ChatOllama === "function");
  assert(typeof ChatGoogle === "function");
}

test()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
