import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ChatVertexAI } from "../chat_models.js";

class InspectableChatVertexAI extends ChatVertexAI {
  get requestConnection() {
    return this.connection;
  }
}

const response = {
  candidates: [
    {
      content: { role: "model", parts: [{ text: "Hello" }] },
      finishReason: "STOP",
    },
  ],
};
const fetchMock = vi.fn<typeof fetch>();
const gatewayRoot = "https://gateway.smith.langchain.com/vertex";
const resource = "v1/publishers/google/models/gemini-2.5-flash";

function expectRequest(url: string, apiKey: string) {
  expect(fetchMock).toHaveBeenCalledOnce();
  const [actualUrl, options] = fetchMock.mock.calls[0];
  expect(actualUrl).toBe(url);
  const headers = new Headers(options?.headers);
  expect(headers.get("x-goog-api-key")).toBe(apiKey);
  expect(headers.has("authorization")).toBe(false);
}

describe("ChatVertexAI LangSmith gateway", () => {
  beforeEach(() => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("LANGSMITH_API_KEY", undefined);
    vi.stubEnv("GOOGLE_API_KEY", undefined);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url) => {
      const body = String(url).endsWith(":streamGenerateContent")
        ? JSON.stringify([response])
        : JSON.stringify(response);
      return new Response(body, {
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test.each([false, true])(
    "routes through Vertex Express without Google credentials (string overload: %s)",
    async (stringOverload) => {
      const model = stringOverload
        ? new ChatVertexAI("gemini-2.5-flash")
        : new ChatVertexAI({ model: "gemini-2.5-flash" });
      const result = await model.invoke("Hi");
      expect(result.content).toBe("Hello");
      expect(model.platform).toBe("gcp");
      expectRequest(
        `${gatewayRoot}/${resource}:generateContent`,
        "gateway-key"
      );
      expect(JSON.stringify(model)).not.toContain("gateway-key");
      expect(JSON.stringify(model)).not.toContain(gatewayRoot);
    }
  );

  test.each([
    ["gateway-key", "langsmith-key", "gateway-key"],
    ["", "langsmith-key", "langsmith-key"],
    [undefined, undefined, "provider-key"],
  ])(
    "resolves key precedence (%s, %s, %s)",
    async (gatewayKey, langsmithKey, expectedKey) => {
      vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", gatewayKey);
      vi.stubEnv("LANGSMITH_API_KEY", langsmithKey);
      vi.stubEnv("GOOGLE_API_KEY", "provider-key");
      const model = new ChatVertexAI({ model: "gemini-2.5-flash" });
      await model.invoke("Hi");
      expectRequest(`${gatewayRoot}/${resource}:generateContent`, expectedKey);
    }
  );

  test.each([
    "https://gw.example.com/custom/",
    "http://localhost:8080/custom/",
  ])("preserves a custom gateway root: %s", async (root) => {
    vi.stubEnv("LANGSMITH_GATEWAY", root);
    const model = new ChatVertexAI({ model: "gemini-2.5-flash" });
    await model.invoke("Hi");
    expectRequest(
      `${root.replace(/\/+$/, "")}/vertex/${resource}:generateContent`,
      "gateway-key"
    );
  });

  test("an explicit apiKey goes straight to Vertex", async () => {
    const model = new ChatVertexAI({
      model: "gemini-2.5-flash",
      apiKey: "explicit-key",
    });
    await model.invoke("Hi");
    expectRequest(
      `https://aiplatform.googleapis.com/${resource}:generateContent`,
      "explicit-key"
    );
  });

  test.each([
    ["my.proxy.example.com", "https://my.proxy.example.com"],
    ["http://localhost:8080/proxy/", "http://localhost:8080/proxy"],
  ])(
    "explicit endpoint opts out of gateway routing: %s",
    async (endpoint, root) => {
      vi.stubEnv("GOOGLE_API_KEY", "provider-key");
      const model = new ChatVertexAI({ model: "gemini-2.5-flash", endpoint });
      await model.invoke("Hi");
      expectRequest(`${root}/${resource}:generateContent`, "provider-key");
    }
  );

  test.each(["", "false"])(
    "disabled gateway keeps direct routing: %s",
    async (value) => {
      vi.stubEnv("LANGSMITH_GATEWAY", value);
      vi.stubEnv("GOOGLE_API_KEY", "provider-key");
      const model = new ChatVertexAI({ model: "gemini-2.5-flash" });
      await model.invoke("Hi");
      expectRequest(
        `https://aiplatform.googleapis.com/${resource}:generateContent`,
        "provider-key"
      );
    }
  );

  test.each([
    ["false", undefined, "https://europe-west4-aiplatform.googleapis.com"],
    ["true", undefined, "https://europe-west4-aiplatform.googleapis.com"],
    ["true", "my.proxy.example.com", "https://my.proxy.example.com"],
  ])(
    "explicit authOptions keep Google auth (gateway: %s, endpoint: %s)",
    async (gateway, endpoint, root) => {
      vi.stubEnv("LANGSMITH_GATEWAY", gateway);
      const model = new InspectableChatVertexAI({
        model: "gemini-2.5-flash",
        authOptions: { projectId: "test-project" },
        location: "europe-west4",
        endpoint,
      });
      expect(model.requestConnection.client.clientType).toBe("gauth");
      expect(await model.requestConnection.buildUrl()).toBe(
        `${root}/v1/projects/test-project/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent`
      );
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  test("streams through the gateway", async () => {
    const model = new ChatVertexAI({ model: "gemini-2.5-flash" });
    const chunks = [];
    for await (const chunk of await model.stream("Hi")) {
      chunks.push(chunk.content);
    }
    expect(chunks.join("")).toBe("Hello");
    expectRequest(
      `${gatewayRoot}/${resource}:streamGenerateContent`,
      "gateway-key"
    );
  });

  test("does not expose gateway credentials in custom events", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", undefined);
    vi.stubEnv("LANGSMITH_API_KEY", "private-langsmith-key");
    const handleCustomEvent = vi.fn();
    const model = new ChatVertexAI({
      model: "gemini-2.5-flash",
      callbacks: [{ handleCustomEvent }],
    });
    await model.invoke("Hi");
    expect(handleCustomEvent).toHaveBeenCalled();
    const events = JSON.stringify(handleCustomEvent.mock.calls);
    expect(events).toContain("google-request-ChatConnection");
    expect(events).not.toContain("private-langsmith-key");
  });

  test("streaming invocation uses the gateway", async () => {
    const model = new ChatVertexAI({
      model: "gemini-2.5-flash",
      streaming: true,
    });
    expect((await model.invoke("Hi")).content).toBe("Hello");
    expectRequest(
      `${gatewayRoot}/${resource}:streamGenerateContent`,
      "gateway-key"
    );
  });
});
