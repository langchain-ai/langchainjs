const assert = require("assert");
const { OpenAI } = require("langchain/llms/openai");
const { LLMChain } = require("langchain/chains");
const { ChatPromptTemplate } = require("langchain/prompts");
const { loadPrompt } = require("langchain/prompts/load");
const { HNSWLib } = require("langchain/vectorstores/hnswlib");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { InMemoryDocstore, Document } = require("langchain/docstore");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");

async function test() {
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
