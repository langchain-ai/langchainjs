import type { BedrockRuntimeClientConfig } from "@aws-sdk/client-bedrock-runtime";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export const AWS_BEARER_TOKEN_BEDROCK = "AWS_BEARER_TOKEN_BEDROCK";

export function resolveBedrockBearerToken(token?: string): string | undefined {
  return token ?? getEnvironmentVariable(AWS_BEARER_TOKEN_BEDROCK);
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
