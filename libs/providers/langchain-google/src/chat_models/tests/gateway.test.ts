import { afterEach, describe, expect, test, vi } from "vitest";
import * as fs from "node:fs";
import { ApiClient } from "../../clients/index.js";
import { ChatGoogle } from "../index.js";
import { ChatGoogle as ChatGoogleNode } from "../node.js";
import { applyGeminiGatewayParams } from "../base.js";

/**
 * Minimal ApiClient that records the outgoing request URL and reports that an
 * API key is present, so the model resolves to the Gemini Developer API (`gai`)
 * platform and uses `buildUrlGemini`.
 */
class RecordingApiClient extends ApiClient {
  request?: Request;

  hasApiKey(): boolean {
    return true;
  }

  async fetch(request: Request): Promise<Response> {
    this.request = request;
    const bodyText = fs.readFileSync(
      "src/chat_models/tests/data/mock/gemini-chat-001.json",
      "utf-8"
    );
    return new Response(bodyText, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}

describe("applyGeminiGatewayParams", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("routes the gai path through the gateway endpoint", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const params = applyGeminiGatewayParams({ model: "gemini-2.5-flash" });

    // Scheme-less host + provider path; the URL builders prepend `https://`.
    expect(params.endpoint).toBe("gateway.smith.langchain.com/gemini");
    expect(params.apiKey).toBe("gateway-key");
  });

  test("supports a custom gateway root", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "https://gw.example.com/");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const params = applyGeminiGatewayParams({ model: "gemini-2.5-flash" });

    expect(params.endpoint).toBe("gw.example.com/gemini");
  });

  test("falls back to LANGSMITH_API_KEY", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "");
    vi.stubEnv("LANGSMITH_API_KEY", "ls-key");

    const params = applyGeminiGatewayParams({ model: "gemini-2.5-flash" });

    expect(params.apiKey).toBe("ls-key");
  });

  test("an explicit apiKey still wins over the gateway key", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const params = applyGeminiGatewayParams({
      model: "gemini-2.5-flash",
      apiKey: "user-key",
    });

    expect(params.endpoint).toBe("gateway.smith.langchain.com/gemini");
    expect(params.apiKey).toBe("user-key");
  });

  test("an explicit endpoint suppresses gateway routing", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const params = applyGeminiGatewayParams({
      model: "gemini-2.5-flash",
      endpoint: "my.proxy.example.com",
      apiKey: "user-key",
    });

    expect(params.endpoint).toBe("my.proxy.example.com");
    expect(params.apiKey).toBe("user-key");
  });

  test("Vertex configuration is not routed through the gateway", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const vertexByFlag = applyGeminiGatewayParams({
      model: "gemini-2.5-flash",
      vertexai: true,
    });
    expect(vertexByFlag.endpoint).toBeUndefined();

    const vertexByPlatform = applyGeminiGatewayParams({
      model: "gemini-2.5-flash",
      platformType: "gcp",
    });
    expect(vertexByPlatform.endpoint).toBeUndefined();
  });

  test("no-op when the gateway is disabled", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "false");

    const params = applyGeminiGatewayParams({ model: "gemini-2.5-flash" });

    expect(params.endpoint).toBeUndefined();
  });
});

describe("ChatGoogle gateway routing (end to end)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("web wrapper builds the gateway URL for the gai path", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const apiClient = new RecordingApiClient();
    const model = new ChatGoogle({ model: "gemini-2.5-flash", apiClient });
    await model.invoke("hi");

    expect(apiClient.request?.url).toBe(
      "https://gateway.smith.langchain.com/gemini/v1beta/models/gemini-2.5-flash:generateContent"
    );
  });

  test("node wrapper builds the gateway URL for the gai path", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const apiClient = new RecordingApiClient();
    const model = new ChatGoogleNode({ model: "gemini-2.5-flash", apiClient });
    await model.invoke("hi");

    expect(apiClient.request?.url).toBe(
      "https://gateway.smith.langchain.com/gemini/v1beta/models/gemini-2.5-flash:generateContent"
    );
  });
});
