async function test() {
  const { default: assert } = await import("assert");
  const { OpenAI } = await import("@langchain/openai");
  const { LLMChain } = await import("langchain/chains");
  const { ChatPromptTemplate } = await import("@langchain/core/prompts");
  const { MemoryVectorStore } = await import("langchain/vectorstores/memory");
  const { OpenAIEmbeddings } = await import("@langchain/openai");
  const { Document } = await import("@langchain/core/documents");

  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof LLMChain === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof MemoryVectorStore === "function");

  const vs = new MemoryVectorStore(new OpenAIEmbeddings({ openAIApiKey: "sk-XXXX" }));

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
