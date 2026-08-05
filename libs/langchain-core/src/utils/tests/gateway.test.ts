import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { resolveLangSmithGatewayConfig } from "../gateway.js";

const ENVIRONMENT_VARIABLES = [
  "LANGSMITH_GATEWAY",
  "LANGSMITH_GATEWAY_API_KEY",
  "LANGSMITH_API_KEY",
];

function resolve(
  overrides: Partial<Parameters<typeof resolveLangSmithGatewayConfig>[0]> = {}
) {
  return resolveLangSmithGatewayConfig({
    providerPath: "provider/v1",
    ...overrides,
  });
}

describe("resolveLangSmithGatewayConfig", () => {
  beforeEach(() => {
    for (const name of ENVIRONMENT_VARIABLES) {
      vi.stubEnv(name, "");
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test.each(["false", "0", "no"])('disables the gateway for "%s"', (value) => {
    vi.stubEnv("LANGSMITH_GATEWAY", value);

    expect(resolve()).toEqual({});
  });

  test.each(["true", "1", "yes", "TRUE"])(
    'uses the default gateway for "%s"',
    (value) => {
      vi.stubEnv("LANGSMITH_GATEWAY", value);

      expect(resolve().baseURL).toBe(
        "https://gateway.smith.langchain.com/provider/v1"
      );
    }
  );

  test("supports a custom gateway URL", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "http://localhost:8080/custom/");

    expect(resolve().baseURL).toBe("http://localhost:8080/custom/provider/v1");
  });

  test("returns the gateway key when the gateway supplies the base URL", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    expect(resolve().apiKey).toBe("gateway-key");
  });

  test("falls back to the LangSmith API key for a gateway base URL", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_API_KEY", "langsmith-key");

    expect(resolve().apiKey).toBe("langsmith-key");
  });

  test("does not return a gateway key for a provider base URL", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    expect(resolve({ baseURL: "https://provider.example.com" })).toEqual({
      baseURL: "https://provider.example.com",
    });
  });
});
