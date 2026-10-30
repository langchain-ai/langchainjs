import type { BedrockRuntimeClientConfig } from "@aws-sdk/client-bedrock-runtime";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { resolveLangSmithGatewayConfig } from "@langchain/core/utils/gateway";

export const AWS_BEARER_TOKEN_BEDROCK = "AWS_BEARER_TOKEN_BEDROCK";

export function resolveBedrockBearerToken(token?: string): string | undefined {
  return token ?? getEnvironmentVariable(AWS_BEARER_TOKEN_BEDROCK);
}

export function resolveBedrockGatewayConfig(endpointHost?: string) {
  const gatewayConfig = resolveLangSmithGatewayConfig({
    baseURL: endpointHost ? `https://${endpointHost}` : undefined,
    providerPath: "bedrock",
  });
  return {
    endpoint: gatewayConfig.baseURL,
    bearerToken: resolveBedrockBearerToken(gatewayConfig.apiKey),
  };
}

export function createBedrockBearerTokenClientConfig(
  token?: string
): Pick<BedrockRuntimeClientConfig, "authSchemePreference" | "token"> {
  if (!token) {
    return {};
  }

  return {
    authSchemePreference: ["httpBearerAuth"],
    token: async () => ({ token }),
  };
}
