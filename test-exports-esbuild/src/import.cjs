async function test() {
  const { default: assert } = await import("assert");
  const { OpenAI } = await import("langchain/llms/openai");
  const { LLMChain } = await import("langchain/chains");
  const { ChatPromptTemplate } = await import("langchain/prompts");
  const { loadPrompt } = await import("langchain/prompts/load");
  const { HNSWLib } = await import("langchain/vectorstores/hnswlib");
  const { OpenAIEmbeddings } = await import("langchain/embeddings/openai");
  const { InMemoryDocstore, Document } = await import("langchain/docstore");
  const { CSVLoader } = await import("langchain/document_loaders/fs/csv");

  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof LLMChain === "function");
  assert(typeof loadPrompt === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof HNSWLib === "function");

  // Test dynamic imports of peer dependencies
  const { HierarchicalNSW } = await HNSWLib.imports();

  const vs = new HNSWLib(new OpenAIEmbeddings({ openAIApiKey: "sk-XXXX" }), {
    space: "ip",
    numDimensions: 3,
    docstore: new InMemoryDocstore(),
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
