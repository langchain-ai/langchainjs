const assert = require("assert");
const { OpenAI } = require("langchain/llms/openai");
const { LLMChain } = require("langchain/chains");
const { ChatPromptTemplate } = require("langchain/prompts");
const { loadPrompt } = require("langchain/prompts/load");
const { MemoryVectorStore } = require("langchain/vectorstores/memory");
const { OpenAIEmbeddings } = require("langchain/embeddings/openai");
const { Document } = require("langchain/document");
const { CSVLoader } = require("langchain/document_loaders/fs/csv");

async function test() {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof LLMChain === "function");
  assert(typeof loadPrompt === "function");
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
