import { OpenAI as OpenAIClient, type ClientOptions } from "openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { resolveLangSmithGatewayConfig } from "@langchain/core/utils/gateway";

/**
 * Creates the OpenAI client used for Decisions API requests. Without a `baseURL`,
 * `OPENAI_API_BASE` or `OPENAI_BASE_URL`, setting `LANGSMITH_GATEWAY` routes requests
 * through the LangSmith LLM gateway.
 */
export function createDecisionsClient(
  apiKey: string | undefined,
  configuration: Omit<ClientOptions, "apiKey"> | undefined
): OpenAIClient {
  const gateway = resolveLangSmithGatewayConfig({
    baseURL:
      configuration?.baseURL ??
      (getEnvironmentVariable("OPENAI_API_BASE") ||
        getEnvironmentVariable("OPENAI_BASE_URL") ||
        undefined),
    providerPath: "openai/v1",
  });
  return new OpenAIClient({
    ...configuration,
    baseURL: gateway.baseURL,
    apiKey:
      apiKey ?? gateway.apiKey ?? getEnvironmentVariable("OPENAI_API_KEY"),
  });
}
