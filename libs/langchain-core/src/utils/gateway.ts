import { getEnvironmentVariable } from "./env.js";

const LANGSMITH_GATEWAY = "LANGSMITH_GATEWAY";
const LANGSMITH_GATEWAY_API_KEY = "LANGSMITH_GATEWAY_API_KEY";
const LANGSMITH_API_KEY = "LANGSMITH_API_KEY";
const DEFAULT_LANGSMITH_GATEWAY = "https://gateway.smith.langchain.com";
const TRUE_VALUES = ["true", "1", "yes"];
const FALSE_VALUES = ["false", "0", "no"];

export interface LangSmithGatewayConfigOptions<TApiKey> {
  baseURL?: string;
  apiKey?: TApiKey;
  providerApiKey?: string;
  providerPath: string;
}

export interface LangSmithGatewayConfig<TApiKey> {
  baseURL?: string;
  apiKey?: TApiKey | string;
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

export function resolveLangSmithGatewayConfig<TApiKey = string>({
  baseURL,
  apiKey,
  providerApiKey,
  providerPath,
}: LangSmithGatewayConfigOptions<TApiKey>): LangSmithGatewayConfig<TApiKey> {
  const gatewayBaseURL = resolveLangSmithGatewayBaseURL(providerPath);
  const baseURLFromGateway =
    baseURL === undefined && gatewayBaseURL !== undefined;
  const resolvedBaseURL = baseURL ?? gatewayBaseURL;

  if (apiKey !== undefined) {
    return { baseURL: resolvedBaseURL, apiKey };
  }

  let gatewayApiKey = gatewayBaseURL
    ? getEnvironmentVariable(LANGSMITH_GATEWAY_API_KEY)
    : undefined;
  if (!gatewayApiKey && baseURLFromGateway) {
    gatewayApiKey = getEnvironmentVariable(LANGSMITH_API_KEY);
  }

  return {
    baseURL: resolvedBaseURL,
    apiKey: baseURLFromGateway
      ? gatewayApiKey || providerApiKey
      : providerApiKey || gatewayApiKey,
  };
}
