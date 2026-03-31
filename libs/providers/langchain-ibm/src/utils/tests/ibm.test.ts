import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import { describe, test, expect } from "vitest";
import {
  authenticateAndSetInstance,
  authenticateAndSetGatewayInstance,
  _isValidMistralToolCallId,
  _convertToolCallIdToMistralCompatible,
  jsonSchemaToZod,
  expectOneOf,
  checkValidProps,
} from "../ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};
const serviceUrl = "https://fake.url/";

describe("Utils tests", () => {
  describe("Authentication", () => {
    test("authenticateAndSetInstance creates WatsonXAI with IAM", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("authenticateAndSetGatewayInstance creates Gateway with IAM", () => {
      const instance = authenticateAndSetGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(Gateway);
    });

    test("authenticateAndSetInstance with bearer token", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "bearertoken",
        watsonxAIBearerToken: "fake_token",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("authenticateAndSetInstance with cp4d auth", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername: "user",
        watsonxAIPassword: "pass",
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("authenticateAndSetInstance with cp4d auth returns undefined without credentials", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl,
        watsonxAIAuthType: "cp4d",
      });
      expect(instance).toBeUndefined();
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
      const result = _convertToolCallIdToMistralCompatible("some-long-id-value");
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
      expect(() =>
        expectOneOf({ a: 1 }, ["a", "b", "c"], true)
      ).not.toThrow();
    });

    test("throws when no keys are provided with exactlyOneOf", () => {
      expect(() =>
        expectOneOf({}, ["a", "b"], true)
      ).toThrow(/Expected exactly one of/);
    });

    test("throws when multiple keys are provided with exactlyOneOf", () => {
      expect(() =>
        expectOneOf({ a: 1, b: 2 }, ["a", "b"], true)
      ).toThrow(/Expected exactly one of/);
    });

    test("passes when no keys are provided without exactlyOneOf", () => {
      expect(() => expectOneOf({}, ["a", "b"])).not.toThrow();
    });

    test("throws when multiple keys are provided without exactlyOneOf", () => {
      expect(() =>
        expectOneOf({ a: 1, b: 2 }, ["a", "b"])
      ).toThrow(/Expected one of/);
    });
  });

  describe("checkValidProps", () => {
    test("passes when all props are allowed", () => {
      expect(() =>
        checkValidProps({ a: 1, b: 2 }, ["a", "b", "c"])
      ).not.toThrow();
    });

    test("throws when unexpected props are found", () => {
      expect(() =>
        checkValidProps({ a: 1, unknown: 2 }, ["a", "b"])
      ).toThrow(/Unexpected properties: unknown/);
    });
  });
});
