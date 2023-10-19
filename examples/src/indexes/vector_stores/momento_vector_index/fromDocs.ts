import { MomentoVectorIndex } from "langchain/vectorstores/momento_vector_index";
// For browser/edge, adjust this to import from "@gomomento/sdk-web";
import {
  PreviewVectorIndexClient,
  VectorIndexConfigurations,
  CredentialProvider,
} from "@gomomento/sdk";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { sleep } from "langchain/util/time";

// Create docs with a loader
const loader = new TextLoader("src/document_loaders/example_data/example.txt");
const docs = await loader.load();

const vectorStore = await MomentoVectorIndex.fromDocuments(
  docs,
  new OpenAIEmbeddings(),
  {
    client: new PreviewVectorIndexClient({
      configuration: VectorIndexConfigurations.Laptop.latest(),
      credentialProvider: CredentialProvider.fromEnvironmentVariable({
        environmentVariableName: "MOMENTO_API_KEY",
      }),
    }),
    indexName: "langchain-example-index",
  }
);

// because indexing is async, wait for it to finish to search directly after
await sleep();

// Search for the most similar document
const response = await vectorStore.similaritySearch("hello", 1);

console.log(response);
/*
[
  Document {
    pageContent: 'Foo\nBar\nBaz\n\n',
    metadata: { source: 'src/document_loaders/example_data/example.txt' }
  }
]
*/
