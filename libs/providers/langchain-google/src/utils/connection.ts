import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { resolveLangSmithGatewayConfig } from "@langchain/core/utils/gateway";
import { GENERATIVE_AI_AUTH_SCOPES, VERTEX_AI_AUTH_SCOPES } from "../const.js";

export type GooglePlatformType = "gai" | "gcp";

export function resolvePlatformFromParams(params?: {
  platformType?: GooglePlatformType;
  vertexai?: boolean;
}): GooglePlatformType | undefined {
  if (typeof params === "undefined") {
    return undefined;
  }
  if (typeof params.platformType !== "undefined") {
    return params.platformType;
  }
  if (params.vertexai === true) {
    return "gcp";
  }
  return undefined;
}

export function hasVertexCredentials(params: {
  credentials?: unknown;
  googleAuthOptions?: unknown;
}): boolean {
  return (
    typeof params.credentials !== "undefined" ||
    typeof params.googleAuthOptions !== "undefined" ||
    typeof getEnvironmentVariable("GOOGLE_CLOUD_CREDENTIALS") !== "undefined"
  );
}

/**
 * Resolves LangSmith gateway routing for Google model params.
 *
 * The LangSmith gateway exposes direct paths for the Gemini Developer API and
 * Vertex AI. An explicit `endpoint` or explicit credentials (`apiKey`,
 * `credentials`, `googleAuthOptions`) suppress gateway routing.
 *
 * When `LANGSMITH_GATEWAY` is set, this rewrites `endpoint` to the gateway
 * host and uses the gateway key as the API key. The default
 * `https` gateway host is written scheme-less (the URL builders prepend
 * `https://`); a non-`https` custom gateway keeps its scheme so it is not
 * forced to TLS.
 *
 * This function is pure: it never mutates `params`. It returns a new object
 * with the gateway overrides applied when routing is active, or an unchanged
 * shallow copy otherwise.
 */
export function applyGeminiGatewayParams<TParams extends object>(
  params: TParams
): TParams & {
  apiKey?: string;
  endpoint?: string;
  platformType?: GooglePlatformType;
} {
  const p = params as {
    apiKey?: string;
    endpoint?: string;
    platformType?: GooglePlatformType;
    vertexai?: boolean;
    credentials?: unknown;
    googleAuthOptions?: unknown;
  };
  if (
    typeof p.endpoint !== "undefined" ||
    typeof p.apiKey !== "undefined" ||
    typeof p.credentials !== "undefined" ||
    typeof p.googleAuthOptions !== "undefined"
  ) {
    return { ...params };
  }
  const platform =
    resolvePlatformFromParams(p) ?? (hasVertexCredentials(p) ? "gcp" : "gai");
  const gatewayConfig = resolveLangSmithGatewayConfig({
    providerPath: platform === "gcp" ? "vertex" : "gemini",
  });
  if (typeof gatewayConfig.baseURL === "undefined") {
    return { ...params };
  }

  const gatewayUrl = new URL(gatewayConfig.baseURL);
  const path = gatewayUrl.pathname.replace(/\/+$/, "");
  // The URL builders compose `https://${endpoint}/${apiVersion}/...`. For the
  // default `https` gateway, keep the endpoint scheme-less (host + path) so the
  // builder's `https://` prefix produces the right URL. For a non-`https`
  // custom gateway (e.g. `http://localhost:8080`), keep the full scheme so the
  // builder does not force TLS; `formatGoogleApiUrl` skips its prefix when the
  // endpoint already includes a scheme.
  const endpoint =
    gatewayUrl.protocol === "https:"
      ? `${gatewayUrl.host}${path}`
      : `${gatewayUrl.protocol}//${gatewayUrl.host}${path}`;
  return {
    ...params,
    apiKey: gatewayConfig.apiKey,
    endpoint,
    platformType: platform,
  };
}

export function getPlatformType(
  platform: GooglePlatformType | undefined,
  hasApiKey: boolean
): GooglePlatformType {
  if (typeof platform !== "undefined") {
    return platform;
  } else if (hasApiKey) {
    return "gai";
  } else {
    return "gcp";
  }
}

export function getRequiredAuthScopes(params: {
  apiKey?: string;
  platformType?: GooglePlatformType;
  vertexai?: boolean;
}): string[] {
  const hasApiKey = typeof params.apiKey !== "undefined";
  const platformType = resolvePlatformFromParams(params);
  const platform = getPlatformType(platformType, hasApiKey);
  switch (platform) {
    case "gai":
      return GENERATIVE_AI_AUTH_SCOPES;
    case "gcp":
      return VERTEX_AI_AUTH_SCOPES;
    default:
      return VERTEX_AI_AUTH_SCOPES;
  }
}

export function resolveGoogleApiVersion(params: {
  platform: GooglePlatformType;
  apiVersion?: string;
}): string {
  if (typeof params.apiVersion !== "undefined") {
    return params.apiVersion;
  } else if (params.platform === "gai") {
    return "v1beta";
  } else {
    return "v1";
  }
}

export function resolveGoogleEndpoint(params: {
  platform: GooglePlatformType;
  endpoint?: string;
  location: string;
  isVertexExpress: boolean;
}): string {
  if (typeof params.endpoint !== "undefined") {
    return params.endpoint;
  } else if (params.platform === "gai") {
    return "generativelanguage.googleapis.com";
  } else if (params.isVertexExpress) {
    return "aiplatform.googleapis.com";
  } else if (params.location === "global") {
    // See https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#use_the_global_endpoint
    return "aiplatform.googleapis.com";
  } else if (!params.location.includes("-")) {
    return `aiplatform.${params.location}.rep.googleapis.com`;
  } else {
    return `${params.location}-aiplatform.googleapis.com`;
  }
}

export function formatGoogleApiUrl(params: {
  endpoint: string;
  apiVersion: string;
  pathPrefix?: string | string[];
  suffix: string;
}): string {
  const endpointUrl = params.endpoint.includes("://")
    ? params.endpoint
    : `https://${params.endpoint}`;
  const rawPrefix = Array.isArray(params.pathPrefix)
    ? params.pathPrefix.join("/")
    : (params.pathPrefix ?? "");
  const normalizedPrefix = rawPrefix.replace(/^\/+|\/+$/g, "");
  const prefixPath = normalizedPrefix ? `/${normalizedPrefix}` : "";

  const [suffixPath, query] = params.suffix.split("?", 2);
  const url = new URL(endpointUrl);
  const basePath = url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePath}/${params.apiVersion}${prefixPath}${suffixPath}`;
  if (query) {
    url.search = query;
  }
  return url.toString();
}
