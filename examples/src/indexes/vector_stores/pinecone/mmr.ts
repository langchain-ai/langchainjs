import { MemoryVectorStore } from "langchain/vectorstores/memory";
// Or other embeddings
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
});

const vectorStore = new MemoryVectorStore(embeddings);

import type { Document } from "@langchain/core/documents";

const document1 = { pageContent: "foo", metadata: { baz: "bar" } };
const document2 = { pageContent: "thud", metadata: { bar: "baz" } };
const document3 = { pageContent: "i will be deleted :(", metadata: {} };

const documents: Document[] = [document1, document2, document3];
await vectorStore.addDocuments(documents);

const results = await vectorStore.similaritySearch("thud", 1);
for (const doc of results) {
  console.log(`* ${doc.pageContent} [${JSON.stringify(doc.metadata, null)}]`);
}
