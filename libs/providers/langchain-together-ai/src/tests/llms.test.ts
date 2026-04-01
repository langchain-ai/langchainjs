import { afterEach, describe, expect, test, vi } from "vitest";
import { TogetherAI } from "../llms.js";

const originalFetch = global.fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
  delete process.env.TOGETHER_AI_API_KEY;
});

describe("TogetherAI", () => {
  test("throws when api key is missing", () => {
    expect(
      () =>
        new TogetherAI({
          model: "togethercomputer/StripedHyena-Nous-7B",
        })
    ).toThrow("TOGETHER_AI_API_KEY not found.");
  });

  test("warns when a chat model is used with the legacy LLM", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    new TogetherAI({
      modelName: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      apiKey: "test-api-key",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Consider using ChatTogetherAI")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("@langchain/together-ai")
    );
  });

  test("provides a helpful error for chat model responses", async () => {
    const model = new TogetherAI({
      modelName: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
      apiKey: "test-api-key",
    });

    vi.spyOn(model, "completionWithRetry").mockResolvedValue({
      error: "Invalid model",
    } as never);

    await expect(model.invoke("Hello")).rejects.toThrow(
      /may require the ChatTogetherAI class/
    );
  });

  test("call options override constructor defaults in request payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        object: "text_completion",
        status: "finished",
        prompt: ["Hello"],
        model: "override-model",
        model_owner: "together",
        tags: {},
        num_returns: 1,
        args: {
          model: "override-model",
          prompt: "Hello",
          temperature: 0.1,
          top_p: 0.9,
          top_k: 12,
          max_tokens: 9,
          stop: ["END"],
        },
        output: {
          choices: [
            {
              finish_reason: "stop",
              index: 0,
              text: "Hi!",
            },
          ],
          raw_compute_time: 0,
          result_type: "text",
        },
      })
    );
    global.fetch = fetchMock as typeof fetch;

    const model = new TogetherAI({
      model: "base-model",
      apiKey: "test-api-key",
      temperature: 0.7,
      topP: 0.2,
      topK: 50,
      repetitionPenalty: 1,
      maxTokens: 64,
    });

    const response = await model.invoke("Hello", {
      model: "override-model",
      temperature: 0.1,
      topP: 0.9,
      topK: 12,
      repetitionPenalty: 1.5,
      logprobs: 3,
      safetyModel: "meta-llama/Llama-Guard-7b",
      maxTokens: 9,
      stop: ["END"],
    });

    expect(response).toBe("Hi!");
    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      model: "override-model",
      temperature: 0.1,
      top_p: 0.9,
      top_k: 12,
      repetition_penalty: 1.5,
      logprobs: 3,
      safety_model: "meta-llama/Llama-Guard-7b",
      max_tokens: 9,
      stop: ["END"],
    });
  });

  test("surfaces API errors", async () => {
    global.fetch = vi.fn().mockImplementation(
      async () => jsonResponse({ error: "bad request" }, 400)
    ) as typeof fetch;

    const model = new TogetherAI({
      model: "togethercomputer/StripedHyena-Nous-7B",
      apiKey: "test-api-key",
      maxRetries: 0,
    });

    await expect(model.invoke("Hello")).rejects.toThrow(
      /Error getting prompt completion from Together AI/
    );
  });
});
