import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { CohereEmbeddings } from "langchain/embeddings/cohere";
import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { MultiQueryRetriever } from "langchain/retrievers/multi_query";

const vectorstore = await MemoryVectorStore.fromTexts(
  [
    "Buildings are made out of brick",
    "Buildings are made out of wood",
    "Buildings are made out of stone",
    "Cars are made out of metal",
    "Cars are made out of plastic",
    "mitochondria is the powerhouse of the cell",
    "mitochondria is made of lipids",
  ],
  [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
  new CohereEmbeddings()
);
const model = new ChatAnthropic({});
const retriever = MultiQueryRetriever.fromLLM({
  llm: model,
  retriever: vectorstore.asRetriever(),
  verbose: true,
});

const query = "What are mitochondria made of?";
const retrievedDocs = await retriever.getRelevantDocuments(query);

/*
  Generated queries: What are the components of mitochondria?,What substances comprise the mitochondria organelle?  ,What is the molecular composition of mitochondria?
*/

console.log(retrievedDocs);

/*
  [
    Document {
      pageContent: 'mitochondria is the powerhouse of the cell',
      metadata: {}
    },
    Document {
      pageContent: 'mitochondria is made of lipids',
      metadata: {}
    },
    Document {
      pageContent: 'Buildings are made out of brick',
      metadata: { id: 1 }
    },
    Document {
      pageContent: 'Buildings are made out of wood',
      metadata: { id: 2 }
    }
  ]
*/
