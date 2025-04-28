import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ScoreThresholdRetriever } from "langchain/retrievers/score_threshold";

const vectorStore = await MemoryVectorStore.fromTexts(
  [
    "Buildings are made out of brick",
    "Buildings are made out of wood",
    "Buildings are made out of stone",
    "Buildings are made out of atoms",
    "Buildings are made out of building materials",
    "Cars are made out of metal",
    "Cars are made out of plastic",
  ],
  [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
  new OpenAIEmbeddings()
);

const retriever = ScoreThresholdRetriever.fromVectorStore(vectorStore, {
  minSimilarityScore: 0.9, // Finds results with at least this similarity score
  maxK: 100, // The maximum K value to use. Use it based to your chunk size to make sure you don't run out of tokens
  kIncrement: 2, // How much to increase K by each time. It'll fetch N results, then N + kIncrement, then N + kIncrement * 2, etc.
});

const result = await retriever.invoke("What are buildings made out of?");

console.log(result);

/*
  [
    Document {
      pageContent: 'Buildings are made out of building materials',
      metadata: { id: 5 }
    },
    Document {
      pageContent: 'Buildings are made out of wood',
      metadata: { id: 2 }
    },
    Document {
      pageContent: 'Buildings are made out of brick',
      metadata: { id: 1 }
    },
    Document {
      pageContent: 'Buildings are made out of stone',
      metadata: { id: 3 }
    },
    Document {
      pageContent: 'Buildings are made out of atoms',
      metadata: { id: 4 }
    }
  ]
*/
