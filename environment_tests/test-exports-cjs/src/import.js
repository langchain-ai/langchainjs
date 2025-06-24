async function test() {
  const { default: assert } = await import("assert");
  const { OpenAI } = await import("@langchain/openai");
  const { ChatOllama } = await import("@langchain/ollama");
  const { ChatGoogle } = await import("@langchain/google-gauth");
  const { LLMChain } = await import("langchain/chains");
  const { ChatPromptTemplate } = await import("@langchain/core/prompts");
  const { HuggingFaceTransformersEmbeddings } = await import(
    "@langchain/community/embeddings/huggingface_transformers"
  );
  const { Document } = await import("@langchain/core/documents");
  const { MemoryVectorStore } = await import("langchain/vectorstores/memory");

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
}

test()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
