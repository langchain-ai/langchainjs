import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

export type EmbeddingsParams = AsyncCallerParams;

export abstract class Embeddings {
  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  constructor(params: EmbeddingsParams) {
    this.caller = new AsyncCaller(params ?? {});
  }

  abstract embedDocuments(documents: string[]): Promise<number[][]>;

  abstract embedQuery(document: string): Promise<number[]>;
}
