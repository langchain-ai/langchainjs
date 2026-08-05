import { getEnvironmentVariable } from "./env.js";
import { validateSafeUrl } from "./ssrf.js";

const LANGSMITH_GATEWAY = "LANGSMITH_GATEWAY";
const LANGSMITH_GATEWAY_API_KEY = "LANGSMITH_GATEWAY_API_KEY";
const LANGSMITH_API_KEY = "LANGSMITH_API_KEY";
const DEFAULT_LANGSMITH_GATEWAY = "https://gateway.smith.langchain.com";
const TRUE_VALUES = ["true", "1", "yes"];
const FALSE_VALUES = ["false", "0", "no"];

type EnvironmentVariableNames = string | readonly string[];

function firstEnvironmentVariable(
  names: EnvironmentVariableNames
): string | undefined {
  const environmentVariableNames = typeof names === "string" ? [names] : names;
  for (const name of environmentVariableNames) {
    const value = getEnvironmentVariable(name);
    if (value) {
      return value;
    }
  }
  return undefined;
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
    : validateSafeUrl(value.replace(/\/+$/, ""), {
        allowPrivate: true,
        allowHttp: true,
      });
  return `${baseURL}/${providerPath}`;
}

export function resolveLangSmithGatewayConfig<TApiKey = string>({
  baseURL,
  apiKey,
  providerPath,
  baseURLEnv = [],
  apiKeyEnv = [],
  defaultBaseURL,
}: {
  baseURL?: string;
  apiKey?: TApiKey;
  providerPath: string;
  baseURLEnv?: EnvironmentVariableNames;
  apiKeyEnv?: EnvironmentVariableNames;
  defaultBaseURL?: string;
}): {
  baseURL?: string;
  apiKey?: TApiKey | string;
  baseURLFromGateway: boolean;
} {
  const gatewayBaseURL = resolveLangSmithGatewayBaseURL(providerPath);
  let resolvedBaseURL = baseURL;
  let baseURLFromGateway = false;

  if (resolvedBaseURL === undefined) {
    resolvedBaseURL = firstEnvironmentVariable(baseURLEnv);
    if (resolvedBaseURL === undefined) {
      resolvedBaseURL = gatewayBaseURL ?? defaultBaseURL;
      baseURLFromGateway = gatewayBaseURL !== undefined;
    }
  }

  if (apiKey !== undefined) {
    return {
      baseURL: resolvedBaseURL,
      apiKey,
      baseURLFromGateway,
    };
  }

  let gatewayApiKey = gatewayBaseURL
    ? getEnvironmentVariable(LANGSMITH_GATEWAY_API_KEY)
    : undefined;
  if (!gatewayApiKey && baseURLFromGateway) {
    gatewayApiKey = getEnvironmentVariable(LANGSMITH_API_KEY);
  }
  const providerApiKey = firstEnvironmentVariable(apiKeyEnv);
  const resolvedApiKey = baseURLFromGateway
    ? gatewayApiKey || providerApiKey
    : providerApiKey || gatewayApiKey;

  return {
    baseURL: resolvedBaseURL,
    apiKey: resolvedApiKey,
    baseURLFromGateway,
  };
}
