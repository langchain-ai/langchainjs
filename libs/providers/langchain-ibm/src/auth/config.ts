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
  // Validate that both legacy and new properties are not provided simultaneously
  const conflicts: string[] = [];
  if (watsonxAIApikey && apiKey) conflicts.push("apiKey/watsonxAIApikey");
  if (watsonxAIAuthType && authType)
    conflicts.push("authType/watsonxAIAuthType");
  if (watsonxAIBearerToken && bearerToken)
    conflicts.push("bearerToken/watsonxAIBearerToken");
  if (watsonxAIUsername && username)
    conflicts.push("username/watsonxAIUsername");
  if (watsonxAIPassword && password)
    conflicts.push("password/watsonxAIPassword");
  if (watsonxAIUrl && authUrl) conflicts.push("authUrl/watsonxAIUrl");

  if (conflicts.length > 0) {
    console.warn(
      `Warning: Both legacy and new property names provided for: ${conflicts.join(", ")}. ` +
        `Using legacy values (watsonxAI*). Consider using only the new property names.`,
    );
  }

  // Auto-detect IAM auth when apiKey is provided without username
  const isIam =
    (watsonxAIApikey || apiKey) && !(watsonxAIUsername || username)
      ? "iam"
      : undefined;

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
