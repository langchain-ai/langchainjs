/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import { GoogleCloudStorageDocstore } from "langchain/stores/doc/gcs";
import {
  MatchingEngineArgs,
  MatchingEngine,
  IdDocument,
  Restriction,
} from "@langchain/community/vectorstores/googlevertexai";
import { Document } from "@langchain/core/documents";

export const run = async () => {
  if (
    !process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEX ||
    !process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEXENDPOINT ||
    !process.env.GOOGLE_CLOUD_STORAGE_BUCKET
  ) {
    throw new Error(
      "GOOGLE_VERTEXAI_MATCHINGENGINE_INDEX, GOOGLE_VERTEXAI_MATCHINGENGINE_INDEXENDPOINT, and GOOGLE_CLOUD_STORAGE_BUCKET must be set."
    );
  }

  const embeddings = new SyntheticEmbeddings({
    vectorSize: Number.parseInt(
      process.env.SYNTHETIC_EMBEDDINGS_VECTOR_SIZE ?? "768",
      10
    ),
  });

  const store = new GoogleCloudStorageDocstore({
    bucket: process.env.GOOGLE_CLOUD_STORAGE_BUCKET!,
  });

  const config: MatchingEngineArgs = {
    index: process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEX!,
    indexEndpoint: process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEXENDPOINT!,
    apiVersion: "v1beta1",
    docstore: store,
  };

  const engine = new MatchingEngine(embeddings, config);

  /*
   * Simple document add
   */
  const doc = new Document({ pageContent: "this" });
  await engine.addDocuments([doc]);

  /*
   * Simple search.
   * Returns documents including an id field
   */
  const oldResults: IdDocument[] = await engine.similaritySearch("this");
  console.log("simple results", oldResults);
  /*
    [
      Document {
        pageContent: 'this',
        metadata: {},
        id: 'c05d4249-9ddc-4ed9-8b0c-adf344500c2b'
      }
    ]
   */

  /*
   * Delete the results
   */
  const oldIds = oldResults.map((doc) => doc.id!);
  await engine.delete({ ids: oldIds });

  /*
   * Documents with metadata
   */
  const documents = [
    new Document({
      pageContent: "this apple",
      metadata: {
        color: "red",
        category: "edible",
      },
    }),
    new Document({
      pageContent: "this blueberry",
      metadata: {
        color: "blue",
        category: "edible",
      },
    }),
    new Document({
      pageContent: "this firetruck",
      metadata: {
        color: "red",
        category: "machine",
      },
    }),
  ];

  // Add all our documents
  await engine.addDocuments(documents);

  /*
   * Documents that match "color == red"
   */
  const redFilter: Restriction[] = [
    {
      namespace: "color",
      allowList: ["red"],
    },
  ];
  const redResults = await engine.similaritySearch("this", 4, redFilter);
  console.log("red results", redResults);
  /*
    [
      Document {
        pageContent: 'this apple',
        metadata: { color: 'red', category: 'edible' },
        id: '724ff599-31ea-4094-8d60-158faf3c3f32'
      },
      Document {
        pageContent: 'this firetruck',
        metadata: { color: 'red', category: 'machine' },
        id: 'a3c039f3-4ca1-43b3-97d8-c33dfe75bd31'
      }
    ]
   */

  /*
   * Documents that match "color == red AND category != edible"
   */
  const redNotEditableFilter: Restriction[] = [
    {
      namespace: "color",
      allowList: ["red"],
    },
    {
      namespace: "category",
      denyList: ["edible"],
    },
  ];
  const redNotEdibleResults = await engine.similaritySearch(
    "this",
    4,
    redNotEditableFilter
  );
  console.log("red not edible results", redNotEdibleResults);
  /*
    [
      Document {
        pageContent: 'this apple',
        metadata: { color: 'red', category: 'edible' },
        id: '724ff599-31ea-4094-8d60-158faf3c3f32'
      }
    ]
   */
};
