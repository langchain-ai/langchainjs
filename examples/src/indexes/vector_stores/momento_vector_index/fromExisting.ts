import { MomentoVectorIndex } from "langchain/vectorstores/momento_vector_index";
// For browser/edge, adjust this to import from "@gomomento/sdk-web";
import {
  PreviewVectorIndexClient,
  VectorIndexConfigurations,
  CredentialProvider,
} from "@gomomento/sdk";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

const vectorStore = new MomentoVectorIndex(new OpenAIEmbeddings(), {
  client: new PreviewVectorIndexClient({
    configuration: VectorIndexConfigurations.Laptop.latest(),
    credentialProvider: CredentialProvider.fromEnvironmentVariable({
      environmentVariableName: "MOMENTO_API_KEY",
    }),
  }),
  indexName: "langchain-example-index",
});

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
