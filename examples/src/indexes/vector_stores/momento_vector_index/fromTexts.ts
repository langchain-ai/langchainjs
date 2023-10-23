import { MomentoVectorIndex } from "langchain/vectorstores/momento_vector_index";
// For browser/edge, adjust this to import from "@gomomento/sdk-web";
import {
  PreviewVectorIndexClient,
  VectorIndexConfigurations,
  CredentialProvider,
} from "@gomomento/sdk";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { sleep } from "langchain/util/time";

const vectorStore = await MomentoVectorIndex.fromTexts(
  ["hello world", "goodbye world", "salutations world", "farewell world"],
  {},
  new OpenAIEmbeddings(),
  {
    client: new PreviewVectorIndexClient({
      configuration: VectorIndexConfigurations.Laptop.latest(),
      credentialProvider: CredentialProvider.fromEnvironmentVariable({
        environmentVariableName: "MOMENTO_API_KEY",
      }),
    }),
    indexName: "langchain-example-index",
  },
  { ids: ["1", "2", "3", "4"] }
);

// because indexing is async, wait for it to finish to search directly after
await sleep();

const response = await vectorStore.similaritySearch("hello", 2);

console.log(response);

/*
[
  Document { pageContent: 'hello world', metadata: {} },
  Document { pageContent: 'salutations world', metadata: {} }
]
*/
