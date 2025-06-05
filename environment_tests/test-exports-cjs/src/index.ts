import assert from "assert";
import { OpenAI } from "@langchain/openai";
import { LLMChain } from "langchain/chains";
import { ChatOllama } from "@langchain/ollama";
import { ChatGoogle } from "@langchain/google-gauth";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { Document } from "@langchain/core/documents";

async function test(useAzure: boolean = false) {
  // Test exports
  assert(typeof OpenAI === "function");
  assert(typeof LLMChain === "function");
  assert(typeof ChatPromptTemplate === "function");
  assert(typeof MemoryVectorStore === "function");
  assert(typeof ChatOllama === "function");
  assert(typeof ChatGoogle === "function");

  // Test dynamic imports of peer dependencies
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

test(false)
  .then(() => console.log("openAI Api success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
test(true)
  .then(() => console.log("azure openAI Api success"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
