import { describe, expect, test } from "vitest";
import { AzureOpenAI } from "openai";
import {
  AzureChatOpenAI,
  AzureChatOpenAICompletions,
  AzureChatOpenAIResponses,
  type AzureChatOpenAIFields,
} from "../../../index.js";

const deployment = "endpoint-test-deployment";
const apiVersion = "2025-04-01-preview";
const resource = "https://endpoint-test.openai.azure.com";
const instance = { azureOpenAIApiInstanceName: "endpoint-test" };
const endpoint = { azureOpenAIEndpoint: resource };

function transport() {
  const requests: Request[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    // These synthetic responses exercise normal SDK/LangChain parsing, not Azure.
    const data = new URL(request.url).pathname.endsWith("/chat/completions")
      ? {
          id: "chatcmpl_fixture",
          object: "chat.completion",
          created: 1,
          model: deployment,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "fixture" },
              finish_reason: "stop",
            },
          ],
        }
      : {
          id: "resp_fixture",
          object: "response",
          created_at: 1,
          status: "completed",
          model: deployment,
          output: [
            {
              id: "msg_fixture",
              type: "message",
              status: "completed",
              role: "assistant",
              content: [
                { type: "output_text", text: "fixture", annotations: [] },
              ],
            },
          ],
        };
    return new Response(JSON.stringify(data), {
      headers: { "content-type": "application/json" },
    });
  };
  return { requests, fetch };
}

const baseFields = {
  azureOpenAIApiKey: "dummy-key",
  azureOpenAIApiVersion: apiVersion,
  maxRetries: 0,
};

async function assertRequest(
  request: Request,
  path: string,
  tokenProvider = false
) {
  const url = new URL(request.url);
  expect(url.pathname).toBe(path);
  expect(url.searchParams.get("api-version")).toBe(apiVersion);
  expect(request.method).toBe("POST");
  expect(await request.json()).toMatchObject({ model: deployment });
  if (tokenProvider) {
    expect(request.headers.get("authorization")).toBe("Bearer dummy-token");
    expect(request.headers.has("api-key")).toBe(false);
  } else {
    expect(request.headers.get("api-key")).toBe("dummy-key");
  }
}

const responsesCases: {
  name: string;
  fields: AzureChatOpenAIFields;
  wrapper?: boolean;
}[] = [
  {
    name: "reasoning.summary selects Responses from an instance",
    fields: { ...instance, reasoning: { summary: "auto" } },
    wrapper: true,
  },
  {
    name: "explicit useResponsesApi selects Responses",
    fields: { ...instance, useResponsesApi: true },
    wrapper: true,
  },
  { name: "explicit Responses class with an instance", fields: instance },
  {
    name: "reasoning.summary selects Responses from a resource endpoint",
    fields: { ...endpoint, reasoning: { summary: "auto" } },
    wrapper: true,
  },
  {
    name: "explicit Responses class with a resource endpoint",
    fields: endpoint,
  },
  {
    name: "Responses with an Azure token provider",
    fields: {
      ...instance,
      azureOpenAIApiKey: undefined,
      azureADTokenProvider: async () => "dummy-token",
    },
  },
  {
    name: "Responses with a trailing resource slash",
    fields: { azureOpenAIEndpoint: `${resource}/` },
  },
];

describe.each(responsesCases)("$name", ({ fields, wrapper }) => {
  test("uses the resource-level Responses route", async () => {
    const { requests, fetch } = transport();
    const modelFields = {
      ...baseFields,
      ...fields,
      configuration: { fetch },
    };
    const model = wrapper
      ? new AzureChatOpenAI(deployment, modelFields)
      : new AzureChatOpenAIResponses(deployment, modelFields);
    await model.invoke("hello");
    expect(requests).toHaveLength(1);
    await assertRequest(
      requests[0],
      "/openai/responses",
      Boolean(fields.azureADTokenProvider)
    );
  });
});

test.each([instance, endpoint])(
  "preserves deployment-scoped Chat Completions: %o",
  async (fields) => {
    const { requests, fetch } = transport();
    const model = new AzureChatOpenAI(deployment, {
      ...baseFields,
      ...fields,
      configuration: { fetch },
    });
    await model.invoke("hello");
    expect(requests).toHaveLength(1);
    await assertRequest(
      requests[0],
      `/openai/deployments/${deployment}/chat/completions`
    );
  }
);

test("preserves Chat Completions token authentication", async () => {
  const { requests, fetch } = transport();
  const model = new AzureChatOpenAICompletions(deployment, {
    ...baseFields,
    ...endpoint,
    azureOpenAIApiKey: undefined,
    azureADTokenProvider: async () => "dummy-token",
    configuration: { fetch },
  });
  await model.invoke("hello");
  await assertRequest(
    requests[0],
    `/openai/deployments/${deployment}/chat/completions`,
    true
  );
});

test.each(["responses", "completions"])(
  "does not reinterpret an explicit legacy base path: %s",
  async (api) => {
    const { requests, fetch } = transport();
    const fields = {
      ...baseFields,
      azureOpenAIBasePath: "https://proxy.example/custom/openai/deployments",
      configuration: { fetch },
    };
    const model =
      api === "responses"
        ? new AzureChatOpenAIResponses(deployment, fields)
        : new AzureChatOpenAICompletions(deployment, fields);
    await model.invoke("hello");
    const suffix = api === "responses" ? "responses" : "chat/completions";
    await assertRequest(
      requests[0],
      `/custom/openai/deployments/${deployment}/${suffix}`
    );
  }
);

test("retains custom-baseURL-only validation rather than redesigning proxies", async () => {
  const { requests, fetch } = transport();
  const model = new AzureChatOpenAIResponses(deployment, {
    ...baseFields,
    configuration: { fetch, baseURL: "https://proxy.example/custom" },
  });
  await expect(model.invoke("hello")).rejects.toThrow(
    "azureOpenAIApiInstanceName is required"
  );
  expect(requests).toHaveLength(0);
});

test("the installed Azure SDK uses the same resource-level Responses contract", async () => {
  const { requests, fetch } = transport();
  const client = new AzureOpenAI({
    endpoint: resource,
    deployment,
    apiKey: "dummy-key",
    apiVersion,
    fetch,
  });
  await client.responses.create({ model: deployment, input: "hello" });
  await assertRequest(requests[0], "/openai/responses");
});
