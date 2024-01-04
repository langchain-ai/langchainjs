import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

const vectorStore = new FaissStore(new OpenAIEmbeddings(), {});
const ids = ["2", "1", "4"];
const idsReturned = await vectorStore.addDocuments(
  [
    new Document({
      pageContent: "my world",
      metadata: { tag: 2 },
    }),
    new Document({
      pageContent: "our world",
      metadata: { tag: 1 },
    }),
    new Document({
      pageContent: "your world",
      metadata: { tag: 4 },
    }),
  ],
  {
    ids,
  }
);

console.log(idsReturned);

/*
  [ '2', '1', '4' ]
*/

const docs = await vectorStore.similaritySearch("my world", 3);

console.log(docs);

/*
[
  Document { pageContent: 'my world', metadata: { tag: 2 } },
  Document { pageContent: 'your world', metadata: { tag: 4 } },
  Document { pageContent: 'our world', metadata: { tag: 1 } }
]
*/

await vectorStore.delete({ ids: [ids[0], ids[1]] });

const docs2 = await vectorStore.similaritySearch("my world", 3);

console.log(docs2);

/*
[ Document { pageContent: 'your world', metadata: { tag: 4 } } ]
*/
