/* eslint-disable @typescript-eslint/no-explicit-any */
import { it, expect, describe, beforeEach, afterEach } from "vitest";
import { ChatOpenAI } from "../index.js";
import { OpenAIWebSocketManager } from "../../utils/websocket.js";

describe("ChatOpenAI WebSocket mode", () => {
  let oldLangChainTracingValue: string | undefined;

  beforeEach(() => {
    oldLangChainTracingValue = process.env.LANGCHAIN_TRACING_V2;
    process.env.LANGCHAIN_TRACING_V2 = "false";
  });

  afterEach(() => {
    if (oldLangChainTracingValue !== undefined) {
      process.env.LANGCHAIN_TRACING_V2 = oldLangChainTracingValue;
    } else {
      delete process.env.LANGCHAIN_TRACING_V2;
    }
  });

  it("useWebSocket forces useResponsesApi to true", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-key",
      useWebSocket: true,
    });
    expect(model.useWebSocket).toBe(true);
    expect(model.useResponsesApi).toBe(true);
  });

  it("useWebSocket defaults to false", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-key",
    });
    expect(model.useWebSocket).toBe(false);
  });

  it("useWebSocket is included in serialized keys", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-key",
      useWebSocket: true,
    });
    const serialized = JSON.stringify(model);
    expect(serialized).toContain("use_web_socket");
  });

  it("_useResponseApi returns true when useWebSocket is set", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-key",
      useWebSocket: true,
    });
    expect((model as any)._useResponsesApi({})).toBe(true);
  });

  it("closeWebSocket cleans up the manager", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-key",
      useWebSocket: true,
    });
    const manager = (model as any)._getOrCreateWsManager();
    expect(manager).toBeInstanceOf(OpenAIWebSocketManager);
    expect((model as any).wsManager).toBeDefined();

    model.closeWebSocket();
    expect((model as any).wsManager).toBeNull();
  });

  it("_getOrCreateWsManager creates a manager with correct config", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-api-key",
      configuration: { organization: "test-org" },
      useWebSocket: true,
    });
    const manager = (model as any)._getOrCreateWsManager();
    expect(manager).toBeInstanceOf(OpenAIWebSocketManager);
    expect((manager as any).apiKey).toBe("test-api-key");
    expect((manager as any).organization).toBe("test-org");
    model.closeWebSocket();
  });

  it("_getOrCreateWsManager reuses existing manager", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-key",
      useWebSocket: true,
    });
    const manager1 = (model as any)._getOrCreateWsManager();
    const manager2 = (model as any)._getOrCreateWsManager();
    expect(manager1).toBe(manager2);
    model.closeWebSocket();
  });
});

describe("OpenAIWebSocketManager", () => {
  it("constructs with default baseURL", () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
    });
    expect((manager as any).apiKey).toBe("test-key");
    expect((manager as any).baseURL).toBe("wss://api.openai.com/v1/responses");
  });

  it("constructs with custom baseURL", () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
      baseURL: "https://my-proxy.example.com/v1",
    });
    expect((manager as any).baseURL).toBe("https://my-proxy.example.com/v1");
  });

  it("converts HTTP URLs to WSS in getWebSocketURL", () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
      baseURL: "https://api.openai.com/v1",
    });
    const url = (manager as any).getWebSocketURL();
    expect(url).toBe("wss://api.openai.com/v1/responses");
  });

  it("converts http:// URLs to ws:// in getWebSocketURL", () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
      baseURL: "http://localhost:8080/v1",
    });
    const url = (manager as any).getWebSocketURL();
    expect(url).toBe("ws://localhost:8080/v1/responses");
  });

  it("preserves wss:// URLs in getWebSocketURL", () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
      baseURL: "wss://api.openai.com/v1/responses",
    });
    const url = (manager as any).getWebSocketURL();
    expect(url).toBe("wss://api.openai.com/v1/responses");
  });

  it("appends /responses if not already present", () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
      baseURL: "wss://api.openai.com/v1",
    });
    const url = (manager as any).getWebSocketURL();
    expect(url).toBe("wss://api.openai.com/v1/responses");
  });

  it("handles trailing slash in baseURL", () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
      baseURL: "wss://api.openai.com/v1/",
    });
    const url = (manager as any).getWebSocketURL();
    expect(url).toBe("wss://api.openai.com/v1/responses");
  });

  it("isConnected returns false initially", () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
    });
    expect(manager.isConnected).toBe(false);
  });

  it("throws after close", async () => {
    const manager = new OpenAIWebSocketManager({
      apiKey: "test-key",
    });
    manager.close();
    await expect(async () => {
      for await (const _ of manager.stream({
        model: "gpt-4o",
        input: [],
        stream: true,
      })) {
        // should not reach here
      }
    }).rejects.toThrow("WebSocket manager is closed");
  });
});

describe("ChatOpenAI WebSocket serialization", () => {
  it("serializes useWebSocket when true", () => {
    const model = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: "test-key",
      useWebSocket: true,
    });
    const serialized = JSON.parse(JSON.stringify(model));
    expect(serialized.kwargs).toHaveProperty("use_web_socket", true);
  });
});
