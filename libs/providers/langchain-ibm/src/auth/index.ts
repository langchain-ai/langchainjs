/**
 * Authentication module for IBM watsonx.ai
 *
 * This module provides authentication utilities for connecting to IBM watsonx.ai services.
 * It supports multiple authentication methods:
 * - IAM (IBM Cloud Identity and Access Management)
 * - Bearer Token
 * - Cloud Pak for Data (CP4D)
 * - AWS
 *
 * @module auth
 */

export { createAuthenticator } from "./authenticator.js";
export { prepareInstanceConfig } from "./config.js";
export type { InstanceConfig } from "./config.js";
