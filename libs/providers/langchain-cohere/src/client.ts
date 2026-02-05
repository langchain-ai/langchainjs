import { CohereClient } from "cohere-ai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export type CohereClientOptions = {
  /**
   * The API key to use. Ignored if `client` is provided
   * @default {process.env.COHERE_API_KEY}
   */
  apiKey?: string;

  /**
   * The CohereClient instance to use. Superseeds `apiKey`
   */
  client?: CohereClient;
};

export function getCohereClient(fields?: CohereClientOptions): CohereClient {
  if (fields?.client) {
    return fields.client;
  }

  const apiKey = fields?.apiKey ?? getEnvironmentVariable("COHERE_API_KEY");

  if (!apiKey) {
    throw new Error("COHERE_API_KEY must be set");
  }
  return new CohereClient({ token: apiKey });
}
