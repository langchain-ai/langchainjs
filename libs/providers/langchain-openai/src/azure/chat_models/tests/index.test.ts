import { test, expect, beforeEach, describe, vi } from "vitest";

import { env } from "../../../tests/utils.js";
import { AzureChatOpenAI } from "../index.js";

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_API_KEY;
  delete process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
  delete process.env.AZURE_OPENAI_BASE_PATH;
  delete process.env.AZURE_OPENAI_API_VERSION;
  delete process.env.AZURE_OPENAI_API_COMPLETIONS_DEPLOYMENT_NAME;
  delete process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME;
});

// FIXME: when we have `AZURE_OPENAI_ENDPOINT` in the env, it overrides `azureOpenAIEndpoint` options
env.useVariable("AZURE_OPENAI_ENDPOINT", undefined);

test("Test Azure OpenAI serialization from azure endpoint", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIEndpoint: "https://foobar.openai.azure.com/",
    azureOpenAIApiDeploymentName: "gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
  });
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"azure_endpoint":"https://foobar.openai.azure.com/","deployment_name":"gpt-4o","openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]}}}`
  );
});

test("Test Azure OpenAI supports deployment name shorthand", async () => {
  const chat = new AzureChatOpenAI("gpt-4o", {
    azureOpenAIEndpoint: "https://foobar.openai.azure.com/",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
  });

  expect(chat.model).toBe("gpt-4o");
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"model":"gpt-4o","deployment_name":"gpt-4o","azure_endpoint":"https://foobar.openai.azure.com/","openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]}}}`
  );
});

test("Test Azure OpenAI serialization does not pass along extra params", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIEndpoint: "https://foobar.openai.azure.com/",
    azureOpenAIApiDeploymentName: "gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
    extraParam: "extra",
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"azure_endpoint":"https://foobar.openai.azure.com/","deployment_name":"gpt-4o","openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]}}}`
  );
});

test("Test Azure OpenAI serialization from base path", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIBasePath:
      "https://foobar.openai.azure.com/openai/deployments/gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
  });
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]},"azure_endpoint":"https://foobar.openai.azure.com","deployment_name":"gpt-4o"}}`
  );
});

test("Test Azure OpenAI serialization from instance name", async () => {
  const chat = new AzureChatOpenAI({
    azureOpenAIApiInstanceName: "foobar",
    azureOpenAIApiDeploymentName: "gpt-4o",
    azureOpenAIApiVersion: "2024-08-01-preview",
    azureOpenAIApiKey: "foo",
  });
  expect(JSON.stringify(chat)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","azure_openai","AzureChatOpenAI"],"kwargs":{"azure_open_ai_api_instance_name":"foobar","deployment_name":"gpt-4o","openai_api_version":"2024-08-01-preview","azure_open_ai_api_key":{"lc":1,"type":"secret","id":["AZURE_OPENAI_API_KEY"]},"azure_endpoint":"https://foobar.openai.azure.com/"}}`
  );
});

describe("Azure OpenAI callback model attribution", () => {
  const deploymentName = "deployment-gpt-4o-mini";
  const tool = {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get weather for a city.",
      parameters: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
    },
  };

  function createCompletionsResponse() {
    return {
      id: "chatcmpl_test",
      object: "chat.completion",
      created: 0,
      model: deploymentName,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "It is sunny.",
            refusal: null,
          },
          finish_reason: "stop",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: 5,
        completion_tokens: 4,
        total_tokens: 9,
      },
    };
  }

  function createResponsesResponse() {
    return {
      id: "resp_test",
      object: "response",
      created_at: 0,
      status: "completed",
      error: null,
      incomplete_details: null,
      instructions: null,
      max_output_tokens: null,
      model: deploymentName,
      output: [
        {
          id: "msg_test",
          type: "message",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "It is sunny.",
              annotations: [],
              logprobs: [],
            },
          ],
        },
      ],
      parallel_tool_calls: true,
      previous_response_id: null,
      reasoning: { effort: null, summary: null },
      service_tier: "default",
      store: true,
      temperature: 1,
      text: { format: { type: "text" } },
      tool_choice: "auto",
      tools: [],
      top_p: 1,
      truncation: "disabled",
      usage: {
        input_tokens: 5,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 4,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 9,
      },
      user: null,
      metadata: {},
    };
  }

  function createModel(useResponsesApi: boolean, model?: string) {
    const mockFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify(
            useResponsesApi
              ? createResponsesResponse()
              : createCompletionsResponse()
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
    );
    const chat = new AzureChatOpenAI({
      ...(model ? { model } : {}),
      azureOpenAIEndpoint: "https://foobar.openai.azure.com/",
      azureOpenAIApiDeploymentName: deploymentName,
      azureOpenAIApiVersion: "2024-08-01-preview",
      azureOpenAIApiKey: "foo",
      useResponsesApi,
      maxRetries: 0,
      configuration: { fetch: mockFetch },
    });
    return { chat, mockFetch };
  }

  test.each([
    ["Chat Completions", "bare", false, (chat: AzureChatOpenAI) => chat],
    [
      "Chat Completions",
      "withConfig",
      false,
      (chat: AzureChatOpenAI) => chat.withConfig({ tags: ["configured"] }),
    ],
    [
      "Chat Completions",
      "bindTools",
      false,
      (chat: AzureChatOpenAI) => chat.bindTools([tool]),
    ],
    ["Responses API", "bare", true, (chat: AzureChatOpenAI) => chat],
    [
      "Responses API",
      "withConfig",
      true,
      (chat: AzureChatOpenAI) => chat.withConfig({ tags: ["configured"] }),
    ],
    [
      "Responses API",
      "bindTools",
      true,
      (chat: AzureChatOpenAI) => chat.bindTools([tool]),
    ],
  ])(
    "%s %s publishes the deployment in callbacks",
    async (_protocol, _scenario, useResponsesApi, wrap) => {
      const { chat, mockFetch } = createModel(useResponsesApi);
      const runnable = wrap(chat);
      let metadata: Record<string, unknown> | undefined;
      let invocationParams: Record<string, unknown> | undefined;

      const result = await runnable.invoke("What is the weather?", {
        callbacks: [
          {
            handleLLMStart: (
              _llm,
              _prompts,
              _runId,
              _parentRunId,
              extraParams,
              _tags,
              runMetadata
            ) => {
              invocationParams = extraParams?.invocation_params as
                | Record<string, unknown>
                | undefined;
              metadata = runMetadata;
            },
          },
        ],
      });

      expect(result.text).toBe("It is sunny.");
      expect(mockFetch).toHaveBeenCalledOnce();
      expect(metadata).toMatchObject({
        ls_model_name: deploymentName,
        ls_provider: "azure",
      });
      expect(invocationParams).toMatchObject({
        model: deploymentName,
      });
      const requestBody = JSON.parse(
        String(mockFetch.mock.calls[0]?.[1]?.body)
      ) as Record<string, unknown>;
      expect(requestBody.model).toBe(deploymentName);
      expect(requestBody).not.toHaveProperty("azureOpenAIApiDeploymentName");
    }
  );

  test.each([false, true])(
    "preserves an explicit model for useResponsesApi=%s",
    (useResponsesApi) => {
      const explicitModel = "explicit-model";
      const { chat } = createModel(useResponsesApi, explicitModel);
      expect(
        chat.getLsParams({} as Parameters<typeof chat.getLsParams>[0])
      ).toMatchObject({
        ls_model_name: explicitModel,
        ls_provider: "azure",
      });
      expect(chat.invocationParams({})).toMatchObject({
        model: explicitModel,
      });
    }
  );
});
