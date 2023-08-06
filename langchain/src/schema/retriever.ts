import {
  BaseCallbackConfig,
  CallbackManager,
  CallbackManagerForRetrieverRun,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import { Document } from "../document.js";
import { Runnable, RunnableConfig } from "./runnable.js";

/**
 * Base Index class. All indexes should extend this class.
 */

export interface BaseRetrieverInput {
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
  verbose?: boolean;
}

export abstract class BaseRetriever extends Runnable<string, Document[]> {
  callbacks?: Callbacks;

  tags?: string[];

  metadata?: Record<string, unknown>;

  verbose?: boolean;

  constructor(fields?: BaseRetrieverInput) {
    super(fields);
    this.callbacks = fields?.callbacks;
    this.tags = fields?.tags ?? [];
    this.metadata = fields?.metadata ?? {};
    this.verbose = fields?.verbose ?? false;
  }

  /**
   * TODO: This should be an abstract method, but we'd like to avoid breaking
   * changes to people currently using subclassed custom retrievers.
   * Change it on next major release.
   */
  _getRelevantDocuments(
    _query: string,
    _callbacks?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    throw new Error("Not implemented!");
  }

  async invoke(input: string, options?: RunnableConfig): Promise<Document[]> {
    return this.getRelevantDocuments(input, options);
  }

  async getRelevantDocuments(
    query: string,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<Document[]> {
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
    const runManager = await callbackManager_?.handleRetrieverStart(
      this.toJSON(),
      query
    );
    try {
      const results = await this._getRelevantDocuments(query, runManager);
      await runManager?.handleRetrieverEnd(results);
      return results;
    } catch (error) {
      await runManager?.handleRetrieverError(error);
      throw error;
    }
  }
}
