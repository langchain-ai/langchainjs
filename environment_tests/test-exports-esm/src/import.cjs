async function test() {
  const { default: assert } = await import("assert");
  const { OpenAI } = await import("@langchain/openai");
  const { ChatPromptTemplate } = await import("@langchain/core/prompts");
  );
  const { Document } = await import("@langchain/core/documents");
  const { FakeEmbeddings } = await import("@langchain/core/utils/testing");

  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof ChatPromptTemplate === "function");


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
