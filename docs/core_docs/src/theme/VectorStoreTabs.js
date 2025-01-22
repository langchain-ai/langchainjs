import React from "react";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import CodeBlock from "@theme-original/CodeBlock";
import Npm2Yarn from "@theme/Npm2Yarn";

export default function VectorStoreTabs(props) {
  const { customVarName } = props;

  const vectorStoreVarName = customVarName ?? "vectorStore";

  const tabItems = [
    {
      value: "Memory",
      label: "Memory",
      text: `import { MemoryVectorStore } from "langchain/vectorstores/memory";\n\nconst ${vectorStoreVarName} = new MemoryVectorStore(embeddings);`,
      dependencies: "langchain",
      default: true,
    },
    {
      value: "Chroma",
      label: "Chroma",
      text: `import { Chroma } from "@langchain/community/vectorstores/chroma";\n\nconst ${vectorStoreVarName} = new Chroma(embeddings, {\n  collectionName: "a-test-collection",\n});`,
      dependencies: "@langchain/community",
      default: true,
    },
    {
      value: "FAISS",
      label: "FAISS",
      text: `import { FaissStore } from "@langchain/community/vectorstores/faiss";\n\nconst ${vectorStoreVarName} = new FaissStore(embeddings, {});`,
      dependencies: "@langchain/community",
      default: false,
    },
    {
      value: "MongoDB",
      label: "MongoDB",
      text: `import { MongoDBAtlasVectorSearch } from "@langchain/mongodb"
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
const collection = client
  .db(process.env.MONGODB_ATLAS_DB_NAME)
  .collection(process.env.MONGODB_ATLAS_COLLECTION_NAME);

const ${vectorStoreVarName} = new MongoDBAtlasVectorSearch(embeddings, {
  collection: collection,
  indexName: "vector_index",
  textKey: "text",
  embeddingKey: "embedding",
});`,
      dependencies: "@langchain/mongodb",
      default: false,
    },
    {
      value: "PGVector",
      label: "PGVector",
      text: `import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";

const ${vectorStoreVarName} = await PGVectorStore.initialize(embeddings, {})`,
      dependencies: "@langchain/community",
      default: false,
    },
    {
      value: "Pinecone",
      label: "Pinecone",
      text: `import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";

const pinecone = new PineconeClient();
const ${vectorStoreVarName} = new PineconeStore(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});`,
      dependencies: "@langchain/pinecone",
      default: false,
    },
    {
      value: "Qdrant",
      label: "Qdrant",
      text: `import { QdrantVectorStore } from "@langchain/qdrant";

const ${vectorStoreVarName} = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  collectionName: "langchainjs-testing",
});`,
      dependencies: "@langchain/qdrant",
      default: false,
    },
  ];

  return (
    <div>
      <h3>Pick your vector store:</h3>
      <Tabs groupId="vectorStoreTabs">
        {tabItems.map((tab) => (
          <TabItem value={tab.value} label={tab.label} key={tab.value}>
            <h4>Install dependencies</h4>
            <Npm2Yarn>{tab.dependencies}</Npm2Yarn>
            <CodeBlock language="typescript">{tab.text}</CodeBlock>
          </TabItem>
        ))}
      </Tabs>
    </div>
  );
}
