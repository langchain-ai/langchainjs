import {
  BaseCallbackConfig,
  CallbackManager,
  CallbackManagerForRetrieverRun,
  Callbacks,
  parseCallbackConfigArg,
} from "../callbacks/manager.js";
import type { DocumentInterface } from "../documents/document.js";
import { Runnable, type RunnableInterface } from "../runnables/base.js";
import { RunnableConfig, ensureConfig } from "../runnables/config.js";

/**
 * Input configuration options for initializing a retriever that extends
 * the `BaseRetriever` class. This interface provides base properties
 * common to all retrievers, allowing customization of callback functions,
 * tagging, metadata, and logging verbosity.
 *
 * Fields:
 * - `callbacks` (optional): An array of callback functions that handle various
 *   events during retrieval, such as logging, error handling, or progress updates.
 *
 * - `tags` (optional): An array of strings used to add contextual tags to
 *   retrieval operations, allowing for easier categorization and tracking.
 *
 * - `metadata` (optional): A record of key-value pairs to store additional
 *   contextual information for retrieval operations, which can be useful
 *   for logging or auditing purposes.
 *
 * - `verbose` (optional): A boolean flag that, if set to `true`, enables
 *   detailed logging and output during the retrieval process. Defaults to `false`.
 */
export interface BaseRetrieverInput {
  callbacks?: Callbacks;
  tags?: string[];
  metadata?: Record<string, unknown>;
  verbose?: boolean;
}

/**
 * Interface for a base retriever that defines core functionality for
 * retrieving relevant documents from a source based on a query.
 *
 * The `BaseRetrieverInterface` standardizes the `getRelevantDocuments` method,
 * enabling retrieval of documents that match the query criteria.
 *
 * @template Metadata - The type of metadata associated with each document,
 *                      defaulting to `Record<string, any>`.
 */
export interface BaseRetrieverInterface<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>
> extends RunnableInterface<string, DocumentInterface<Metadata>[]> {
  /**
   * Retrieves documents relevant to a given query, allowing optional
   * configurations for customization.
   *
   * @param query - A string representing the query to search for relevant documents.
   * @param config - (optional) Configuration options for the retrieval process,
   *                 which may include callbacks and additional context settings.
   * @returns A promise that resolves to an array of `DocumentInterface` instances,
   *          each containing metadata specified by the `Metadata` type parameter.
   */
  getRelevantDocuments(
    query: string,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<DocumentInterface<Metadata>[]>;
}

/**
 * Abstract base class for a document retrieval system, designed to
 * process string queries and return the most relevant documents from a source.
 *
 * `BaseRetriever` provides common properties and methods for derived retrievers,
 * such as callbacks, tagging, and verbose logging. Custom retrieval systems
 * should extend this class and implement `_getRelevantDocuments` to define
 * the specific retrieval logic.
 *
 * @template Metadata - The type of metadata associated with each document,
 *                      defaulting to `Record<string, any>`.
 */
export abstract class BaseRetriever<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Metadata extends Record<string, any> = Record<string, any>
  >
  extends Runnable<string, DocumentInterface<Metadata>[]>
  implements BaseRetrieverInterface
{
  /**
   * Optional callbacks to handle various events in the retrieval process.
   */
  callbacks?: Callbacks;

  /**
   * Tags to label or categorize the retrieval operation.
   */
  tags?: string[];

  /**
   * Metadata to provide additional context or information about the retrieval
   * operation.
   */
  metadata?: Record<string, unknown>;

  /**
   * If set to `true`, enables verbose logging for the retrieval process.
   */
  verbose?: boolean;

  /**
   * Constructs a new `BaseRetriever` instance with optional configuration fields.
   *
   * @param fields - Optional input configuration that can include `callbacks`,
   *                 `tags`, `metadata`, and `verbose` settings for custom retriever behavior.
   */
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
  /**
   * Placeholder method for retrieving relevant documents based on a query.
   *
   * This method is intended to be implemented by subclasses and will be
   * converted to an abstract method in the next major release. Currently, it
   * throws an error if not implemented, ensuring that custom retrievers define
   * the specific retrieval logic.
   *
   * @param _query - The query string used to search for relevant documents.
   * @param _callbacks - (optional) Callback manager for managing callbacks
   *                     during retrieval.
   * @returns A promise resolving to an array of `DocumentInterface` instances relevant to the query.
   * @throws {Error} Throws an error indicating the method is not implemented.
   */
  _getRelevantDocuments(
    _query: string,
    _callbacks?: CallbackManagerForRetrieverRun
  ): Promise<DocumentInterface<Metadata>[]> {
    throw new Error("Not implemented!");
  }

  /**
   * Executes a retrieval operation.
   *
   * @param input - The query string used to search for relevant documents.
   * @param options - (optional) Configuration options for the retrieval run,
   *                  which may include callbacks, tags, and metadata.
   * @returns A promise that resolves to an array of `DocumentInterface` instances
   *          representing the most relevant documents to the query.
   */
  async invoke(
    input: string,
    options?: RunnableConfig
  ): Promise<DocumentInterface<Metadata>[]> {
    return this.getRelevantDocuments(input, ensureConfig(options));
  }

  /**
   * @deprecated Use .invoke() instead. Will be removed in 0.3.0.
   *
   * Main method used to retrieve relevant documents. It takes a query
   * string and an optional configuration object, and returns a promise that
   * resolves to an array of `Document` objects. This method handles the
   * retrieval process, including starting and ending callbacks, and error
   * handling.
   * @param query The query string to retrieve relevant documents for.
   * @param config Optional configuration object for the retrieval process.
   * @returns A promise that resolves to an array of `Document` objects.
   */
  async getRelevantDocuments(
    query: string,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<DocumentInterface<Metadata>[]> {
    const parsedConfig = ensureConfig(parseCallbackConfigArg(config));
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
      query,
      parsedConfig.runId,
      undefined,
      undefined,
      undefined,
      parsedConfig.runName
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
