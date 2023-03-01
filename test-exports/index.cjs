async function test() {
  const { default: assert } = await import("assert");
  const { OpenAI } = await import("langchain");
  const { loadPrompt } = await import("langchain/prompts");
  const { HNSWLib } = await import("langchain/vectorstores");
  const { OpenAIEmbeddings } = await import("langchain/embeddings");
  const { InMemoryDocstore, Document } = await import("langchain/docstore");

  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof loadPrompt === "function");
  assert(typeof HNSWLib === "function");

  // Test dynamic imports of peer dependencies
  const { HierarchicalNSW } = await HNSWLib.imports();

  const vs = new HNSWLib(
    {
      space: "ip",
      numDimensions: 3,
    },
    new OpenAIEmbeddings({ openAIApiKey: "sk-XXXX" }),
    new InMemoryDocstore(),
    new HierarchicalNSW("ip", 3)
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
