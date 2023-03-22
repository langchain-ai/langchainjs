import { DynamoDB } from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import NearestNeighbors from "nearest-neighbors";

import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

// eslint-disable-next-line @typescript-eslint/ban-types, @typescript-eslint/no-explicit-any
type DynamoMetadata = Record<string, any>;

export interface DynamoLibArgs {
  tableName: string;
  dynamoDb: DynamoDB.DocumentClient;
  textKey?: string;
}

export class DynamoStore extends VectorStore {
  textKey: string;
  tableName: string;
  dynamoDb: DynamoDB.DocumentClient;

  constructor(embeddings: Embeddings, args: DynamoLibArgs) {
    super(embeddings, args);

    this.embeddings = embeddings;
    this.tableName = args.tableName;
    this.dynamoDb = args.dynamoDb;
    this.textKey = args.textKey ?? "text";
  }

  async addDocuments(documents: Document[], ids?: string[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents,
      ids
    );
  }

  async addVectors(
    vectors: number[][],
    documents: Document[],
    ids?: string[]
  ): Promise<void> {
    const documentIds = ids == null ? documents.map(() => uuidv4()) : ids;

    const putRequests = vectors.map((values, idx) => ({
      PutRequest: {
        Item: {
          id: documentIds[idx],
          metadata: documents[idx].metadata,
          [this.textKey]: documents[idx].pageContent,
          values: values,
        },
      },
    }));

    const chunkSize = 25;
    for (let i = 0; i < putRequests.length; i += chunkSize) {
      const chunk = putRequests.slice(i, i + chunkSize);
      await this.dynamoDb
        .batchWrite({
          RequestItems: {
            [this.tableName]: chunk,
          },
        })
        .promise();
    }
  }

  static async fromTexts(
    texts: string[],
    metadatas: DynamoMetadata[],
    embeddings: Embeddings,
    dbConfig: DynamoLibArgs
  ): Promise<DynamoStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const newDoc = new Document({
        pageContent: texts[i],
        metadata: metadatas[i],
      });
      docs.push(newDoc);
    }

    const args: DynamoLibArgs = {
      tableName: dbConfig.tableName,
      dynamoDb: dbConfig.dynamoDb,
      textKey: dbConfig.textKey,
    };
    return DynamoStore.fromDocuments(docs, embeddings, args);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: DynamoLibArgs
  ): Promise<DynamoStore> {
    const args = dbConfig;
    args.textKey = dbConfig.textKey ?? "text";

    const instance = new this(embeddings, args);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: DynamoLibArgs
  ): Promise<DynamoStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: object
  ): Promise<[Document, number][]> {
    // Fetch all items from the DynamoDB table
    const scanOutput = await this.dynamoDb
      .scan({
        TableName: this.tableName,
      })
      .promise();

    const items = scanOutput.Items || [];

    // Initialize the nearest-neighbors library
    const nn = new NearestNeighbors(k);

    // Add all vectors from the DynamoDB table to the nearest-neighbors instance
    for (const item of items) {
      nn.add(item.id, item.values);
    }

    // Perform a similarity search using the nearest-neighbors library
    const neighbors = nn.search(query);

    const result: [Document, number][] = [];

    for (const neighbor of neighbors) {
      const itemId = neighbor[0];
      const score = neighbor[1];
      const item = items.find((item) => item.id === itemId);
      if (item) {
        const { [this.textKey]: pageContent, ...metadata } = item.metadata;
        result.push([new Document({ metadata, pageContent }), score]);
      }
    }

    return result;
  }
}
