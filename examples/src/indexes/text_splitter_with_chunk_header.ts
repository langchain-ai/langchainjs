import { OpenAI } from "langchain/llms/openai";
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { HNSWLib } from "langchain/vectorstores/hnswlib";

const splitter = new CharacterTextSplitter({
  chunkSize: 1536,
  chunkOverlap: 200,
});

const jimDocs = await splitter.createDocuments(
  [`My favorite color is blue.`],
  [],
  {
    chunkHeader: `DOCUMENT NAME: Jim Interview\n\n---\n\n`,
    appendChunkOverlapHeader: true,
  }
);

const pamDocs = await splitter.createDocuments(
  [`My favorite color is red.`],
  [],
  {
    chunkHeader: `DOCUMENT NAME: Pam Interview\n\n---\n\n`,
    appendChunkOverlapHeader: true,
  }
);

const vectorStore = await HNSWLib.fromDocuments(
  jimDocs.concat(pamDocs),
  new OpenAIEmbeddings()
);

const model = new OpenAI({ temperature: 0 });

const chain = new RetrievalQAChain({
  combineDocumentsChain: loadQAStuffChain(model),
  retriever: vectorStore.asRetriever(),
  returnSourceDocuments: true,
});
const res = await chain.call({
  query: "What is Pam's favorite color?",
});

console.log(JSON.stringify(res, null, 2));

/*
  {
    "text": " Red.",
    "sourceDocuments": [
      {
        "pageContent": "DOCUMENT NAME: Pam Interview\n\n---\n\nMy favorite color is red.",
        "metadata": {
          "loc": {
            "lines": {
              "from": 1,
              "to": 1
            }
          }
        }
      },
      {
        "pageContent": "DOCUMENT NAME: Jim Interview\n\n---\n\nMy favorite color is blue.",
        "metadata": {
          "loc": {
            "lines": {
              "from": 1,
              "to": 1
            }
          }
        }
      }
    ]
  }
*/
