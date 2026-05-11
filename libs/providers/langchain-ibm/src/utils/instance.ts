/**
 * WatsonX AI instance initialization utilities
 * @module utils/instance
 */

import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import {
  WatsonxAuth,
  WatsonxInit,
  WatsonxAuthenticationError,
} from "../types.js";
import { prepareInstanceConfig } from "../auth/index.js";

/**
 * Initializes and returns a WatsonX AI or Gateway instance with authentication.
 *
 * @param params - Initialization and authentication parameters
 * @param useGateway - If true, returns Gateway instance; otherwise returns WatsonXAI instance
 * @returns Configured WatsonXAI or Gateway instance
 * @throws {WatsonxAuthenticationError} If authentication fails
 *
 * @example
 * ```typescript
 * // Initialize WatsonX AI instance
 * const watsonx = initWatsonxOrGatewayInstance({
 *   version: "2024-05-31",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   apiKey: "your-api-key"
 * });
 *
 * // Initialize Gateway instance
 * const gateway = initWatsonxOrGatewayInstance({
 *   version: "2024-05-31",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   apiKey: "your-api-key"
 * }, true);
 * ```
 */
export function initWatsonxOrGatewayInstance(
  params: WatsonxAuth & Omit<WatsonxInit, "authenticator">,
  useGateway: true
): Gateway;
export function initWatsonxOrGatewayInstance(
  params: WatsonxAuth & Omit<WatsonxInit, "authenticator">,
  useGateway?: false
): WatsonXAI;
export function initWatsonxOrGatewayInstance(
  params: WatsonxAuth & Omit<WatsonxInit, "authenticator">,
  useGateway = false
): WatsonXAI | Gateway {
  const config = prepareInstanceConfig(params);
  try {
    return useGateway ? new Gateway(config) : new WatsonXAI(config);
  } catch (_e) {
    throw new WatsonxAuthenticationError(
      "You have not provided any type of authentication"
    );
  }
}
