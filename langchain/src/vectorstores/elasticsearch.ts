import { Client, estypes } from "@elastic/elasticsearch";
import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { VectorStore } from "./base.js";

type ElasticKnnEngine = "hnsw";
type ElasticSimilarity = "l2_norm" | "dot_product" | "cosine";

interface VectorSearchOptions {
  readonly engine?: ElasticKnnEngine;
  readonly similarity?: ElasticSimilarity;
  readonly m?: number;
  readonly efConstruction?: number;
  readonly candidates?: number;
}

export interface ElasticClientArgs {
  readonly client: Client;
  readonly indexName?: string;
  readonly vectorSearchOptions?: VectorSearchOptions;
}

type ElasticFilter = object;

export class ElasticVectorSearch extends VectorStore {
  declare FilterType: ElasticFilter;

  private readonly client: Client;

  private readonly indexName: string;

  private readonly engine: ElasticKnnEngine;

  private readonly similarity: ElasticSimilarity;

  private readonly efConstruction: number;

  private readonly m: number;

  private readonly candidates: number;

  constructor(embeddings: Embeddings, args: ElasticClientArgs) {
    super(embeddings, args);

    this.engine = args.vectorSearchOptions?.engine ?? "hnsw";
    this.similarity = args.vectorSearchOptions?.similarity ?? "l2_norm";
    this.m = args.vectorSearchOptions?.m ?? 16;
    this.efConstruction = args.vectorSearchOptions?.efConstruction ?? 100;
    this.candidates = args.vectorSearchOptions?.candidates ?? 200;

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
      this.similarity,
      this.efConstruction,
      this.m
    );
    const operations = vectors.flatMap((embedding, idx) => [
      {
        index: {
          _index: this.indexName,
        },
      },
      {
        embedding,
        metadata: documents[idx].metadata,
        text: documents[idx].pageContent,
      },
    ]);
    await this.client.bulk({ refresh: true, operations });
  }

  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: ElasticFilter | undefined
  ): Promise<[Document, number][]> {
    const result = await this.client.search({
      index: this.indexName,
      knn: {
        field: "embedding",
        query_vector: query,
        filter: this.buildMetadataTerms(filter),
        k,
        num_candidates: this.candidates,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.hits.hits.map((hit: any) => [
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
    args: ElasticClientArgs
  ): Promise<ElasticVectorSearch> {
    const documents = texts.map((text, idx) => {
      const metadata = Array.isArray(metadatas) ? metadatas[idx] : metadatas;
      return new Document({ pageContent: text, metadata });
    });

    return ElasticVectorSearch.fromDocuments(documents, embeddings, args);
  }

  static async fromDocuments(
    docs: Document[],
    embeddings: Embeddings,
    dbConfig: ElasticClientArgs
  ): Promise<ElasticVectorSearch> {
    const store = new ElasticVectorSearch(embeddings, dbConfig);
    await store.addDocuments(docs).then(() => store);
    return store;
  }

  static async fromExistingIndex(
    embeddings: Embeddings,
    dbConfig: ElasticClientArgs
  ): Promise<ElasticVectorSearch> {
    const store = new ElasticVectorSearch(embeddings, dbConfig);
    const exists = await store.doesIndexExist();
    if (exists) {
      return store;
    }
    throw new Error(`The index ${store.indexName} does not exist.`);
  }

  private async ensureIndexExists(
    dimension: number,
    engine = "hnsw",
    similarity = "l2_norm",
    efConstruction = 100,
    m = 16
  ): Promise<void> {
    const request: estypes.IndicesCreateRequest = {
      index: this.indexName,
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
            type: "dense_vector",
            dims: dimension,
            index: true,
            similarity,
            index_options: {
              type: engine,
              m,
              ef_construction: efConstruction,
            },
          },
        },
      },
    };

    const indexExists = await this.doesIndexExist();
    if (indexExists) return;

    await this.client.indices.create(request);
  }

  private buildMetadataTerms(
    filter?: ElasticFilter
  ): { term: Record<string, unknown> }[] {
    if (filter == null) return [];
    const result = [];
    for (const [key, value] of Object.entries(filter)) {
      result.push({ term: { [`metadata.${key}`]: value } });
    }
    return result;
  }

  async doesIndexExist(): Promise<boolean> {
    return await this.client.indices.exists({ index: this.indexName });
  }

  async deleteIfExists(): Promise<void> {
    const indexExists = await this.doesIndexExist();
    if (!indexExists) return;

    await this.client.indices.delete({ index: this.indexName });
  }
}
