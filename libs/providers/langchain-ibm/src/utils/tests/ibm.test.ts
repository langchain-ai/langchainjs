import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import {
  IamAuthenticator,
  BearerTokenAuthenticator,
  CloudPakForDataAuthenticator,
} from "ibm-cloud-sdk-core";
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  _isValidMistralToolCallId,
  _convertToolCallIdToMistralCompatible,
  jsonSchemaToZod,
  expectOneOf,
  checkValidProps,
  initWatsonxOrGatewayInstance,
} from "../ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};
const serviceUrl = "https://fake.url/";

describe("Utils tests", () => {
  describe("Authentication", () => {
    test("initWatsonxOrGatewayInstance creates WatsonXAI with IAM", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("initWatsonxOrGatewayInstance creates Gateway with IAM", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
          ...fakeAuthProp,
        },
        true,
      );
      expect(instance).toBeInstanceOf(Gateway);
    });

    test("initWatsonxOrGatewayInstance with bearer token", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "bearertoken",
        watsonxAIBearerToken: "fake_token",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("initWatsonxOrGatewayInstance with cp4d auth", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername: "user",
        watsonxAIPassword: "pass",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("initWatsonxOrGatewayInstance Gateway with bearer token", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "bearertoken",
          watsonxAIBearerToken: "fake_token",
        },
        true,
      );
      expect(instance).toBeInstanceOf(Gateway);
    });

    test("initWatsonxOrGatewayInstance Gateway with cp4d auth", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "cp4d",
          watsonxAIUsername: "user",
          watsonxAIPassword: "pass",
        },
        true,
      );
      expect(instance).toBeInstanceOf(Gateway);
    });
  });

  describe("Authentication with alternative prop names", () => {
    test("initWatsonxOrGatewayInstance with apiKey instead of watsonxAIApikey", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        authType: "iam",
        apiKey: "fake_key",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("initWatsonxOrGatewayInstance with apiKey instead of watsonxAIApikey and 'iam' as default authType", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        apiKey: "fake_key",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("initWatsonxOrGatewayInstance with bearerToken instead of watsonxAIBearerToken", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        authType: "bearertoken",
        bearerToken: "fake_token",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("initWatsonxOrGatewayInstance with username/password instead of watsonxAI prefixed", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        authType: "cp4d",
        username: "user",
        password: "pass",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("initWatsonxOrGatewayInstance Gateway with alternative prop names", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
          authType: "iam",
          apiKey: "fake_key",
        },
        true,
      );
      expect(instance).toBeInstanceOf(Gateway);
    });
  });

  describe("Authentication fallback to environment variables", () => {
    test("initWatsonxOrGatewayInstance without explicit auth creates instance (env fallback)", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("initWatsonxOrGatewayInstance Gateway without explicit auth creates instance (env fallback)", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
        },
        true,
      );

      expect(instance).toBeInstanceOf(Gateway);
    });
  });

  describe("Authenticator type verification", () => {
    test("creates IamAuthenticator when authType is 'iam' with apiKey", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "iam",
        watsonxAIApikey: "fake_key",
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(IamAuthenticator);
    });

    test("creates BearerTokenAuthenticator when authType is 'bearertoken'", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "bearertoken",
        watsonxAIBearerToken: "fake_token",
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(BearerTokenAuthenticator);
    });

    test("creates CloudPakForDataAuthenticator when authType is 'cp4d' with username and password", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername: "user",
        watsonxAIPassword: "pass",
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
    });

    test("creates CloudPakForDataAuthenticator when authType is 'cp4d' with username and apikey", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername: "user",
        watsonxAIApikey: "fake_key",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
    });

    test("creates IamAuthenticator with alternative prop names (apiKey)", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        authType: "iam",
        apiKey: "fake_key",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(IamAuthenticator);
    });

    test("creates BearerTokenAuthenticator with alternative prop names (bearerToken)", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "bearertoken",
        bearerToken: "fake_token",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(BearerTokenAuthenticator);
    });

    test("creates CloudPakForDataAuthenticator with alternative prop names (username/password)", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        username: "user",
        password: "pass",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
    });

    test("defaults to 'iam' authType when only apiKey is provided", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        apiKey: "fake_key",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(IamAuthenticator);
    });

    test("Gateway instance creates IamAuthenticator", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "iam",
          watsonxAIApikey: "fake_key",
        },
        true,
      );
      expect(instance).toBeInstanceOf(Gateway);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(IamAuthenticator);
    });

    test("Gateway instance creates BearerTokenAuthenticator", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "bearertoken",
          watsonxAIBearerToken: "fake_token",
        },
        true,
      );
      expect(instance).toBeInstanceOf(Gateway);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(BearerTokenAuthenticator);
    });

    test("Gateway instance creates CloudPakForDataAuthenticator", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "cp4d",
          watsonxAIUsername: "user",
          watsonxAIPassword: "pass",
        },
        true,
      );
      expect(instance).toBeInstanceOf(Gateway);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
    });
  });

  describe("Environment variable fallback behavior", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment before each test
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    test("falls back to environment variables when no auth params provided", () => {
      // Set environment variables that the IBM SDK would use
      process.env.WATSONX_AI_APIKEY = "env_api_key";

      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      // When no authenticator is explicitly provided, SDK uses env vars
      // The instance should still be created successfully
    });

    test("explicit params override environment variables", () => {
      // Set environment variables
      process.env.WATSONX_AI_APIKEY = "env_api_key";

      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "iam",
        watsonxAIApikey: "explicit_key",
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(IamAuthenticator);
      expect(authenticator.apikey).toBe("explicit_key");
    });

    test("creates instance when no explicit credentials provided (relies on SDK env fallback)", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
    });
  });

  describe("CP4D authentication with custom URL", () => {
    test("uses watsonxAIUrl for CP4D authentication URL", () => {
      const customUrl = "https://custom.cp4d.url";
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername: "user",
        watsonxAIPassword: "pass",
        watsonxAIUrl: customUrl,
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
      expect(authenticator.url).toBe(`${customUrl}/icp4d-api/v1/authorize`);
    });

    test("falls back to serviceUrl for CP4D authentication URL when watsonxAIUrl not provided", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername: "user",
        watsonxAIPassword: "pass",
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
      expect(authenticator.url).toBe(`${serviceUrl}icp4d-api/v1/authorize`);
    });

    test("uses authUrl as alternative to watsonxAIUrl", () => {
      const customUrl = "https://custom.auth.url";
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        username: "user",
        password: "pass",
        authUrl: customUrl,
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
      expect(authenticator.url).toBe(`${customUrl}/icp4d-api/v1/authorize`);
    });

    test("watsonxAIUrl takes precedence over authUrl", () => {
      const primaryUrl = "https://primary.url";
      const fallbackUrl = "https://fallback.url";
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername: "user",
        watsonxAIPassword: "pass",
        watsonxAIUrl: primaryUrl,
        authUrl: fallbackUrl,
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
      expect(authenticator.url).toBe(`${primaryUrl}/icp4d-api/v1/authorize`);
    });

    test("CP4D with disableSSL option", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername: "user",
        watsonxAIPassword: "pass",
        disableSSL: true,
      });

      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeInstanceOf(CloudPakForDataAuthenticator);
      expect(authenticator.disableSslVerification).toBe(true);
    });
  });

  describe("Invalid authentication configurations", () => {
    test("IAM without apikey throws error", () => {
      expect(() => {
        initWatsonxOrGatewayInstance({
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "iam",
        });
      }).toThrow(/ApiKey is required for IAM auth/);
    });

    test("bearertoken without token throws error", () => {
      expect(() => {
        initWatsonxOrGatewayInstance({
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "bearertoken",
        });
      }).toThrow(/BearerToken is required for BearerToken auth/);
    });

    test("CP4D without username throws error", () => {
      expect(() => {
        initWatsonxOrGatewayInstance({
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "cp4d",
          watsonxAIPassword: "pass",
        });
      }).toThrow(/Username and Password or ApiKey is required/);
    });

    test("CP4D without password or apikey throws error", () => {
      expect(() => {
        initWatsonxOrGatewayInstance({
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "cp4d",
          watsonxAIUsername: "user",
        });
      }).toThrow(/Username and Password or ApiKey is required/);
    });

    test("CP4D with username but no password or apikey throws error", () => {
      expect(() => {
        initWatsonxOrGatewayInstance({
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "cp4d",
          watsonxAIUsername: "user",
        });
      }).toThrow(/Username and Password or ApiKey is required/);
    });
  });

  describe("AWS authentication", () => {
    test("creates AWS authenticator with apikey and url", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "aws",
        watsonxAIApikey: "fake_key",
        watsonxAIUrl: "https://aws.url",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeDefined();
      // AWS authenticator is a custom type from the SDK
      expect(authenticator.constructor.name).toBe("AWSAuthenticator");
    });

    test("creates AWS authenticator with alternative prop names", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        authType: "aws",
        apiKey: "fake_key",
        authUrl: "https://aws.url",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeDefined();
      expect(authenticator.constructor.name).toBe("AWSAuthenticator");
    });

    test("AWS authenticator with disableSSL option", () => {
      const instance = initWatsonxOrGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "aws",
        watsonxAIApikey: "fake_key",
        watsonxAIUrl: "https://aws.url",
        disableSSL: true,
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeDefined();
      expect(authenticator.disableSslVerification).toBe(true);
    });

    test("Gateway instance creates AWS authenticator", () => {
      const instance = initWatsonxOrGatewayInstance(
        {
          version: "2024-05-31",
          serviceUrl,
          watsonxAIAuthType: "aws",
          watsonxAIApikey: "fake_key",
          watsonxAIUrl: "https://aws.url",
        },
        true,
      );
      expect(instance).toBeInstanceOf(Gateway);
      const authenticator = instance["authenticator"];
      expect(authenticator).toBeDefined();
      expect(authenticator.constructor.name).toBe("AWSAuthenticator");
    });
  });

  describe("Mistral tool call ID conversion", () => {
    test("valid 9-char alphanumeric ID is accepted", () => {
      expect(_isValidMistralToolCallId("abc123XYZ")).toBe(true);
    });

    test("invalid ID is rejected", () => {
      expect(_isValidMistralToolCallId("short")).toBe(false);
      expect(_isValidMistralToolCallId("too-long-id-value")).toBe(false);
      expect(_isValidMistralToolCallId("has space")).toBe(false);
    });

    test("valid ID is returned unchanged", () => {
      expect(_convertToolCallIdToMistralCompatible("abc123XYZ")).toBe(
        "abc123XYZ"
      );
    });

    test("invalid ID is converted to a 9-char string", () => {
      const result =
        _convertToolCallIdToMistralCompatible("some-long-id-value");
      expect(result).toHaveLength(9);
      expect(_isValidMistralToolCallId(result)).toBe(true);
    });
  });

  describe("jsonSchemaToZod", () => {
    test("converts simple object schema", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string", description: "The name" },
          age: { type: "number" },
        },
        required: ["name"],
      };
      const zodSchema = jsonSchemaToZod(schema);
      expect(zodSchema).toBeDefined();
    });

    test("throws for non-object schema", () => {
      expect(() => jsonSchemaToZod({ type: "string" })).toThrow(
        "Unsupported root schema type"
      );
    });

    test("throws for undefined schema", () => {
      expect(() => jsonSchemaToZod(undefined)).toThrow(
        "Unsupported root schema type"
      );
    });
  });

  describe("expectOneOf", () => {
    test("passes when exactly one key is provided", () => {
      expect(() => expectOneOf({ a: 1 }, ["a", "b", "c"], true)).not.toThrow();
    });

    test("throws when no keys are provided with exactlyOneOf", () => {
      expect(() => expectOneOf({}, ["a", "b"], true)).toThrow(
        /Expected exactly one of/
      );
    });

    test("throws when multiple keys are provided with exactlyOneOf", () => {
      expect(() => expectOneOf({ a: 1, b: 2 }, ["a", "b"], true)).toThrow(
        /Expected exactly one of/
      );
    });

    test("passes when no keys are provided without exactlyOneOf", () => {
      expect(() => expectOneOf({}, ["a", "b"])).not.toThrow();
    });

    test("throws when multiple keys are provided without exactlyOneOf", () => {
      expect(() => expectOneOf({ a: 1, b: 2 }, ["a", "b"])).toThrow(
        /Expected one of/
      );
    });
  });

  describe("checkValidProps", () => {
    test("passes when all props are allowed", () => {
      expect(() =>
        checkValidProps({ a: 1, b: 2 }, ["a", "b", "c"])
      ).not.toThrow();
    });

    test("throws when unexpected props are found", () => {
      expect(() => checkValidProps({ a: 1, unknown: 2 }, ["a", "b"])).toThrow(
        /Unexpected properties: unknown/
      );
    });
  });
});
