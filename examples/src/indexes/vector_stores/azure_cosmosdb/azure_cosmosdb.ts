import {
  AzureCosmosDBVectorStore,
  AzureCosmosDBSimilarityType,
} from "@langchain/community/vectorstores/azure_cosmosdb";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

// Load documents from file
const loader = new TextLoader("./state_of_the_union.txt");
const rawDocuments = await loader.load();
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 0,
});
const documents = await splitter.splitDocuments(rawDocuments);

// Create Azure Cosmos DB vector store
const store = await AzureCosmosDBVectorStore.fromDocuments(
  documents,
  new OpenAIEmbeddings(),
  {
    databaseName: "langchain",
    collectionName: "documents",
  }
);

// Create the index
const numLists = 100;
const dimensions = 1536;
const similarity = AzureCosmosDBSimilarityType.COS;
await store.createIndex(numLists, dimensions, similarity);

// Performs a similarity search
const resultDocuments = await store.similaritySearch(
  "What did the president say about Ketanji Brown Jackson?"
);

console.log("Similarity search results:");
console.log(resultDocuments[0].pageContent);
/*
  Tonight. I call on the Senate to: Pass the Freedom to Vote Act. Pass the John Lewis Voting Rights Act. And while you’re at it, pass the Disclose Act so Americans can know who is funding our elections. 

  Tonight, I’d like to honor someone who has dedicated his life to serve this country: Justice Stephen Breyer—an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court. Justice Breyer, thank you for your service. 

  One of the most serious constitutional responsibilities a President has is nominating someone to serve on the United States Supreme Court. 

  And I did that 4 days ago, when I nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence.
*/

// Use the store as part of a chain
const model = new ChatOpenAI({ model: "gpt-3.5-turbo-1106" });
const questionAnsweringPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Answer the user's questions based on the below context:\n\n{context}",
  ],
  ["human", "{input}"],
]);

const combineDocsChain = await createStuffDocumentsChain({
  llm: model,
  prompt: questionAnsweringPrompt,
});

const chain = await createRetrievalChain({
  retriever: store.asRetriever(),
  combineDocsChain,
});

const res = await chain.invoke({
  input: "What is the president's top priority regarding prices?",
});

console.log("Chain response:");
console.log(res.answer);
/*
  The president's top priority is getting prices under control.
*/

// Clean up
await store.delete();

await store.close();
