import { CallbackManager, Callbacks } from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

export type EmbeddingsParams = AsyncCallerParams & {
  callbacks?: Callbacks;
  verbose?: boolean;
  tags?: string[];
};

export abstract class Embeddings extends Serializable {
  lc_namespace = ["langchain", "embeddings", this._embeddingsType()];
  /**
   * The async caller should be used by subclasses to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  callbacks?: Callbacks;

  verbose: boolean;

  tags?: string[];

  constructor(params: EmbeddingsParams) {
    super(params);
    this.caller = new AsyncCaller(params ?? {});
    this.callbacks = params.callbacks;
    this.verbose = params.verbose ?? true;
    this.tags = params.tags ?? [];
  }

  abstract _embeddingsType(): string;

  abstract _embedDocuments(
    documents: string[],
    callbacks?: Callbacks
  ): Promise<number[][]>;

  abstract _embedQuery(
    document: string,
    callbacks?: Callbacks
  ): Promise<number[]>;

  async embedDocuments(
    documents: string[],
    callbacks?: Callbacks
  ): Promise<number[][]> {
    const callbackManager_ = await CallbackManager.configure(
      callbacks,
      this.callbacks,
      undefined,
      this.tags,
      { verbose: this.verbose }
    );
    const runManager = await callbackManager_?.handleEmbeddingStart(
      this.toJSON(),
      documents
    );

    try {
      const embeddings = await this._embedDocuments(documents);
      await runManager?.handleEmbeddingEnd(embeddings);
      return embeddings;
    } catch (error) {
      await runManager?.handleEmbeddingError(error);
      throw error;
    }
  }

  async embedQuery(document: string, callbacks?: Callbacks): Promise<number[]> {
    const callbackManager_ = await CallbackManager.configure(
      callbacks,
      this.callbacks,
      undefined,
      this.tags,
      { verbose: this.verbose }
    );
    const runManager = await callbackManager_?.handleEmbeddingStart(
      this.toJSON(),
      [document]
    );

    try {
      const embedding = await this._embedQuery(document);
      await runManager?.handleEmbeddingEnd([embedding]);
      return embedding;
    } catch (error) {
      await runManager?.handleEmbeddingError(error);
      throw error;
    }
  }
}
