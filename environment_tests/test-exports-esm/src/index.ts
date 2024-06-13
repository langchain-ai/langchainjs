import assert from "assert";
import { OpenAI } from "@langchain/openai";
import { LLMChain } from "langchain/chains";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { Document } from "@langchain/core/documents";
import { CSVLoader } from "langchain/document_loaders/fs/csv";

async function test(useAzure: boolean = false) {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof LLMChain === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof HNSWLib === "function");

  // Test dynamic imports of peer dependencies
  const { HierarchicalNSW } = await HNSWLib.imports();
  const openAIParameters = useAzure
    ? {
        azureOpenAIApiKey: "sk-XXXX",
        azureOpenAIApiInstanceName: "XXXX",
        azureOpenAIApiDeploymentName: "XXXX",
        azureOpenAIApiVersion: "XXXX",
      }
    : {
        openAIApiKey: "sk-XXXX",
      };

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

test(false)
  .then(() => console.log("openAI Api success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
test(true)
  .then(() => console.log("Azure openAI Api success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
