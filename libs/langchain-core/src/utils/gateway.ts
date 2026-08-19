import { getEnvironmentVariable } from "./env.js";

const LANGSMITH_GATEWAY = "LANGSMITH_GATEWAY";
const LANGSMITH_GATEWAY_API_KEY = "LANGSMITH_GATEWAY_API_KEY";
const LANGSMITH_API_KEY = "LANGSMITH_API_KEY";
export const DEFAULT_LANGSMITH_GATEWAY = "https://gateway.smith.langchain.com";
const TRUE_VALUES = ["true", "1", "yes"];
const FALSE_VALUES = ["false", "0", "no"];

export interface LangSmithGatewayConfigOptions {
  baseURL?: string;
  providerPath: string;
}

export interface LangSmithGatewayConfig {
  baseURL?: string;
  apiKey?: string;
}

function resolveLangSmithGatewayBaseURL(
  providerPath: string
): string | undefined {
  const value = getEnvironmentVariable(LANGSMITH_GATEWAY);
  if (!value || FALSE_VALUES.includes(value.toLowerCase())) {
    return undefined;
  }
  const baseURL = TRUE_VALUES.includes(value.toLowerCase())
    ? DEFAULT_LANGSMITH_GATEWAY
    : value.replace(/\/+$/, "");
  return `${baseURL}/${providerPath}`;
}

export function resolveLangSmithGatewayConfig({
  baseURL,
  providerPath,
}: LangSmithGatewayConfigOptions): LangSmithGatewayConfig {
  if (baseURL !== undefined) {
    return { baseURL };
  }

  const gatewayBaseURL = resolveLangSmithGatewayBaseURL(providerPath);
  if (gatewayBaseURL === undefined) {
    return {};
  }

  return {
    baseURL: gatewayBaseURL,
    apiKey:
      getEnvironmentVariable(LANGSMITH_GATEWAY_API_KEY) ||
      getEnvironmentVariable(LANGSMITH_API_KEY),
  };
}
