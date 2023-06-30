import { Embeddings } from "../embeddings/base.js";
import { Document } from "../document.js";
import { BaseRetriever, SimilarityFilters } from "../schema/index.js";

export interface VectorStoreRetrieverInput<V extends VectorStore> {
  vectorStore: V;
  k?: number;
  filter?: V["FilterType"];
  similarityFilter?: SimilarityFilters;
}

export class VectorStoreRetriever<
  V extends VectorStore = VectorStore
> extends BaseRetriever {
  vectorStore: V;

  k = 4;

  filter?: V["FilterType"];

  minSimilarityScore?: number;

  dynamicK = false;

  kIncrement = 1;

  maxK = 100;

  constructor(fields: VectorStoreRetrieverInput<V>) {
    super();
    this.vectorStore = fields.vectorStore;
    this.k = fields.k ?? this.k;
    this.filter = fields.filter;
    this.minSimilarityScore = fields.similarityFilter?.minSimilarityScore;
    this.dynamicK = fields.similarityFilter?.dynamicK ?? this.dynamicK;
    this.kIncrement = fields.similarityFilter?.kIncrement ?? this.kIncrement;
    this.maxK = fields.similarityFilter?.maxK ?? this.maxK;

    if (
      fields.similarityFilter &&
      fields.similarityFilter.minSimilarityScore == null
    ) {
      throw new Error(
        "You must provide a `minSimilarityScore` if you want to use the `similarityFilter`."
      );
    }
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    if (this.minSimilarityScore == null) {
      const results = await this.vectorStore.similaritySearch(
        query,
        this.k,
        this.filter
      );

      return results;
    }

    let updatedK = this.k;
    let filteredResults: [Document, number][] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const results = await this.vectorStore.similaritySearchWithScore(
        query,
        updatedK,
        this.filter
      );

      filteredResults = results.filter(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ([, score]) => score >= this.minSimilarityScore!
      );

      // If we don't have enough results, we can't increase K
      if (filteredResults.length < updatedK) {
        break;
      }

      // If we've reached maxK, we can't increase K
      if (updatedK === this.maxK) {
        break;
      }

      if (this.dynamicK) {
        updatedK += this.kIncrement;
      } else {
        break;
      }
    }

    return filteredResults.map(([document]) => document);
  }

  async addDocuments(documents: Document[]): Promise<void> {
    await this.vectorStore.addDocuments(documents);
  }
}

export abstract class VectorStore {
  declare FilterType: object;

  embeddings: Embeddings;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(embeddings: Embeddings, _dbConfig: Record<string, any>) {
    this.embeddings = embeddings;
  }

  abstract addVectors(
    vectors: number[][],
    documents: Document[]
  ): Promise<void>;

  abstract addDocuments(documents: Document[]): Promise<void>;

  abstract similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: this["FilterType"]
  ): Promise<[Document, number][]>;

  async similaritySearch(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<Document[]> {
    const results = await this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k,
      filter
    );

    return results.map((result) => result[0]);
  }

  async similaritySearchWithScore(
    query: string,
    k = 4,
    filter: this["FilterType"] | undefined = undefined
  ): Promise<[Document, number][]> {
    return this.similaritySearchVectorWithScore(
      await this.embeddings.embedQuery(query),
      k,
      filter
    );
  }

  static fromTexts(
    _texts: string[],
    _metadatas: object[] | object,
    _embeddings: Embeddings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<VectorStore> {
    throw new Error(
      "the Langchain vectorstore implementation you are using forgot to override this, please report a bug"
    );
  }

  static fromDocuments(
    _docs: Document[],
    _embeddings: Embeddings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _dbConfig: Record<string, any>
  ): Promise<VectorStore> {
    throw new Error(
      "the Langchain vectorstore implementation you are using forgot to override this, please report a bug"
    );
  }

  asRetriever(
    k?: number,
    filter?: this["FilterType"],
    similarityFilter?: SimilarityFilters
  ): VectorStoreRetriever<this> {
    return new VectorStoreRetriever({
      vectorStore: this,
      k,
      filter,
      similarityFilter,
    });
  }
}

export abstract class SaveableVectorStore extends VectorStore {
  abstract save(directory: string): Promise<void>;

  static load(
    _directory: string,
    _embeddings: Embeddings
  ): Promise<SaveableVectorStore> {
    throw new Error("Not implemented");
  }
}
