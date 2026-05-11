import { Authenticator } from "ibm-cloud-sdk-core";
import { WatsonxAuth, WatsonxInit } from "../types.js";
import { createAuthenticator } from "./authenticator.js";

/**
 * Configuration object returned by prepareInstanceConfig
 */
export interface InstanceConfig {
  version: string;
  serviceUrl: string;
  authenticator?: Authenticator;
}

/**
 * Prepares the configuration object for initializing a WatsonX AI instance.
 * Handles both legacy and new property names, automatically detecting IAM auth when appropriate.
 *
 * @param config - Combined authentication and initialization configuration
 * @returns Configuration object with version, serviceUrl, and optional authenticator
 *
 * @example
 * ```typescript
 * // Using new property names
 * const config = prepareInstanceConfig({
 *   version: "2024-05-31",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   authType: "iam",
 *   apiKey: "your-api-key"
 * });
 *
 * // Using legacy property names (still supported)
 * const legacyConfig = prepareInstanceConfig({
 *   version: "2024-05-31",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   watsonxAIAuthType: "iam",
 *   watsonxAIApikey: "your-api-key"
 * });
 *
 * // Auto-detect IAM auth (when apiKey provided without authType)
 * const autoConfig = prepareInstanceConfig({
 *   version: "2024-05-31",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   apiKey: "your-api-key"
 * });
 * ```
 */
export function prepareInstanceConfig({
  watsonxAIApikey,
  watsonxAIAuthType,
  watsonxAIBearerToken,
  watsonxAIUsername,
  watsonxAIPassword,
  watsonxAIUrl,
  disableSSL,
  version,
  serviceUrl,
  apiKey,
  bearerToken,
  username,
  password,
  authType,
  authUrl,
}: WatsonxAuth & Omit<WatsonxInit, "authenticator">): InstanceConfig {
  // Auto-detect IAM auth when apiKey is provided without username
  const isIam =
    (watsonxAIApikey || apiKey) && !watsonxAIUsername ? "iam" : undefined;

  const authenticator = createAuthenticator({
    watsonxAIApikey: watsonxAIApikey ?? apiKey,
    watsonxAIAuthType: watsonxAIAuthType ?? authType ?? isIam,
    watsonxAIBearerToken: watsonxAIBearerToken ?? bearerToken,
    watsonxAIUsername: watsonxAIUsername ?? username,
    watsonxAIPassword: watsonxAIPassword ?? password,
    watsonxAIUrl: watsonxAIUrl ?? authUrl,
    disableSSL,
    serviceUrl,
  });

  return {
    version,
    serviceUrl,
    ...(authenticator ? { authenticator } : {}),
  };
}
