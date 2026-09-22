import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { load } from "@langchain/core/load";
import { ChatOpenAI, type ChatOpenAIFields } from "../index.js";
import { AzureChatOpenAI } from "../../azure/chat_models/index.js";

type CallOptions = Parameters<ChatOpenAI["invoke"]>[1];
type Body = Record<string, unknown>;
const passthrough = { reasoningParameterPolicy: "passthrough" as const };

beforeEach(() => {
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "");
  vi.stubEnv("LANGSMITH_TRACING", "false");
  vi.stubEnv("LANGCHAIN_TRACING_V2", "false");
  vi.stubGlobal("fetch", () => {
    throw new Error("Unexpected network request");
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function capture(
  fields: ChatOpenAIFields,
  options?: CallOptions,
  stream = false,
  azure = false
) {
  const requests: { url: string; body: Body }[] = [];
  const configuration = {
    baseURL: "https://reasoning.invalid/v1",
    fetch: vi.fn<typeof globalThis.fetch>(async (input, init) => {
      requests.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
      });
      return Response.json({ error: { message: "captured" } }, { status: 400 });
    }),
  };
  const params = {
    model: "custom-reasoner",
    apiKey: "test-key",
    maxRetries: 0,
    ...fields,
    configuration,
  };
  const model = azure
    ? new AzureChatOpenAI({
        ...params,
        azureOpenAIEndpoint: "https://reasoning.invalid",
        azureOpenAIApiDeploymentName: "custom-reasoner",
        azureOpenAIApiVersion: "2025-04-01-preview",
        azureOpenAIApiKey: "test-key",
      })
    : new ChatOpenAI(params);
  const messages: ["system" | "human", string][] = [
    ["system", "Be concise"],
    ["human", "Hello"],
  ];
  if (stream) {
    await expect(async () => {
      for await (const chunk of await model.stream(messages, options)) {
        expect.fail(`Unexpected response chunk: ${JSON.stringify(chunk)}`);
      }
    }).rejects.toThrow("captured");
  } else {
    await expect(model.invoke(messages, options)).rejects.toThrow("captured");
  }
  expect(requests).toHaveLength(1);
  expect(requests[0].body).not.toHaveProperty("reasoningParameterPolicy");
  expect(requests[0].body).not.toHaveProperty("reasoning_parameter_policy");
  return requests[0];
}

it.each([undefined, "auto"] as const)(
  "preserves suppression with policy %s",
  async (policy) => {
    for (const model of ["gpt-4o", "custom-reasoner"]) {
      for (const useResponsesApi of [true, false]) {
        const { body } = await capture({
          model,
          useResponsesApi,
          reasoningParameterPolicy: policy,
          reasoning: { effort: "high" },
        });
        expect(body).not.toHaveProperty("reasoning");
        expect(body).not.toHaveProperty("reasoning_effort");
      }
    }
  }
);

it.each([true, false])(
  "forwards explicit settings independently of names (Responses=%s)",
  async (useResponsesApi) => {
    for (const model of ["gpt-4o", "gpt-99-future", "custom-reasoner"]) {
      const { body } = await capture({
        ...passthrough,
        model,
        useResponsesApi,
        reasoning: { effort: "high" },
      });
      expect(useResponsesApi ? body.reasoning : body.reasoning_effort).toEqual(
        useResponsesApi ? { effort: "high" } : "high"
      );
    }
  }
);

it.each([true, false])(
  "omits unconfigured reasoning, including streaming (Responses=%s)",
  async (useResponsesApi) => {
    for (const stream of [true, false]) {
      const { body } = await capture(
        { ...passthrough, useResponsesApi },
        undefined,
        stream
      );
      expect(body).not.toHaveProperty("reasoning");
      expect(body).not.toHaveProperty("reasoning_effort");
      expect(body.stream).toBe(stream);
    }
  }
);

it("preserves the Astra regression fix without opting in", async () => {
  const reasoning = { effort: "max" as const, summary: "auto" as const };
  const { body } = await capture({
    model: "gpt-6-astra",
    useResponsesApi: true,
    reasoning,
  });
  expect(body.reasoning).toEqual(reasoning);
});

it("merges call options over constructor settings and legacy effort", async () => {
  const { body } = await capture(
    { ...passthrough, reasoning: { effort: "low", summary: "auto" } },
    { reasoning: { effort: "high" }, reasoningEffort: "medium" }
  );
  expect(body.reasoning).toEqual({ effort: "high", summary: "auto" });
});

it("uses legacy call effort only when merged effort is absent", async () => {
  const { body } = await capture(
    { ...passthrough, reasoning: { summary: "auto" } },
    { reasoningEffort: "high" }
  );
  expect(body.reasoning).toEqual({ effort: "high", summary: "auto" });
});

it.each([{}, { effort: null }])(
  "preserves explicit empty/null settings: %j",
  async (reasoning) => {
    const { body } = await capture({
      ...passthrough,
      useResponsesApi: true,
      reasoning,
    });
    expect(body.reasoning).toEqual(reasoning);
  }
);

it("does not overwrite explicit null effort with the legacy fallback", async () => {
  const { body } = await capture(
    { ...passthrough, useResponsesApi: true, reasoning: { effort: "high" } },
    { reasoning: { effort: null }, reasoningEffort: "low" }
  );
  expect(body.reasoning).toEqual({ effort: null });
});

it.each([true, false])(
  "preserves raw parameters and typed precedence (Responses=%s)",
  async (useResponsesApi) => {
    const modelKwargs = useResponsesApi
      ? { reasoning: { effort: "low", summary: "auto" } }
      : { reasoning_effort: "low" };
    const raw = await capture({ ...passthrough, useResponsesApi, modelKwargs });
    const typed = await capture({
      ...passthrough,
      useResponsesApi,
      modelKwargs,
      reasoning: { effort: "high" },
    });
    expect(raw.body).toMatchObject(modelKwargs);
    expect(
      useResponsesApi ? typed.body.reasoning : typed.body.reasoning_effort
    ).toEqual(useResponsesApi ? { effort: "high" } : "high");
  }
);

it("preserves summary-driven routing and streaming call-only reasoning", async () => {
  const effort = await capture(
    { ...passthrough },
    { reasoning: { effort: "high" } }
  );
  expect(effort.url).toContain("/chat/completions");
  expect(effort.body.reasoning_effort).toBe("high");
  const reasoning = { effort: "high" as const, summary: "auto" as const };
  const summary = await capture({ ...passthrough }, { reasoning }, true);
  expect(summary.url).toContain("/responses");
  expect(summary.body.reasoning).toEqual(reasoning);
  expect(summary.body.stream).toBe(true);
});

it.each([true, false])(
  "does not couple policy to role/token transformations (Responses=%s)",
  async (useResponsesApi) => {
    for (const model of ["custom-reasoner", "gpt-5", "gpt-6-astra", "o3"]) {
      const fields = {
        model,
        useResponsesApi,
        maxTokens: 100,
        reasoning: { effort: "high" as const },
      };
      const auto = await capture(fields);
      const explicit = await capture({ ...fields, ...passthrough });
      for (const key of ["reasoning", "reasoning_effort"]) {
        delete auto.body[key];
        delete explicit.body[key];
      }
      expect(explicit.body).toEqual(auto.body);
    }
  }
);

it.each([true, false])(
  "supports custom Azure deployments (Responses=%s)",
  async (useResponsesApi) => {
    const { body } = await capture(
      { ...passthrough, useResponsesApi, reasoning: { effort: "high" } },
      undefined,
      false,
      true
    );
    expect(useResponsesApi ? body.reasoning : body.reasoning_effort).toEqual(
      useResponsesApi ? { effort: "high" } : "high"
    );
  }
);

it("retains explicit policy and behavior through serialization", async () => {
  const model = new ChatOpenAI({
    ...passthrough,
    model: "custom-reasoner",
    apiKey: "test-key",
    reasoning: { effort: "high" },
  });
  const reloaded = await load<ChatOpenAI>(JSON.stringify(model), {
    secretsMap: { OPENAI_API_KEY: "test-key" },
    importMap: { chat_models__openai: { ChatOpenAI } },
  });
  expect(reloaded.reasoningParameterPolicy).toBe("passthrough");
  expect(reloaded.invocationParams().reasoning_effort).toBe("high");
});
