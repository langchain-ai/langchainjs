import {
  IamAuthenticator,
  BearerTokenAuthenticator,
  CloudPakForDataAuthenticator,
  Authenticator,
} from "ibm-cloud-sdk-core";
import { AWSAuthenticator } from "@ibm-cloud/watsonx-ai/authentication";
import { WatsonxAuth, WatsonxAuthenticationError } from "../types.js";

/**
 * Creates an IBM Cloud SDK authenticator based on the provided authentication configuration.
 *
 * @param config - Authentication configuration
 * @returns Authenticator instance or undefined if no auth type specified
 * @throws {WatsonxAuthenticationError} If required credentials are missing for the specified auth type
 *
 * @example
 * ```typescript
 * // IAM authentication
 * const iamAuth = createAuthenticator({
 *   watsonxAIAuthType: "iam",
 *   watsonxAIApikey: "your-api-key"
 * });
 *
 * // Bearer token authentication
 * const bearerAuth = createAuthenticator({
 *   watsonxAIAuthType: "bearertoken",
 *   watsonxAIBearerToken: "your-bearer-token"
 * });
 *
 * // Cloud Pak for Data authentication
 * const cp4dAuth = createAuthenticator({
 *   watsonxAIAuthType: "cp4d",
 *   watsonxAIUsername: "your-username",
 *   watsonxAIPassword: "your-password",
 *   watsonxAIUrl: "https://your-cp4d-url.com",
 *   serviceUrl: "https://your-service-url.com"
 * });
 *
 * // AWS authentication
 * const awsAuth = createAuthenticator({
 *   watsonxAIAuthType: "aws",
 *   watsonxAIApikey: "your-api-key",
 *   watsonxAIUrl: "https://your-aws-url.com"
 * });
 * ```
 */
export function createAuthenticator({
  watsonxAIApikey,
  watsonxAIAuthType,
  watsonxAIBearerToken,
  watsonxAIUsername,
  watsonxAIPassword,
  watsonxAIUrl,
  disableSSL,
  serviceUrl,
}: WatsonxAuth): Authenticator | undefined {
  switch (watsonxAIAuthType) {
    case "iam":
      if (watsonxAIApikey) {
        return new IamAuthenticator({
          apikey: watsonxAIApikey,
        });
      }
      throw new WatsonxAuthenticationError("ApiKey is required for IAM auth");

    case "bearertoken":
      if (watsonxAIBearerToken) {
        return new BearerTokenAuthenticator({
          bearerToken: watsonxAIBearerToken,
        });
      }
      throw new WatsonxAuthenticationError(
        "BearerToken is required for BearerToken auth",
      );

    case "cp4d":
      if (watsonxAIUsername && (watsonxAIPassword || watsonxAIApikey)) {
        const watsonxCPDAuthUrl = watsonxAIUrl ?? serviceUrl;
        return new CloudPakForDataAuthenticator({
          username: watsonxAIUsername,
          password: watsonxAIPassword,
          url: new URL("/icp4d-api/v1/authorize", watsonxCPDAuthUrl).toString(),
          apikey: watsonxAIApikey,
          disableSslVerification: disableSSL,
        });
      }
      throw new WatsonxAuthenticationError(
        "Username and Password or ApiKey is required for IBM watsonx.ai software auth",
      );

    case "aws":
      return new AWSAuthenticator({
        apikey: watsonxAIApikey,
        url: watsonxAIUrl,
        disableSslVerification: disableSSL,
      });

    default:
      return undefined;
  }
}
