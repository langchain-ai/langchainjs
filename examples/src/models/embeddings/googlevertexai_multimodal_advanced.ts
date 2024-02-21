import fs from "fs";
import { GoogleVertexAIMultimodalEmbeddings } from "langchain/experimental/multimodal_embeddings/googlevertexai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "@langchain/core/documents";

const embeddings = new GoogleVertexAIMultimodalEmbeddings();

const vectorStore = await FaissStore.fromTexts(
  ["dog", "cat", "horse", "seagull"],
  [{ id: 2 }, { id: 1 }, { id: 3 }, { id: 4 }],
  embeddings
);

const img = fs.readFileSync("parrot.jpeg");
const vectors: number[] = await embeddings.embedImageQuery(img);
const document = new Document({
  pageContent: img.toString("base64"),
  // Metadata is optional but helps track what kind of document is being retrieved
  metadata: {
    id: 5,
    mediaType: "image",
  },
});

// Add the image embedding vectors to the vector store directly
await vectorStore.addVectors([vectors], [document]);

// Use a similar image to the one just added
const img2 = fs.readFileSync("parrot-icon.png");
const vectors2: number[] = await embeddings.embedImageQuery(img2);

// Use the lower level, direct API
const resultTwo = await vectorStore.similaritySearchVectorWithScore(
  vectors2,
  2
);
console.log(JSON.stringify(resultTwo, null, 2));

/*
  [
    [
      Document {
        pageContent: '<BASE64 ENCODED IMAGE DATA>'
        metadata: {
          id: 5,
          mediaType: "image"
        }
      },
      0.8931522965431213
    ],
    [
      Document {
        pageContent: 'seagull',
        metadata: {
          id: 4
        }
      },
      1.9188631772994995
    ]
  ]
*/
