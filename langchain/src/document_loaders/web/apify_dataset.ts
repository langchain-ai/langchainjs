import {
  ApifyClient,
  ApifyClientOptions,
  ActorCallOptions,
  TaskCallOptions,
} from "apify-client";

import { Document } from "../../document.js";
import { BaseDocumentLoader, DocumentLoader } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";

export type ApifyDatasetMappingFunction = (
  item: Record<string | number, unknown>
) => Document;

export class ApifyDatasetLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  protected apifyClient: ApifyClient;

  protected datasetId: string;

  protected datasetMappingFunction: (
    item: Record<string | number, unknown>
  ) => Document;

  constructor(
    datasetId: string,
    config: {
      datasetMappingFunction: ApifyDatasetMappingFunction;
      clientOptions?: ApifyClientOptions;
    }
  ) {
    super();
    const apifyApiToken = ApifyDatasetLoader._getApifyApiToken(
      config.clientOptions
    );
    this.apifyClient = new ApifyClient({
      ...config.clientOptions,
      token: apifyApiToken,
    });
    this.datasetId = datasetId;
    this.datasetMappingFunction = config.datasetMappingFunction;
  }

  private static _getApifyApiToken(config?: { token?: string }) {
    return config?.token ?? getEnvironmentVariable("APIFY_API_TOKEN");
  }

  async load(): Promise<Document[]> {
    const datasetItems = (
      await this.apifyClient.dataset(this.datasetId).listItems({ clean: true })
    ).items;
    return datasetItems.map(this.datasetMappingFunction);
  }

  /**
   * Create an ApifyDatasetLoader by calling an Actor on the Apify platform and waiting for its results to be ready.
   * @param actorId The ID or name of the Actor on the Apify platform.
   * @param input The input object of the Actor that you're trying to run.
   * @param options Options specifying settings for the Actor run.
   * @param options.datasetMappingFunction A function that takes a single object (an Apify dataset item) and converts it to an instance of the Document class.
   * @returns An instance of `ApifyDatasetLoader` with the results from the Actor run.
   */
  static async fromActorCall(
    actorId: string,
    input: Record<string | number, unknown>,
    config: {
      callOptions?: ActorCallOptions;
      clientOptions?: ApifyClientOptions;
      datasetMappingFunction: ApifyDatasetMappingFunction;
    }
  ): Promise<ApifyDatasetLoader> {
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
  static async fromActorTaskCall(
    taskId: string,
    input: Record<string | number, unknown>,
    config: {
      callOptions?: TaskCallOptions;
      clientOptions?: ApifyClientOptions;
      datasetMappingFunction: ApifyDatasetMappingFunction;
    }
  ): Promise<ApifyDatasetLoader> {
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
