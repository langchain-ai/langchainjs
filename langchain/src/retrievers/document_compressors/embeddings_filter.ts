import { Document } from "../../document.js";
import { Embeddings } from "../../embeddings/base.js";
import { BaseDocumentCompressor } from "./index.js";
import { cosineSimilarity } from "../../util/math.js";

/**
 * Interface for the parameters of the `EmbeddingsFilter` class.
 */
export interface EmbeddingsFilterParams {
  embeddings: Embeddings;
  similarityFn?: (x: number[][], y: number[][]) => number[][];
  similarityThreshold?: number;
  k?: number;
}

/**
 * Class that represents a document compressor that uses embeddings to
 * drop documents unrelated to the query.
 * @example
 * ```typescript
 * const embeddingsFilter = new EmbeddingsFilter({
 *   embeddings: new OpenAIEmbeddings(),
 *   similarityThreshold: 0.8,
 *   k: 5,
 * });
 * const retrievedDocs = await embeddingsFilter.filterDocuments(
 *   getDocuments(),
 *   "What did the speaker say about Justice Breyer in the 2022 State of the Union?",
 * );
 * console.log({ retrievedDocs });
 * ```
 */
export class EmbeddingsFilter extends BaseDocumentCompressor {
  /**
   * Embeddings to use for embedding document contents and queries.
   */
  embeddings: Embeddings;

  /**
   * Similarity function for comparing documents.
   */
  similarityFn = cosineSimilarity;

  /**
   * Threshold for determining when two documents are similar enough
   * to be considered redundant. Must be specified if `k` is not set.
   */
  similarityThreshold?: number;

  /**
   * The number of relevant documents to return. Can be explicitly set to undefined, in which case
   * similarity_threshold` must be specified. Defaults to 20
   */
  k? = 20;

  constructor(params: EmbeddingsFilterParams) {
    super();
    this.embeddings = params.embeddings;
    this.similarityFn = params.similarityFn ?? this.similarityFn;
    this.similarityThreshold = params.similarityThreshold;
    this.k = "k" in params ? params.k : this.k;
    if (this.k === undefined && this.similarityThreshold === undefined) {
      throw new Error(`Must specify one of "k" or "similarity_threshold".`);
    }
  }

  async compressDocuments(
    documents: Document[],
    query: string
  ): Promise<Document[]> {
    const embeddedDocuments = await this.embeddings.embedDocuments(
      documents.map((doc) => doc.pageContent)
    );
    const embeddedQuery = await this.embeddings.embedQuery(query);
    const similarity = this.similarityFn([embeddedQuery], embeddedDocuments)[0];
    let includedIdxs = Array.from(
      { length: embeddedDocuments.length },
      (_, i) => i
    );

    if (this.k !== undefined) {
      includedIdxs = includedIdxs
        .map((v, i) => [similarity[i], v])
        .sort(([a], [b]) => b - a)
        .slice(0, this.k)
        .map(([, i]) => i);
    }

    if (this.similarityThreshold !== undefined) {
      const threshold = this.similarityThreshold;
      includedIdxs = includedIdxs.filter((i) => similarity[i] > threshold);
    }

    return includedIdxs.map((i) => documents[i]);
  }
}
