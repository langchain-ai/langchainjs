import {
  BaseCallbackConfig,
  CallbackManager,
  CallbackManagerForRetrieverRun,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import { Document } from "../document.js";
import { Serializable } from "../load/serializable.js";

/**
 * Base Index class. All indexes should extend this class.
 */

export interface BaseRetrieverInput {
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
  verbose?: boolean;
}

export abstract class BaseRetriever extends Serializable {
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

  abstract _getRelevantDocuments(
    query: string,
    callbacks?: CallbackManagerForRetrieverRun
  ): Promise<Document[]>;

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
