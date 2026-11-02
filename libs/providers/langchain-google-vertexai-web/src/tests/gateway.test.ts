import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ChatGoogle } from "@langchain/google-webauth";
import { ChatVertexAI } from "../chat_models.js";

const fetchMock = vi.fn<typeof fetch>();
const root = "https://gateway.smith.langchain.com/vertex";
const resource = "v1/publishers/google/models/gemini-2.5-flash";

function expectRequest(url: string, key = "gateway-key") {
  expect(fetchMock).toHaveBeenCalledOnce();
  const [actualUrl, options] = fetchMock.mock.calls[0];
  expect(actualUrl).toBe(url);
  const headers = new Headers(options?.headers);
  expect(headers.get("x-goog-api-key")).toBe(key);
  expect(headers.has("authorization")).toBe(false);
}

describe("web ChatVertexAI LangSmith gateway", () => {
  beforeEach(() => {
    vi.stubEnv("LANGSMITH_GATEWAY", "true");
    vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", "gateway-key");
    vi.stubEnv("LANGSMITH_API_KEY", undefined);
    vi.stubEnv("GOOGLE_API_KEY", undefined);
    vi.stubEnv("GOOGLE_WEB_CREDENTIALS", undefined);
    vi.stubEnv("GOOGLE_VERTEX_AI_WEB_CREDENTIALS", undefined);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url) => {
      const response = {
        candidates: [
          { content: { role: "model", parts: [{ text: "Hello" }] } },
        ],
      };
      return Response.json(
        String(url).endsWith(":streamGenerateContent") ? [response] : response
      );
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test.each([false, true])(
    "works without web credentials (string overload: %s)",
    async (stringOverload) => {
      const model = stringOverload
        ? new ChatVertexAI("gemini-2.5-flash")
        : new ChatVertexAI({ model: "gemini-2.5-flash" });
      expect((await model.invoke("Hi")).content).toBe("Hello");
      expectRequest(`${root}/${resource}:generateContent`);
      expect(JSON.stringify(model)).not.toContain("gateway-key");
      expect(JSON.stringify(model)).not.toContain(root);
    }
  );

  test.each([false, true])(
    "supports streaming without web credentials (invoke: %s)",
    async (invoke) => {
      const model = new ChatVertexAI({
        model: "gemini-2.5-flash",
        streaming: invoke,
      });
      if (invoke) {
        expect((await model.invoke("Hi")).content).toBe("Hello");
      } else {
        const contents = [];
        for await (const chunk of await model.stream("Hi"))
          contents.push(chunk.content);
        expect(contents.join("")).toBe("Hello");
      }
      expectRequest(`${root}/${resource}:streamGenerateContent`);
    }
  );

  test("preserves regional routing without using web OAuth", async () => {
    const handleCustomEvent = vi.fn();
    const model = new ChatVertexAI({
      model: "gemini-2.5-flash",
      authOptions: {
        credentials: JSON.stringify({ project_id: "test-project" }),
      },
      location: "europe-west4",
      callbacks: [{ handleCustomEvent }],
    });
    await model.invoke("Hi");
    expectRequest(
      `${root}/v1/projects/test-project/locations/europe-west4/publishers/google/models/gemini-2.5-flash:generateContent`
    );
    expect(handleCustomEvent).toHaveBeenCalled();
    expect(JSON.stringify(handleCustomEvent.mock.calls)).not.toContain(
      "gateway-key"
    );
  });

  test.each([undefined, "explicit-key"])(
    "uses the LangSmith fallback unless a key is explicit: %s",
    async (apiKey) => {
      vi.stubEnv("LANGSMITH_GATEWAY_API_KEY", undefined);
      vi.stubEnv("LANGSMITH_API_KEY", "langsmith-key");
      vi.stubEnv("GOOGLE_API_KEY", "provider-key");
      const handleCustomEvent = vi.fn();
      const model = new ChatVertexAI({
        model: "gemini-2.5-flash",
        apiKey,
        callbacks: [{ handleCustomEvent }],
      });
      await model.invoke("Hi");
      expectRequest(
        `${root}/${resource}:generateContent`,
        apiKey ?? "langsmith-key"
      );
      expect(JSON.stringify(handleCustomEvent.mock.calls)).not.toContain(
        "langsmith-key"
      );
      expect(JSON.stringify(handleCustomEvent.mock.calls)).not.toContain(
        "explicit-key"
      );
    }
  );

  test("preserves a custom HTTP gateway root", async () => {
    vi.stubEnv("LANGSMITH_GATEWAY", "http://localhost:8080/custom/");
    const model = new ChatVertexAI({ model: "gemini-2.5-flash" });
    await model.invoke("Hi");
    expectRequest(
      `http://localhost:8080/custom/vertex/${resource}:generateContent`
    );
  });

  test.each(["", "false"])(
    "keeps the web credential requirement when the gateway is disabled: %s",
    (value) => {
      vi.stubEnv("LANGSMITH_GATEWAY", value);
      expect(() => new ChatVertexAI({ model: "gemini-2.5-flash" })).toThrow(
        "Credentials not found"
      );
    }
  );

  test("an explicit endpoint skips gateway-key selection", async () => {
    expect(() => new ChatVertexAI({ endpoint: "proxy.example.com" })).toThrow(
      "Credentials not found"
    );
    vi.stubEnv("GOOGLE_API_KEY", "provider-key");
    const model = new ChatVertexAI({
      model: "gemini-2.5-flash",
      endpoint: "proxy.example.com",
    });
    await model.invoke("Hi");
    expectRequest(
      `https://proxy.example.com/${resource}:generateContent`,
      "provider-key"
    );
  });

  test.each([undefined, false, true])(
    "does not enable Vertex gateway routing for an explicit gai platform (vertexai: %s)",
    (vertexai) => {
      expect(() => new ChatGoogle({ platformType: "gai", vertexai })).toThrow(
        "Credentials not found"
      );
    }
  );

  test("supports explicit Vertex configuration on the shared web chat model", async () => {
    const model = new ChatGoogle({ model: "gemini-2.5-flash", vertexai: true });
    await model.invoke("Hi");
    expectRequest(`${root}/${resource}:generateContent`);
  });
});
