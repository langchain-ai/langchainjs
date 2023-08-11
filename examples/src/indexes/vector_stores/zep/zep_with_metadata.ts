import { ZepVectorStore } from "langchain/vectorstores/zep";
import { Document } from "langchain/document";
import { FakeEmbeddings } from "langchain/embeddings/fake";
import { randomUUID } from "crypto";

const docs = [
  new Document({
    metadata: { album: "Led Zeppelin IV", year: 1971 },
    pageContent:
      "Stairway to Heaven is one of the most iconic songs by Led Zeppelin.",
  }),
  new Document({
    metadata: { album: "Led Zeppelin I", year: 1969 },
    pageContent:
      "Dazed and Confused was a standout track on Led Zeppelin's debut album.",
  }),
  new Document({
    metadata: { album: "Physical Graffiti", year: 1975 },
    pageContent:
      "Kashmir, from Physical Graffiti, showcases Led Zeppelin's unique blend of rock and world music.",
  }),
  new Document({
    metadata: { album: "Houses of the Holy", year: 1973 },
    pageContent:
      "The Rain Song is a beautiful, melancholic piece from Houses of the Holy.",
  }),
  new Document({
    metadata: { band: "Black Sabbath", album: "Paranoid", year: 1970 },
    pageContent:
      "Paranoid is Black Sabbath's second studio album and includes some of their most notable songs.",
  }),
  new Document({
    metadata: {
      band: "Iron Maiden",
      album: "The Number of the Beast",
      year: 1982,
    },
    pageContent:
      "The Number of the Beast is often considered Iron Maiden's best album.",
  }),
  new Document({
    metadata: { band: "Metallica", album: "Master of Puppets", year: 1986 },
    pageContent:
      "Master of Puppets is widely regarded as Metallica's finest work.",
  }),
  new Document({
    metadata: { band: "Megadeth", album: "Rust in Peace", year: 1990 },
    pageContent:
      "Rust in Peace is Megadeth's fourth studio album and features intricate guitar work.",
  }),
];

export const run = async () => {
  const collectionName = `collection${randomUUID().split("-")[0]}`;

  const zepConfig = {
    apiUrl: "http://localhost:8000", // this should be the URL of your Zep implementation
    collectionName,
    embeddingDimensions: 1536, // this much match the width of the embeddings you're using
    isAutoEmbedded: true, // If true, the vector store will automatically embed documents when they are added
  };

  const embeddings = new FakeEmbeddings();

  const vectorStore = await ZepVectorStore.fromDocuments(
    docs,
    embeddings,
    zepConfig
  );

  vectorStore
    .similaritySearchWithScore("sad music", 3, {
      where: { jsonpath: "$[*] ? (@.year == 1973)" }, // We should see a single result: The Rain Song
    })
    .then((results) => {
      console.log(JSON.stringify(results));

      // We got our results, now let's delete the collection
      vectorStore.client.document.deleteCollection(collectionName);
    })
    .catch((e) => {
      if (e.name === "NotFoundError") {
        console.log("No results found");
      } else {
        throw e;
      }
    });
};
