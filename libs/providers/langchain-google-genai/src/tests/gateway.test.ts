import { afterEach, describe, expect, test, vi } from "vitest";
import { ChatGoogleGenerativeAI } from "../chat_models.js";

describe("ChatGoogleGenerativeAI LangSmith gateway", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("routes through the gateway Gemini path via env config", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("GOOGLE_API_KEY", "provider-key");

    const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" });

    expect(model.apiKey).toBe("gateway-key");
    expect(model.baseUrl).toBe("https://gateway.smith.langchain.com/gemini");
  });

  test("supports a custom gateway root", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "https://gw.example.com/");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("GOOGLE_API_KEY", "provider-key");

    const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" });

    expect(model.baseUrl).toBe("https://gw.example.com/gemini");
  });

  test("falls back to LANGSMITH_API_KEY for the gateway key", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "");
    vi.stubEnv("LANGSMITH_API_KEY", "ls-key");
    vi.stubEnv("GOOGLE_API_KEY", "provider-key");

    const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" });

    expect(model.apiKey).toBe("ls-key");
  });

  test("an explicit baseUrl suppresses gateway routing", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("GOOGLE_API_KEY", "provider-key");

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      baseUrl: "https://my.proxy.example.com",
    });

    expect(model.baseUrl).toBe("https://my.proxy.example.com");
    expect(model.apiKey).toBe("provider-key");
  });

  test("an explicit apiKey wins over the gateway key", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");

    const model = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: "user-key",
    });

    expect(model.apiKey).toBe("user-key");
    expect(model.baseUrl).toBe("https://gateway.smith.langchain.com/gemini");
  });

  test("no gateway: falls back to GEMINI_API_KEY when GOOGLE_API_KEY is unset", () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "gemini-env-key");

    const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash" });

    expect(model.apiKey).toBe("gemini-env-key");
    expect(model.baseUrl).toBeUndefined();
  });
});
