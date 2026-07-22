import {
  IamAuthenticator,
  BearerTokenAuthenticator,
  CloudPakForDataAuthenticator,
  Authenticator,
} from "ibm-cloud-sdk-core";
import { AWSAuthenticator } from "@ibm-cloud/watsonx-ai/authentication";
import { WatsonxAuth } from "../types.js";

/**
 * Creates an IBM Cloud SDK authenticator based on the provided authentication configuration.
 *
 * @param config - Authentication configuration
 * @returns Authenticator instance or undefined if no auth type specified
 * @throws {Error} If required credentials are missing for the specified auth type
 *
 * @example
 * ```typescript
 * // IAM authentication
 * const iamAuth = createAuthenticator({
 *   apiKey: "your-api-key"
 * });
 *
 * // Bearer token authentication
 * const bearerAuth = createAuthenticator({
 *   authType: "bearertoken",
 *   bearerToken: "your-bearer-token"
 * });
 *
 * // Cloud Pak for Data authentication
 * const cp4dAuth = createAuthenticator({
 *   authType: "cp4d",
 *   username: "your-username",
 *   password: "your-password",
 *   authUrl: "https://your-cp4d-url.com",
 *   serviceUrl: "https://your-service-url.com"
 * });
 *
 * // AWS authentication
 * const awsAuth = createAuthenticator({
 *   authType: "aws",
 *   apiKey: "your-api-key",
 *   authUrl: "https://your-aws-url.com"
 * });
 * ```
 */
export function createAuthenticator({
  apiKey,
  authType,
  bearerToken,
  username,
  password,
  authUrl,
  disableSSL,
  serviceUrl,
}: WatsonxAuth): Authenticator | undefined {
  switch (authType) {
    case "iam":
      if (apiKey) {
        return new IamAuthenticator({
          apikey: apiKey,
          url: authUrl,
        });
      }
      throw new Error("ApiKey is required for IAM auth");

    case "bearertoken":
      if (bearerToken) {
        return new BearerTokenAuthenticator({
          bearerToken,
        });
      }
      throw new Error("BearerToken is required for BearerToken auth");

    case "cp4d":
      if (username && (password || apiKey)) {
        const watsonxCPDAuthUrl = authUrl ?? serviceUrl;
        return new CloudPakForDataAuthenticator({
          username,
          password,
          url: new URL("/icp4d-api/v1/authorize", watsonxCPDAuthUrl).toString(),
          apikey: apiKey,
          disableSslVerification: disableSSL,
        });
      }
      throw new Error(
        "Username and Password or ApiKey is required for IBM watsonx.ai software auth"
      );

    case "aws":
      return new AWSAuthenticator({
        apikey: apiKey,
        url: authUrl,
        disableSslVerification: disableSSL,
      });

    default:
      return undefined;
  }
}
