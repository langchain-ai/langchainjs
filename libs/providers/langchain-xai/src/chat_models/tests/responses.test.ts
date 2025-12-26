import { test, expect, beforeEach, describe } from "vitest";
import {
  ChatXAIResponses,
  type ChatXAIResponsesInvocationParams,
} from "../index.js";

beforeEach(() => {
  process.env.XAI_API_KEY = "foo";
});

test("Serialization", () => {
  delete process.env.XAI_API_KEY;
  const model = new ChatXAIResponses({
    model: "grok-3",
    apiKey: "bar",
  });
  const serialized = JSON.parse(JSON.stringify(model));
  expect(serialized.lc).toBe(1);
  expect(serialized.type).toBe("constructor");
  expect(serialized.id).toEqual([
    "langchain",
    "chat_models",
    "xai",
    "ChatXAIResponses",
  ]);
  expect(serialized.kwargs.model).toBe("grok-3");
  // API key should be serialized as a secret reference, not the actual value
  expect(serialized.kwargs.xai_api_key?.type).toBe("secret");
  expect(serialized.kwargs.apiKey).toBeUndefined();
});

test("Serialization with no params", () => {
  const model = new ChatXAIResponses();
  const serialized = JSON.parse(JSON.stringify(model));
  expect(serialized.lc).toBe(1);
  expect(serialized.type).toBe("constructor");
  expect(serialized.id).toEqual([
    "langchain",
    "chat_models",
    "xai",
    "ChatXAIResponses",
  ]);
  // API key should be serialized as a secret reference
  expect(serialized.kwargs.xai_api_key?.type).toBe("secret");
});

test("Serialization with custom params", () => {
  delete process.env.XAI_API_KEY;
  const model = new ChatXAIResponses({
    model: "grok-3-mini",
    apiKey: "bar",
    temperature: 0.5,
    topP: 0.9,
    maxOutputTokens: 1024,
  });
  const serialized = JSON.parse(JSON.stringify(model));
  expect(serialized.kwargs.model).toBe("grok-3-mini");
  expect(serialized.kwargs.temperature).toBe(0.5);
  expect(serialized.kwargs.top_p).toBe(0.9);
  expect(serialized.kwargs.max_output_tokens).toBe(1024);
  // API key should be serialized as a secret reference
  expect(serialized.kwargs.xai_api_key?.type).toBe("secret");
});

test("should throw error when no API key is provided", () => {
  delete process.env.XAI_API_KEY;
  expect(() => new ChatXAIResponses()).toThrow(/xAI API key not found/);
});

describe("ChatXAIResponses Constructor", () => {
  test("should use default model when not specified", () => {
    const model = new ChatXAIResponses();
    expect(model.model).toBe("grok-3");
  });

  test("should use custom model when specified", () => {
    const model = new ChatXAIResponses({ model: "grok-3-mini" });
    expect(model.model).toBe("grok-3-mini");
  });

  test("should use default baseURL when not specified", () => {
    const model = new ChatXAIResponses();
    expect(model.baseURL).toBe("https://api.x.ai/v1");
  });

  test("should use custom baseURL when specified", () => {
    const model = new ChatXAIResponses({
      baseURL: "https://custom.api.x.ai/v1",
    });
    expect(model.baseURL).toBe("https://custom.api.x.ai/v1");
  });

  test("should store temperature", () => {
    const model = new ChatXAIResponses({ temperature: 0.7 });
    expect(model.temperature).toBe(0.7);
  });

  test("should store topP", () => {
    const model = new ChatXAIResponses({ topP: 0.9 });
    expect(model.topP).toBe(0.9);
  });

  test("should store maxOutputTokens", () => {
    const model = new ChatXAIResponses({ maxOutputTokens: 2048 });
    expect(model.maxOutputTokens).toBe(2048);
  });

  test("should store streaming option", () => {
    const model = new ChatXAIResponses({ streaming: true });
    expect(model.streaming).toBe(true);
  });

  test("should default streaming to false", () => {
    const model = new ChatXAIResponses();
    expect(model.streaming).toBe(false);
  });

  test("should store user", () => {
    const model = new ChatXAIResponses({ user: "test-user" });
    expect(model.user).toBe("test-user");
  });

  test("should store store option", () => {
    const model = new ChatXAIResponses({ store: true });
    expect(model.store).toBe(true);
  });
});

describe("ChatXAIResponses with searchParameters", () => {
  test("should store searchParameters from constructor", () => {
    const searchParams = {
      mode: "auto" as const,
      max_search_results: 5,
    };
    const model = new ChatXAIResponses({
      searchParameters: searchParams,
    });
    expect(model.searchParameters).toEqual(searchParams);
  });

  test("should have undefined searchParameters by default", () => {
    const model = new ChatXAIResponses();
    expect(model.searchParameters).toBeUndefined();
  });

  test("should support all search modes", () => {
    const modes = ["auto", "on", "off"] as const;
    for (const mode of modes) {
      const model = new ChatXAIResponses({
        searchParameters: { mode },
      });
      expect(model.searchParameters?.mode).toBe(mode);
    }
  });
});

describe("ChatXAIResponses with reasoning", () => {
  test("should store reasoning from constructor", () => {
    const reasoning = {
      effort: "medium" as const,
      summary: "auto" as const,
    };
    const model = new ChatXAIResponses({
      reasoning,
    });
    expect(model.reasoning).toEqual(reasoning);
  });

  test("should have undefined reasoning by default", () => {
    const model = new ChatXAIResponses();
    expect(model.reasoning).toBeUndefined();
  });

  test("should support all reasoning effort levels", () => {
    const efforts = ["low", "medium", "high"] as const;
    for (const effort of efforts) {
      const model = new ChatXAIResponses({
        reasoning: { effort },
      });
      expect(model.reasoning?.effort).toBe(effort);
    }
  });
});

describe("invocationParams", () => {
  test("should return basic params", () => {
    const model = new ChatXAIResponses({
      model: "grok-3",
      temperature: 0.5,
      topP: 0.9,
      maxOutputTokens: 1024,
    });

    const params: ChatXAIResponsesInvocationParams = model.invocationParams({});

    expect(params.model).toBe("grok-3");
    expect(params.temperature).toBe(0.5);
    expect(params.top_p).toBe(0.9);
    expect(params.max_output_tokens).toBe(1024);
  });

  test("should include stream from instance", () => {
    const model = new ChatXAIResponses({ streaming: true });
    const params = model.invocationParams({});
    expect(params.stream).toBe(true);
  });

  test("should include user and store", () => {
    const model = new ChatXAIResponses({
      user: "test-user",
      store: true,
    });
    const params = model.invocationParams({});
    expect(params.user).toBe("test-user");
    expect(params.store).toBe(true);
  });

  test("should include searchParameters from instance", () => {
    const model = new ChatXAIResponses({
      searchParameters: {
        mode: "auto",
        max_search_results: 5,
      },
    });
    const params = model.invocationParams({});
    expect(params.search_parameters).toEqual({
      mode: "auto",
      max_search_results: 5,
    });
  });

  test("should override searchParameters from call options", () => {
    const model = new ChatXAIResponses({
      searchParameters: {
        mode: "auto",
        max_search_results: 5,
      },
    });
    const params = model.invocationParams({
      search_parameters: {
        mode: "on",
        max_search_results: 10,
      },
    } as ChatXAIResponses["ParsedCallOptions"]);
    expect(params.search_parameters).toEqual({
      mode: "on",
      max_search_results: 10,
    });
  });

  test("should include reasoning from instance", () => {
    const model = new ChatXAIResponses({
      reasoning: {
        effort: "high",
        summary: "auto",
      },
    });
    const params = model.invocationParams({});
    expect(params.reasoning).toEqual({
      effort: "high",
      summary: "auto",
    });
  });

  test("should override reasoning from call options", () => {
    const model = new ChatXAIResponses({
      reasoning: {
        effort: "medium",
      },
    });
    const params = model.invocationParams({
      reasoning: {
        effort: "high",
        summary: "detailed",
      },
    } as ChatXAIResponses["ParsedCallOptions"]);
    expect(params.reasoning).toEqual({
      effort: "high",
      summary: "detailed",
    });
  });

  test("should include previous_response_id from call options", () => {
    const model = new ChatXAIResponses();
    const params = model.invocationParams({
      previous_response_id: "resp_123",
    } as ChatXAIResponses["ParsedCallOptions"]);
    expect(params.previous_response_id).toBe("resp_123");
  });

  test("should include include from call options", () => {
    const model = new ChatXAIResponses();
    const params = model.invocationParams({
      include: ["reasoning.encrypted_content"],
    } as ChatXAIResponses["ParsedCallOptions"]);
    expect(params.include).toEqual(["reasoning.encrypted_content"]);
  });

  test("should include tool_choice from call options", () => {
    const model = new ChatXAIResponses();
    const params = model.invocationParams({
      tool_choice: "auto",
    } as ChatXAIResponses["ParsedCallOptions"]);
    expect(params.tool_choice).toBe("auto");
  });

  test("should include parallel_tool_calls from call options", () => {
    const model = new ChatXAIResponses();
    const params = model.invocationParams({
      parallel_tool_calls: false,
    } as ChatXAIResponses["ParsedCallOptions"]);
    expect(params.parallel_tool_calls).toBe(false);
  });
});

describe("Metadata Methods", () => {
  test("_llmType should return xai-responses", () => {
    const model = new ChatXAIResponses();
    expect(model._llmType()).toBe("xai-responses");
  });

  test("static lc_name should return ChatXAIResponses", () => {
    expect(ChatXAIResponses.lc_name()).toBe("ChatXAIResponses");
  });

  test("getLsParams should return correct LangSmith params", () => {
    const model = new ChatXAIResponses({
      model: "grok-3",
      temperature: 0.7,
      maxOutputTokens: 1024,
    });
    const lsParams = model.getLsParams({});
    expect(lsParams.ls_provider).toBe("xai");
    expect(lsParams.ls_model_name).toBe("grok-3");
    expect(lsParams.ls_model_type).toBe("chat");
    expect(lsParams.ls_temperature).toBe(0.7);
    expect(lsParams.ls_max_tokens).toBe(1024);
  });

  test("toJSON should not include apiKey", () => {
    delete process.env.XAI_API_KEY;
    const model = new ChatXAIResponses({
      model: "grok-3",
      apiKey: "secret-key",
    });
    const json = model.toJSON();
    expect(json).toBeDefined();
    if ("kwargs" in json && typeof json.kwargs === "object") {
      expect(json.kwargs).not.toHaveProperty("apiKey");
    }
  });
});

describe("lc_secrets and lc_aliases", () => {
  test("lc_secrets should map apiKey to XAI_API_KEY", () => {
    const model = new ChatXAIResponses();
    expect(model.lc_secrets).toEqual({
      apiKey: "XAI_API_KEY",
    });
  });

  test("lc_aliases should map apiKey to xai_api_key", () => {
    const model = new ChatXAIResponses();
    expect(model.lc_aliases).toEqual({
      apiKey: "xai_api_key",
    });
  });
});
