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
  memory?: number;
  /**
   * Timeout for the actor run in seconds. Zero value means there is no timeout.
   * If not provided, the run uses timeout of the default actor run configuration.
   */
  timeout?: number;
}

export class ApifyWrapper {
  protected apiToken: string;

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

    const actorCall = await apifyClient.actor(actorId).call(input, options);

    return new ApifyDatasetLoader(
      actorCall.defaultDatasetId,
      datasetMappingFunction
    );
  }
}
