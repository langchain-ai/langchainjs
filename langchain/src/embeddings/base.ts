import {
  CallbackManager,
  Callbacks,
  BaseCallbackConfig,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import { Serializable } from "../load/serializable.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

export type EmbeddingsParams = AsyncCallerParams & {
  callbacks?: Callbacks;
  verbose?: boolean;
  tags?: string[];
  metadata?: Record<string, unknown>;
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

  metadata?: Record<string, unknown>;

  constructor(params: EmbeddingsParams) {
    super(params);
    this.caller = new AsyncCaller(params ?? {});
    this.callbacks = params.callbacks;
    this.verbose = params.verbose ?? true;
    this.tags = params.tags ?? [];
    this.metadata = params.metadata ?? {};
  }

  abstract _embeddingsType(): string;

  abstract _embedDocuments(
    documents: string[],
    config?: Callbacks | BaseCallbackConfig
  ): Promise<number[][]>;

  abstract _embedQuery(
    document: string,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<number[]>;

  async embedDocuments(
    documents: string[],
    config?: Callbacks | BaseCallbackConfig
  ): Promise<number[][]> {
    const parsedConfig = parseCallbackConfigArg(config);
    const callbackManager_ = await CallbackManager.configure(
      parsedConfig.callbacks,
      this.callbacks,
      parsedConfig.tags,
      this.tags,
      parsedConfig.metadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const runManagers = await callbackManager_?.handleEmbeddingStart(
      this.toJSON(),
      documents
    );

    try {
      const embeddings = await this._embedDocuments(documents);
      await Promise.all(
        (runManagers ?? []).map((runManager, idx) =>
          runManager?.handleEmbeddingEnd(embeddings?.[idx])
        )
      );
      return embeddings;
    } catch (error) {
      await Promise.all(
        (runManagers ?? []).map((runManager) =>
          runManager?.handleEmbeddingError(error)
        )
      );
      throw error;
    }
  }

  async embedQuery(
    document: string,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<number[]> {
    const parsedConfig = parseCallbackConfigArg(config);
    const callbackManager_ = await CallbackManager.configure(
      parsedConfig.callbacks,
      this.callbacks,
      parsedConfig.tags,
      this.tags,
      parsedConfig.metadata,
      this.metadata,
      { verbose: this.verbose }
    );
    const runManagers = await callbackManager_?.handleEmbeddingStart(
      this.toJSON(),
      [document]
    );

    try {
      const embedding = await this._embedQuery(document);
      await runManagers?.[0].handleEmbeddingEnd(embedding);
      return embedding;
    } catch (error) {
      await runManagers?.[0].handleEmbeddingError(error);
      throw error;
    }
  }
}
