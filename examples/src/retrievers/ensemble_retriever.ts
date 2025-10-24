import { EnsembleRetriever } from "langchain/retrievers/ensemble";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

class SimpleCustomRetriever extends BaseRetriever {
  lc_namespace = [];

  documents: Document[];

  constructor(fields: { documents: Document[] } & BaseRetrieverInput) {
    super(fields);
    this.documents = fields.documents;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    return this.documents.filter((document) =>
      document.pageContent.includes(query)
    );
  }
}

const docs1 = [
  new Document({ pageContent: "I like apples", metadata: { source: 1 } }),
  new Document({ pageContent: "I like oranges", metadata: { source: 1 } }),
  new Document({
    pageContent: "apples and oranges are fruits",
    metadata: { source: 1 },
  }),
];

const keywordRetriever = new SimpleCustomRetriever({ documents: docs1 });

const docs2 = [
  new Document({ pageContent: "You like apples", metadata: { source: 2 } }),
  new Document({ pageContent: "You like oranges", metadata: { source: 2 } }),
];

const vectorstore = await MemoryVectorStore.fromDocuments(
  docs2,
  new OpenAIEmbeddings()
);

const vectorstoreRetriever = vectorstore.asRetriever();

const retriever = new EnsembleRetriever({
  retrievers: [vectorstoreRetriever, keywordRetriever],
  weights: [0.5, 0.5],
});

const query = "apples";
const retrievedDocs = await retriever.invoke(query);

console.log(retrievedDocs);

/*
  [
    Document { pageContent: 'You like apples', metadata: { source: 2 } },
    Document { pageContent: 'I like apples', metadata: { source: 1 } },
    Document { pageContent: 'You like oranges', metadata: { source: 2 } },
    Document {
      pageContent: 'apples and oranges are fruits',
      metadata: { source: 1 }
    }
  ]
*/
