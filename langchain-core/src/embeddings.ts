import { AsyncCaller, AsyncCallerParams } from "./utils/async_caller.js";

/**
 * The parameters required to initialize an instance of the Embeddings
 * class.
 */
export type EmbeddingsParams = AsyncCallerParams;

/**
 * An abstract class that provides methods for embedding documents and
 * queries using LangChain.
 */
export abstract class Embeddings {
  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  constructor(params: EmbeddingsParams) {
    this.caller = new AsyncCaller(params ?? {});
  }

  /**
   * An abstract method that takes an array of documents as input and
   * returns a promise that resolves to an array of vectors for each
   * document.
   * @param documents An array of documents to be embedded.
   * @returns A promise that resolves to an array of vectors for each document.
   */
  abstract embedDocuments(documents: string[]): Promise<number[][]>;

  /**
   * An abstract method that takes a single document as input and returns a
   * promise that resolves to a vector for the query document.
   * @param document A single document to be embedded.
   * @returns A promise that resolves to a vector for the query document.
   */
  abstract embedQuery(document: string): Promise<number[]>;
}
