import {
  OpenAIEmbeddings,
  type OpenAIEmbeddingsParams,
} from "@langchain/openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export interface OVHcloudAIEndpointsEmbeddingsParams
  extends Partial<Omit<OpenAIEmbeddingsParams, "openAIApiKey">> {
  /**
   * The OVHcloud API key to use for requests.
   * @default process.env.OVHCLOUD_AI_ENDPOINTS_API_KEY
   */
  apiKey?: string;
}

/**
 * OVHcloud AI Endpoints embeddings integration.
 *
 * OVHcloud AI Endpoints is compatible with the OpenAI API.
 * Base URL: https://oai.endpoints.kepler.ai.cloud.ovh.net/v1
 *
 * Setup:
 * Install `@langchain/community` and set an environment variable named `OVHCLOUD_AI_ENDPOINTS_API_KEY`.
 * If no API key is provided, the model can still be used but with a rate limit.
 *
 * ```bash
 * npm install @langchain/community
 * export OVHCLOUD_AI_ENDPOINTS_API_KEY="your-api-key"
 * ```
 *
 */
export class OVHcloudAIEndpointsEmbeddings extends OpenAIEmbeddings {
  constructor(fields?: OVHcloudAIEndpointsEmbeddingsParams) {
    const apiKey =
      fields?.apiKey || getEnvironmentVariable("OVHCLOUD_AI_ENDPOINTS_API_KEY");

    if (!apiKey) {
      console.warn(
        "OVHcloud AI Endpoints API key not found. You can use the model but with a rate limit. " +
          "Set the OVHCLOUD_AI_ENDPOINTS_API_KEY environment variable or provide the key via 'apiKey' for unlimited access."
      );
    }

    super({
      ...fields,
      apiKey: apiKey || "",
      model: fields?.model || "bge-multilingual-gemma2",
      configuration: {
        baseURL: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
      },
    });
  }
}
