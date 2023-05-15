import { Client, RequestParams, errors } from "@opensearch-project/opensearch";
import * as uuid from "uuid";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { VectorStore } from "./base.js";

type OpenSearchEngine = "nmslib" | "hnsw";
type OpenSearchSpaceType = "l2" | "cosinesimil" | "ip";

interface VectorSearchOptions {
  readonly engine?: OpenSearchEngine;
  readonly spaceType?: OpenSearchSpaceType;
  readonly m?: number;
  readonly efConstruction?: number;
  readonly efSearch?: number;
}

export interface OpenSearchClientArgs {
  readonly client: Client;
  readonly indexName?: string;

  readonly vectorSearchOptions?: VectorSearchOptions;
}

type OpenSearchFilter = object;

export class OpenSearchVectorStore extends VectorStore {
  declare FilterType: OpenSearchFilter;

  private readonly client: Client;

  private readonly indexName: string;

  private readonly engine: OpenSearchEngine;

  private readonly spaceType: OpenSearchSpaceType;

  private readonly efConstruction: number;

  private readonly efSearch: number;

  private readonly m: number;

  constructor(embeddings: Embeddings, args: OpenSearchClientArgs) {
    super(embeddings, args);

    this.spaceType = args.vectorSearchOptions?.spaceType ?? "l2";
    this.engine = args.vectorSearchOptions?.engine ?? "nmslib";
    this.m = args.vectorSearchOptions?.m ?? 16;
    this.efConstruction = args.vectorSearchOptions?.efConstruction ?? 512;
    this.efSearch = args.vectorSearchOptions?.efSearch ?? 512;

    this.client = args.client;
    this.indexName = args.indexName ?? "documents";
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const texts = documents.map(({ pageContent }) => pageContent);
    return this.addVectors(
      await this.embeddings.embedDocuments(texts),
      documents
    );
  }

  async addVectors(vectors: number[][], documents: Document[]): Promise<void> {
    await this.ensureIndexExists(
      vectors[0].length,
      this.engine,
      this.spaceType,
      this.efSearch,
      this.efConstruction,
      this.m
    );
    const operations = vectors.flatMap((embedding, idx) => [
      {
        index: {
          _index: this.indexName,
          _id: uuid.v4(),
        },
      },
      {
        embedding,
        metadata: documents[idx].metadata,
        text: documents[idx].pageContent,
      },
    ]);
    await this.client.bulk({ body: operations });
    await this.client.indices.refresh({ index: this.indexName });
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: OpenSearchFilter | undefined
  ): Promise<[Document, number][]> {
    const search: RequestParams.Search = {
      index: this.indexName,
      body: {
        query: {
          bool: {
            filter: { bool: { must: this.buildMetadataTerms(filter) } },
            must: [
              {
                knn: {
                  embedding: { vector: query, k },
                },
              },
            ],
          },
        },
        size: k,
      },
    };

    const { body } = await this.client.search(search);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return body.hits.hits.map((hit: any) => [
      new Document({
        pageContent: hit._source.text,
        metadata: hit._source.metadata,
      }),
      hit._score,
    ]);
  }

  static fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: Embeddings,
    args: OpenSearchClientArgs
  ): Promise<OpenSearchVectorStore> {
    const documents = texts.map((text, idx) => {
      const metadata = Array.isArray(metadatas) ? metadatas[idx] : metadatas;
      return new Document({ pageContent: text, metadata });
    });

    return OpenSearchVectorStore.fromDocuments(documents, embeddings, args);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: OpenSearchClientArgs
  ): Promise<OpenSearchVectorStore> {
    const store = new OpenSearchVectorStore(embeddings, dbConfig);
    await store.addDocuments(docs).then(() => store);
    return store;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: OpenSearchClientArgs
  ): Promise<OpenSearchVectorStore> {
    const store = new OpenSearchVectorStore(embeddings, dbConfig);
    await store.client.cat.indices({ index: store.indexName });
    return store;
  }

  private async ensureIndexExists(
    dimension: number,
    engine = "nmslib",
    spaceType = "l2",
    efSearch = 512,
    efConstruction = 512,
    m = 16
  ): Promise<void> {
    const body = {
      settings: {
        index: {
          number_of_shards: 5,
          number_of_replicas: 1,
          knn: true,
          "knn.algo_param.ef_search": efSearch,
        },
      },
      mappings: {
        dynamic_templates: [
          {
            // map all metadata properties to be keyword
            "metadata.*": {
              match_mapping_type: "*",
              mapping: { type: "keyword" },
            },
          },
        ],
        properties: {
          text: { type: "text" },
          metadata: { type: "object" },
          embedding: {
            type: "knn_vector",
            dimension,
            method: {
              name: "hnsw",
              engine,
              space_type: spaceType,
              parameters: { ef_construction: efConstruction, m },
            },
          },
        },
      },
    };

    const indexExists = await this.doesIndexExist();
    if (indexExists) return;

    await this.client.indices.create({ index: this.indexName, body });
  }

  private buildMetadataTerms(
    filter?: OpenSearchFilter
  ): { term: Record<string, unknown> }[] {
    if (filter == null) return [];
    const result = [];
    for (const [key, value] of Object.entries(filter)) {
      result.push({ term: { [`metadata.${key}`]: value } });
    }
    return result;
  }

  async doesIndexExist(): Promise<boolean> {
    try {
      await this.client.cat.indices({ index: this.indexName });
      return true;
    } catch (err: unknown) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (err instanceof errors.ResponseError && err.statusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  async deleteIfExists(): Promise<void> {
    const indexExists = await this.doesIndexExist();
    if (!indexExists) return;

    await this.client.indices.delete({ index: this.indexName });
  }
}
