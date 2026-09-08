import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { load } from "@langchain/core/load";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableBinding, RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "../index.js";

const baseURL = "https://gateway.example.com/gateway/v1";
const secretsMap = {
  LANGSMITH_GATEWAY_API_KEY: "test-gateway-key",
  OPENAI_API_KEY: "test-gateway-key",
};
const importMap = { chat_models__openai: { ChatOpenAI } };

function modelManifest(kwargs: Record<string, unknown>) {
  return {
    lc: 1,
    type: "constructor",
    id: ["langchain", "chat_models", "openai", "ChatOpenAI"],
    kwargs: {
      model: "custom/xai",
      openai_api_key: {
        lc: 1,
        type: "secret",
        id: ["LANGSMITH_GATEWAY_API_KEY"],
      },
      ...kwargs,
    },
  };
}

function loadModel(kwargs: Record<string, unknown>) {
  return load<ChatOpenAI>(JSON.stringify(modelManifest(kwargs)), {
    secretsMap,
    importMap,
  });
}

describe("Python ChatOpenAI manifest base URLs", () => {
  beforeEach(() => {
    vi.stubEnv("LANGSMITH_GATEWAY", "false");
    vi.stubEnv("LANGSMITH_TRACING", "false");
    vi.stubEnv("LANGCHAIN_TRACING_V2", "false");
    vi.stubEnv("OPENAI_API_BASE", "");
    vi.stubEnv("OPENAI_BASE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("preserves base_url when loading and reserializing", async () => {
    const model = await loadModel({ base_url: baseURL });
    expect(model.clientConfig.baseURL).toBe(baseURL);
    expect(model.apiKey).toBe("test-gateway-key");
    expect(model.model).toBe("custom/xai");
    expect(JSON.parse(JSON.stringify(model)).kwargs.base_url).toBe(baseURL);

    const reloaded = await load<ChatOpenAI>(JSON.stringify(model), {
      secretsMap,
      importMap,
    });
    expect(reloaded.clientConfig.baseURL).toBe(baseURL);
  });

  it("prefers configuration.baseURL over base_url", async () => {
    const model = await loadModel({
      base_url: "https://alias.example.com/v1",
      configuration: { baseURL, timeout: 1234 },
    });
    expect(model.clientConfig.baseURL).toBe(baseURL);
    expect(model.clientConfig.timeout).toBe(1234);
  });

  it("prefers base_url over environment defaults", async () => {
    vi.stubEnv("OPENAI_BASE_URL", "https://env.example.com/v1");
    const model = await loadModel({ base_url: baseURL });
    expect(model.clientConfig.baseURL).toBe(baseURL);
  });

  it.each([null, 123, false, {}])(
    "falls back to environment configuration for a non-string base_url (%j)",
    async (value) => {
      vi.stubEnv("OPENAI_BASE_URL", baseURL);
      const model = await loadModel({ base_url: value });
      expect(model.clientConfig.baseURL).toBe(baseURL);
    }
  );

  it.each([true, false])(
    "routes a loaded prompt to the gateway with use_responses_api=%s",
    async (useResponsesApi) => {
      // Mock the transport, not the model, to verify both internal API clients.
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "Mock gateway response",
              type: "invalid_request_error",
            },
          }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      );
      vi.stubGlobal("fetch", fetch);
      const manifest = {
        lc: 1,
        type: "constructor",
        id: ["langchain", "schema", "runnable", "RunnableSequence"],
        kwargs: {
          first: ChatPromptTemplate.fromMessages([
            ["system", "You are a chatbot."],
            ["human", "{question}"],
          ]),
          last: {
            lc: 1,
            type: "constructor",
            id: ["langchain", "schema", "runnable", "RunnableBinding"],
            kwargs: {
              bound: modelManifest({
                base_url: baseURL,
                use_responses_api: useResponsesApi,
              }),
              kwargs: {},
            },
          },
        },
      };
      const prompt = await load<RunnableSequence>(JSON.stringify(manifest), {
        secretsMap,
        importMap: {
          ...importMap,
          schema__runnable: { RunnableSequence, RunnableBinding },
          prompts__chat: await import("@langchain/core/prompts"),
          prompts__prompt: await import("@langchain/core/prompts"),
        },
      });

      await expect(
        prompt.invoke({ question: "What model are you?" })
      ).rejects.toThrow("Mock gateway response");
      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetch.mock.calls[0];
      expect(String(url)).toBe(
        `${baseURL}/${useResponsesApi ? "responses" : "chat/completions"}`
      );
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer test-gateway-key"
      );
      expect(JSON.parse(init?.body as string)).toMatchObject({
        model: "custom/xai",
      });
    }
  );
});
