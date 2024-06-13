async function test() {
  const { default: assert } = await import("assert");
  const { OpenAI } = await import("@langchain/openai");
  const { LLMChain } = await import("langchain/chains");
  const { ChatPromptTemplate } = await import("@langchain/core/prompts");
  const { HNSWLib } = await import("@langchain/community/vectorstores/hnswlib");
  const { HuggingFaceTransformersEmbeddings } = await import("@langchain/community/embeddings/hf_transformers");
  const { Document } = await import("@langchain/core/documents");
  const { CSVLoader } = await import("langchain/document_loaders/fs/csv");

  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof LLMChain === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof HNSWLib === "function");

  // Test dynamic imports of peer dependencies
  const { HierarchicalNSW } = await HNSWLib.imports();

  const vs = new HNSWLib(new HuggingFaceTransformersEmbeddings({ model: "Xenova/all-MiniLM-L6-v2", }), {
    space: "ip",
    numDimensions: 3,
    index: new HierarchicalNSW("ip", 3),
  });

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

  // Test CSVLoader
  const loader = new CSVLoader(new Blob(["a,b,c\n1,2,3\n4,5,6"]));

  const docs = await loader.load();

  assert(docs.length === 2);
}

test()
  .then(() => console.log("success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
