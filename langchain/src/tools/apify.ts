import { Document } from "../document.js";
import { ApifyDatasetLoader } from "../document_loaders/web/apify_dataset.js";

export interface ApifyCallActorOptions {
  /**
   * Tag or number of the actor build to run (e.g. `beta` or `1.2.345`).
   * If not provided, the run uses build tag or number from the default actor run configuration (typically `latest`).
   */
  build?: string;

  /**
   * Memory in megabytes which will be allocated for the new actor run.
   * If not provided, the run uses memory of the default actor run configuration.
   */
  memoryMbytes?: number;
  /**
   * Timeout for the actor run in seconds. Zero value means there is no timeout.
   * If not provided, the run uses timeout of the default actor run configuration.
   */
  timeoutSecs?: number;
}

/**
 * Wrapper around Apify.
 * To use, you should have the `apify-client` package installed,
 * and the environment variable `APIFY_API_TOKEN` set with your API token, or pass
 * it to the constructor.
 */
export class ApifyWrapper {
  protected apiToken: string;

  /**
   * @param apiToken Apify API token
   */
  constructor(
    apiToken: string | undefined = typeof process !== "undefined"
      ? // eslint-disable-next-line no-process-env
        process.env.APIFY_API_TOKEN
      : undefined
  ) {
    if (!apiToken) {
      throw new Error(
        "Apify API token not set. You can set it as APIFY_API_TOKEN in your .env file, or pass it to the constructor."
      );
    }

    this.apiToken = apiToken;
  }

  static async imports(): Promise<{
    ApifyClientClass: typeof import("apify-client").ApifyClient;
  }> {
    try {
      const { ApifyClient } = await import("apify-client");
      return { ApifyClientClass: ApifyClient };
    } catch (e) {
      throw new Error(
        "Please install apify-client as a dependency with, e.g. `yarn add apify-client`"
      );
    }
  }

  /**
   * Run an Actor on the Apify platform and wait for it to finish, so that its results are ready.
   * @param actorId The ID or name of the Actor on the Apify platform.
   * @param input The input object of the Actor that you're trying to run.
   * @param datasetMappingFunction A function that takes a single object (an Apify dataset item) and converts it to an instance of the Document class.
   * @param options Options specifying additional settings for the Actor run.
   * @returns An instance of `ApifyDatasetLoader` with the results from the Actor run.
   */
  async callActor(
    actorId: string,
    input: unknown,
    datasetMappingFunction: (
      item: Record<string | number, unknown>
    ) => Document,
    options?: ApifyCallActorOptions
  ): Promise<ApifyDatasetLoader> {
    const { ApifyClientClass } = await ApifyWrapper.imports();
    const apifyClient = new ApifyClientClass({ token: this.apiToken });

    const actorCall = await apifyClient.actor(actorId).call(input, {
      ...options,
      memory: options?.memoryMbytes,
      timeout: options?.timeoutSecs,
    });

    return new ApifyDatasetLoader(
      actorCall.defaultDatasetId,
      datasetMappingFunction
    );
  }
}
