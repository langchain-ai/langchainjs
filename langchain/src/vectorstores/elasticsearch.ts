import * as uuid from "uuid";
import {
  BulkOperationContainer,
  BulkRequest,
} from "@elastic/elasticsearch/lib/api/types.js";
import { Client, ClientOptions } from "@elastic/elasticsearch";
import { VectorStore } from "./base.js";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";

export type ElasticSearchLibArgs = (
  | { client: Client }
  | { clientOptions: ClientOptions }
) & {
  indexName?: string;
};

interface VectorDocument {
  vector: number[];
  text: string;
  metadata?: object;
}

/**
 * Wrapper around Elasticsearch as a vector database.
 */
export class ElasticSearchStore extends VectorStore {
  indexName: string;

  client: Client;

  constructor(public embeddings: Embeddings, args: ElasticSearchLibArgs) {
    super(embeddings, args);
    this.indexName = args.indexName ?? uuid.v4();
    if (isClientOptions(args)) {
      this.client = new Client(args.clientOptions);
    } else {
      this.client = args.client;
    }
  }

  async addVectors(
    embeddings: number[][],
    documents: Document[]
  ): Promise<void> {
    if (!(await this.client.indices.exists({ index: this.indexName }))) {
      await this.client.indices.create({
        index: this.indexName,
        body: {
          mappings: {
            properties: {
              vector: {
                type: "dense_vector",
                dims: embeddings[0].length,
              },
              text: { type: "text" },
              metadata: { type: "object" },
            },
          },
        },
      });
    }
    const operations = documents.flatMap(
      (document, index): [BulkOperationContainer, VectorDocument] => [
        {
          index: {
            _index: this.indexName,
            _id: uuid.v4(),
          },
        },
        {
          vector: embeddings[index],
          text: document.pageContent,
          metadata: document.metadata,
        },
      ]
    );
    const request: BulkRequest<VectorDocument> = {
      refresh: true,
      operations,
    };

    await this.client.bulk(request);
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    await this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: object
  ): Promise<[Document, number][]> {
    const searchQuery = {
      index: this.indexName,
      query: {
        script_score: {
          query: {
            bool: {
              must: Object.entries(filter || {}).map(([key, value]) => ({
                match: {
                  [`metadata.${key}.keyword`]: value,
                },
              })),
            },
          },
          script: {
            source: "cosineSimilarity(params.query_vector, 'vector') + 1.0",
            params: { query_vector: query },
          },
        },
      },
      size: k,
    };
    const response = await this.client.search<VectorDocument>(searchQuery);
    return response.hits.hits.map((hit) => [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new Document<Record<string, any>>({
        pageContent: hit._source?.text || "",
        metadata: hit._source?.metadata || {},
      }),
      hit._score || 0,
    ]);
  }

  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    dbConfig: ElasticSearchLibArgs
  ): Promise<ElasticSearchStore> {
    const docs: Document[] = [];
    for (let i = 0; i < texts.length; i += 1) {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      const newDoc = new Document({
        pageContent: texts[i],
        metadata,
      });
      docs.push(newDoc);
    }
    return ElasticSearchStore.fromDocuments(docs, embeddings, dbConfig);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: ElasticSearchLibArgs
  ): Promise<ElasticSearchStore> {
    const instance = new this(embeddings, dbConfig);
    await instance.addDocuments(docs);
    return instance;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: ElasticSearchLibArgs
  ): Promise<ElasticSearchStore> {
    const instance = new this(embeddings, dbConfig);
    return instance;
  }
}

function isClientOptions(
  args: ElasticSearchLibArgs
): args is { clientOptions: ClientOptions } {
  return "clientOptions" in args;
}
