/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  ActorCallOptions,
  ApifyClient,
  ApifyClientOptions,
  TaskCallOptions,
} from "apify-client";

import { AsyncCaller, AsyncCallerParams } from "../../util/async_caller.js";
import { BaseDocumentLoader, DocumentLoader } from "../base.js";
import { Document } from "../../document.js";
import { getEnvironmentVariable } from "../../util/env.js";

/**
 * A type that represents a function that takes a single object (an Apify
 * dataset item) and converts it to an instance of the Document class.
 *
 * Change function signature to only be asynchronous for simplicity in v0.1.0
 * https://github.com/langchain-ai/langchainjs/pull/3262
 */
export type ApifyDatasetMappingFunction<Metadata extends Record<string, any>> =
  (
    item: Record<string | number, unknown>
  ) =>
    | Document<Metadata>
    | Array<Document<Metadata>>
    | Promise<Document<Metadata> | Array<Document<Metadata>>>;

export interface ApifyDatasetLoaderConfig<Metadata extends Record<string, any>>
  extends AsyncCallerParams {
  datasetMappingFunction: ApifyDatasetMappingFunction<Metadata>;
  clientOptions?: ApifyClientOptions;
}

/**
 * A class that extends the BaseDocumentLoader and implements the
 * DocumentLoader interface. It represents a document loader that loads
 * documents from an Apify dataset.
 * @example
 * ```typescript
 * const loader = new ApifyDatasetLoader("your-dataset-id", {
 *   datasetMappingFunction: (item) =>
 *     new Document({
 *       pageContent: item.text || "",
 *       metadata: { source: item.url },
 *     }),
 *   clientOptions: {
 *     token: "your-apify-token",
 *   },
 * });
 *
 * const docs = await loader.load();
 *
 * const chain = new RetrievalQAChain();
 * const res = await chain.invoke({ query: "What is LangChain?" });
 *
 * console.log(res.text);
 * console.log(res.sourceDocuments.map((d) => d.metadata.source));
 * ```
 */
export class ApifyDatasetLoader<Metadata extends Record<string, any>>
  extends BaseDocumentLoader
  implements DocumentLoader
{
  protected apifyClient: ApifyClient;

  protected datasetId: string;

  protected datasetMappingFunction: ApifyDatasetMappingFunction<Metadata>;

  protected caller: AsyncCaller;

  constructor(datasetId: string, config: ApifyDatasetLoaderConfig<Metadata>) {
    super();
    const { clientOptions, datasetMappingFunction, ...asyncCallerParams } =
      config;
    const token = ApifyDatasetLoader._getApifyApiToken(clientOptions);
    this.apifyClient = new ApifyClient({ ...clientOptions, token });
    this.datasetId = datasetId;
    this.datasetMappingFunction = datasetMappingFunction;
    this.caller = new AsyncCaller(asyncCallerParams);
  }

  private static _getApifyApiToken(config?: { token?: string }) {
    return config?.token ?? getEnvironmentVariable("APIFY_API_TOKEN");
  }

  /**
   * Retrieves the dataset items from the Apify platform and applies the
   * datasetMappingFunction to each item to create an array of Document
   * instances.
   * @returns An array of Document instances.
   */
  async load(): Promise<Document<Metadata>[]> {
    const dataset = await this.apifyClient
      .dataset(this.datasetId)
      .listItems({ clean: true });

    const documentList = await Promise.all(
      dataset.items.map((item) =>
        this.caller.call(async () => this.datasetMappingFunction(item))
      )
    );

    return documentList.flat();
  }

  /**
   * Create an ApifyDatasetLoader by calling an Actor on the Apify platform and waiting for its results to be ready.
   * @param actorId The ID or name of the Actor on the Apify platform.
   * @param input The input object of the Actor that you're trying to run.
   * @param options Options specifying settings for the Actor run.
   * @param options.datasetMappingFunction A function that takes a single object (an Apify dataset item) and converts it to an instance of the Document class.
   * @returns An instance of `ApifyDatasetLoader` with the results from the Actor run.
   */
  static async fromActorCall<Metadata extends Record<string, any>>(
    actorId: string,
    input: Record<string | number, unknown>,
    config: {
      callOptions?: ActorCallOptions;
      clientOptions?: ApifyClientOptions;
      datasetMappingFunction: ApifyDatasetMappingFunction<Metadata>;
    }
  ): Promise<ApifyDatasetLoader<Metadata>> {
    const apifyApiToken = ApifyDatasetLoader._getApifyApiToken(
      config.clientOptions
    );
    const apifyClient = new ApifyClient({ token: apifyApiToken });

    const actorCall = await apifyClient
      .actor(actorId)
      .call(input, config.callOptions ?? {});

    return new ApifyDatasetLoader(actorCall.defaultDatasetId, {
      datasetMappingFunction: config.datasetMappingFunction,
      clientOptions: { ...config.clientOptions, token: apifyApiToken },
    });
  }

  /**
   * Create an ApifyDatasetLoader by calling a saved Actor task on the Apify platform and waiting for its results to be ready.
   * @param taskId The ID or name of the task on the Apify platform.
   * @param input The input object of the task that you're trying to run. Overrides the task's saved input.
   * @param options Options specifying settings for the task run.
   * @param options.datasetMappingFunction A function that takes a single object (an Apify dataset item) and converts it to an instance of the Document class.
   * @returns An instance of `ApifyDatasetLoader` with the results from the task's run.
   */
  static async fromActorTaskCall<Metadata extends Record<string, any>>(
    taskId: string,
    input: Record<string | number, unknown>,
    config: {
      callOptions?: TaskCallOptions;
      clientOptions?: ApifyClientOptions;
      datasetMappingFunction: ApifyDatasetMappingFunction<Metadata>;
    }
  ): Promise<ApifyDatasetLoader<Metadata>> {
    const apifyApiToken = ApifyDatasetLoader._getApifyApiToken(
      config.clientOptions
    );
    const apifyClient = new ApifyClient({ token: apifyApiToken });

    const taskCall = await apifyClient
      .task(taskId)
      .call(input, config.callOptions ?? {});

    return new ApifyDatasetLoader(taskCall.defaultDatasetId, {
      datasetMappingFunction: config.datasetMappingFunction,
      clientOptions: { ...config.clientOptions, token: apifyApiToken },
    });
  }
}
