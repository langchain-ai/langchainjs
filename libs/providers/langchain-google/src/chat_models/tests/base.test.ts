import { describe, expect, test } from "vitest";
import {
  applyGeminiGatewayParams,
  convertParamsToPlatformType,
  getGoogleChatModelParams,
  getPlatformType,
} from "../base.js";

describe("convertParamsToPlatformType", () => {
  test("detects explicit platform type", () => {
    expect(convertParamsToPlatformType({ platformType: "gcp" })).toBe("gcp");
    expect(convertParamsToPlatformType({ platformType: "gai" })).toBe("gai");
  });

  test("detects vertexai flag", () => {
    expect(convertParamsToPlatformType({ vertexai: true })).toBe("gcp");
  });

  test("returns undefined when no platform or vertexai specified", () => {
    expect(convertParamsToPlatformType({})).toBeUndefined();
    expect(convertParamsToPlatformType(undefined)).toBeUndefined();
  });
});

describe("getPlatformType", () => {
  test("returns explicit platform when provided", () => {
    expect(getPlatformType("gcp", false)).toBe("gcp");
    expect(getPlatformType("gcp", true)).toBe("gcp");
    expect(getPlatformType("gai", false)).toBe("gai");
    expect(getPlatformType("gai", true)).toBe("gai");
  });

  test("infers gai when hasApiKey is true and platform is undefined", () => {
    expect(getPlatformType(undefined, true)).toBe("gai");
  });

  test("infers gcp when hasApiKey is false and platform is undefined", () => {
    expect(getPlatformType(undefined, false)).toBe("gcp");
  });
});

describe("getGoogleChatModelParams", () => {
  test("extracts model and merges when model is passed as string", () => {
    const params = getGoogleChatModelParams("gemini-2.5-flash", {
      temperature: 0.7,
    });
    expect(params).toEqual({
      model: "gemini-2.5-flash",
      temperature: 0.7,
    });
  });

  test("extracts model and merges when params object is passed", () => {
    const params = getGoogleChatModelParams({
      model: "gemini-2.5-pro",
      temperature: 0.2,
    });
    expect(params).toEqual({
      model: "gemini-2.5-pro",
      temperature: 0.2,
    });
  });
});

describe("applyGeminiGatewayParams", () => {
  test("preserves params if endpoint is already provided", () => {
    const params = {
      model: "gemini-2.5-flash",
      endpoint: "custom.endpoint.com",
    };
    expect(applyGeminiGatewayParams(params)).toEqual(params);
  });
});
