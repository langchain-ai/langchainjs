import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { resolveLangSmithGatewayConfig } from "../gateway.js";

const ENVIRONMENT_VARIABLES = [
  "LANGSMITH_GATEWAY",
  "LANGSMITH_GATEWAY_API_KEY",
  "LANGSMITH_API_KEY",
  "PROVIDER_BASE_URL",
  "PROVIDER_API_KEY",
];

function resolve(
  overrides: Partial<
    Parameters<typeof resolveLangSmithGatewayConfig<string>>[0]
  > = {}
) {
  return resolveLangSmithGatewayConfig({
    providerPath: "provider/v1",
    baseURLEnv: "PROVIDER_BASE_URL",
    apiKeyEnv: "PROVIDER_API_KEY",
    defaultBaseURL: "https://provider.example.com",
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

  test.each(["false", "0", "no"])("disables the gateway for %s", (value) => {
    vi.stubEnv("LANGSMITH_GATEWAY", value);

    expect(resolve()).toEqual({
      baseURL: "https://provider.example.com",
      apiKey: undefined,
      baseURLFromGateway: false,
    });
  });

  test.each(["true", "1", "yes", "TRUE"])(
    "uses the default gateway for %s",
    (value) => {
      vi.stubEnv("LANGSMITH_GATEWAY", value);

      expect(resolve().baseURL).toBe(
        "https://gateway.smith.langchain.com/provider/v1"
      );
      expect(resolve().baseURLFromGateway).toBe(true);
    }
  );

  test("supports a custom gateway URL", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "http://localhost:8080/custom/");

    expect(resolve().baseURL).toBe("http://localhost:8080/custom/provider/v1");
  });

  test("rejects cloud metadata gateway URLs", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "http://169.254.169.254");

    expect(() => resolve()).toThrow("cloud metadata");
  });

  test("prefers explicit and provider base URLs over the gateway", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("PROVIDER_BASE_URL", "https://provider-env.example.com");

    expect(resolve().baseURL).toBe("https://provider-env.example.com");
    expect(resolve({ baseURL: "https://explicit.example.com" }).baseURL).toBe(
      "https://explicit.example.com"
    );
  });

  test("prefers the gateway key when the gateway supplies the base URL", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("PROVIDER_API_KEY", "provider-key");

    expect(resolve().apiKey).toBe("gateway-key");
  });

  test("falls back to the LangSmith API key for a gateway base URL", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_API_KEY", "langsmith-key");

    expect(resolve().apiKey).toBe("langsmith-key");
  });

  test("prefers the provider key when the base URL did not come from the gateway", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("PROVIDER_API_KEY", "provider-key");

    expect(resolve({ baseURL: "https://explicit.example.com" }).apiKey).toBe(
      "provider-key"
    );
  });

  test("preserves an explicit API key", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    expect(resolve({ apiKey: "explicit-key" }).apiKey).toBe("explicit-key");
  });
});
