import * as util from "node:util";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ModelRefusalError } from "@langchain/core/errors";
import type { Question } from "@langchain/core/decisions";
import { ApiClient } from "../../clients/index.js";
import { GoogleClassifier, GoogleRequestRecorder } from "../../index.js";
import { GoogleClassifier as GoogleClassifierNode } from "../../node.js";
import {
  ConfigurationError,
  PromptRefusedError,
  RequestError,
} from "../../utils/errors.js";

class MockApiClient extends ApiClient {
  requests: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: unknown;
  }[] = [];

  private readonly _hasApiKey: boolean;

  private readonly _projectId: string;

  private readonly _handler: (
    request: Request,
    attempt: number
  ) => Promise<Response> | Response;

  constructor(
    options: {
      hasApiKey?: boolean;
      projectId?: string;
      handler?: (
        request: Request,
        attempt: number
      ) => Promise<Response> | Response;
    } = {}
  ) {
    super();
    this._hasApiKey = options.hasApiKey ?? true;
    this._projectId = options.projectId ?? "test-gcp-project";
    this._handler =
      options.handler ??
      (() =>
        new Response(
          JSON.stringify({
            answers: {
              is_damaged: { type: "noul", noul: 0.91, confidence: 0.91 },
            },
            usage: {
              total_input_tokens: 18,
              total_tokens: 18,
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-goog-request-id": "goog-req-42",
            },
          }
        ));
  }

  hasApiKey(): boolean {
    return this._hasApiKey;
  }

  override async getProjectId(): Promise<string> {
    return this._projectId;
  }

  async fetch(request: Request): Promise<Response> {
    request.signal?.throwIfAborted();
    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    this.requests.push({
      url: request.url,
      method: request.method,
      headers,
      body: rawBody ? JSON.parse(rawBody) : undefined,
    });
    const res = await this._handler(request, this.requests.length);
    return res;
  }
}

const SAMPLE_REQUEST = {
  state: "The ceramic mug arrived cracked in half.",
  questions: {
    is_damaged: {
      type: "noul" as const,
      instructions: "Did the item arrive damaged?",
    },
  },
};

describe("GoogleClassifier & GoogleClassifierNode unit tests", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "GOOGLE_API_KEY",
    "GOOGLE_CLOUD_CREDENTIALS",
    "LANGSMITH_GATEWAY",
    "LANGSMITH_API_KEY",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    vi.restoreAllMocks();
  });

  test("supports object and positional constructor overloads", () => {
    const mockClient = new MockApiClient();
    const objectWeb = new GoogleClassifier({
      model: "gemini-decision-1",
      apiClient: mockClient,
    });
    expect(objectWeb.model).toBe("gemini-decision-1");
    expect(GoogleClassifier.lc_name()).toBe("GoogleClassifier");

    const positionalWeb = new GoogleClassifier("gemini-decision-1", {
      apiClient: mockClient,
    });
    expect(positionalWeb.model).toBe("gemini-decision-1");

    const objectNode = new GoogleClassifierNode({
      model: "gemini-decision-1",
      apiClient: mockClient,
    });
    expect(objectNode.model).toBe("gemini-decision-1");

    const positionalNode = new GoogleClassifierNode("gemini-decision-1", {
      apiClient: mockClient,
    });
    expect(positionalNode.model).toBe("gemini-decision-1");
  });

  test("rejects missing, empty, or whitespace-only model names with ConfigurationError", () => {
    const mockClient = new MockApiClient();
    expect(
      () => new GoogleClassifier("   ", { apiClient: mockClient })
    ).toThrow(ConfigurationError);
    expect(
      () => new GoogleClassifierNode("", { apiClient: mockClient })
    ).toThrow(ConfigurationError);
    expect(
      () =>
        new GoogleClassifier({
          apiClient: mockClient,
        } as unknown as ConstructorParameters<typeof GoogleClassifier>[0])
    ).toThrow(ConfigurationError);
  });

  test("redacts sensitive credentials from lc_kwargs and util.inspect", () => {
    const fakeApiKey = "AIzaSySecretUnitKey123456789";
    const fakeCreds = {
      type: "service_account",
      project_id: "test-proj",
      private_key_id: "key-1",
      private_key: "-----BEGIN PRIVATE KEY-----\nSUPER_SECRET\n",
      client_id: "12345",
      client_email: "svc@test.iam.gserviceaccount.com",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url:
        "https://www.googleapis.com/robot/v1/metadata/x509/svc",
    };

    const web = new GoogleClassifier("gemini-decision-1", {
      apiKey: fakeApiKey,
      credentials: fakeCreds,
    });
    const node = new GoogleClassifierNode("gemini-decision-1", {
      apiKey: fakeApiKey,
      credentials: fakeCreds,
      googleAuthOptions: {
        keyFilename: "/tmp/NODE_SUPER_SECRET_KEY.json",
      },
    });

    expect(web.lc_secrets).toEqual({ apiKey: "GOOGLE_API_KEY" });
    for (const instance of [web, node]) {
      const kwargsDump = JSON.stringify(instance.lc_kwargs);
      const inspected = util.inspect(instance, { depth: 5 });
      expect(kwargsDump).not.toContain(fakeApiKey);
      expect(kwargsDump).not.toContain("SUPER_SECRET");
      expect(inspected).not.toContain(fakeApiKey);
      expect(inspected).not.toContain("SUPER_SECRET");
    }
  });

  test("routes URLs and headers across Developer API, Vertex AI, Vertex Express, and custom endpoints", async () => {
    // 1. Gemini Developer API (default when API key is present)
    const gaiClient = new MockApiClient({ hasApiKey: true });
    const gaiClassifier = new GoogleClassifier({
      model: "gemini-decision-1",
      apiClient: gaiClient,
      customHeaders: { "X-Custom-Client": "decisions-test" },
    });
    const gaiRes = await gaiClassifier.invoke(SAMPLE_REQUEST);
    expect(gaiClient.requests[0]?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/decisions"
    );
    expect(gaiClient.requests[0]?.headers["x-custom-client"]).toBe(
      "decisions-test"
    );
    expect(gaiClient.requests[0]?.body).toEqual({
      model: "gemini-decision-1",
      input: "The ceramic mug arrived cracked in half.",
      questions: {
        is_damaged: {
          type: "noul",
          instructions: "Did the item arrive damaged?",
        },
      },
    });
    expect(gaiRes.requestId).toBe("goog-req-42");
    expect(gaiRes.nouls.is_damaged.noul).toBe(0.91);

    // 2. Vertex AI global (default when no API key is present)
    const vertexGlobalClient = new MockApiClient({
      hasApiKey: false,
      projectId: "my-gcp-proj",
    });
    const vertexGlobal = new GoogleClassifierNode({
      model: "gemini-decision-1",
      apiClient: vertexGlobalClient,
    });
    await vertexGlobal.invoke(SAMPLE_REQUEST);
    expect(vertexGlobalClient.requests[0]?.url).toBe(
      "https://aiplatform.googleapis.com/v1/projects/my-gcp-proj/locations/global/decisions"
    );

    // 3. Vertex AI regional + custom apiVersion
    const vertexRegionalClient = new MockApiClient({
      hasApiKey: false,
      projectId: "my-gcp-proj",
    });
    const vertexRegional = new GoogleClassifierNode({
      model: "gemini-decision-1",
      apiClient: vertexRegionalClient,
      vertexai: true,
      location: "us-central1",
      apiVersion: "v1beta1",
    });
    await vertexRegional.invoke(SAMPLE_REQUEST);
    expect(vertexRegionalClient.requests[0]?.url).toBe(
      "https://us-central1-aiplatform.googleapis.com/v1beta1/projects/my-gcp-proj/locations/us-central1/decisions"
    );

    // 4. Vertex AI multi-region (eu)
    const vertexMultiRegionClient = new MockApiClient({
      hasApiKey: false,
      projectId: "my-gcp-proj",
    });
    const vertexMultiRegion = new GoogleClassifierNode({
      model: "gemini-decision-1",
      apiClient: vertexMultiRegionClient,
      platformType: "gcp",
      location: "eu",
    });
    await vertexMultiRegion.invoke(SAMPLE_REQUEST);
    expect(vertexMultiRegionClient.requests[0]?.url).toBe(
      "https://aiplatform.eu.rep.googleapis.com/v1/projects/my-gcp-proj/locations/eu/decisions"
    );

    // 5. Vertex Express (vertexai: true + API key, no explicit GCP credentials)
    const vertexExpressClient = new MockApiClient({ hasApiKey: true });
    const vertexExpress = new GoogleClassifier({
      model: "gemini-decision-1",
      apiClient: vertexExpressClient,
      vertexai: true,
    });
    await vertexExpress.invoke(SAMPLE_REQUEST);
    expect(vertexExpressClient.requests[0]?.url).toBe(
      "https://aiplatform.googleapis.com/v1/publishers/google/decisions"
    );

    // 6. Custom local endpoint
    const customEndpointClient = new MockApiClient({ hasApiKey: true });
    const customClassifier = new GoogleClassifier({
      model: "gemini-decision-1",
      apiClient: customEndpointClient,
      endpoint: "http://localhost:8080/proxy",
    });
    await customClassifier.invoke(SAMPLE_REQUEST);
    expect(customEndpointClient.requests[0]?.url).toBe(
      "http://localhost:8080/proxy/v1beta/decisions"
    );
  });

  test("applies LangSmith gateway routing when LANGSMITH_GATEWAY is configured", async () => {
    process.env.LANGSMITH_GATEWAY = "http://localhost:9123/v1/gateway";
    process.env.LANGSMITH_API_KEY = "ls_gateway_test_key";

    const mockClient = new MockApiClient({ hasApiKey: true });
    const classifier = new GoogleClassifier("gemini-decision-1", {
      apiClient: mockClient,
    });
    await classifier.invoke(SAMPLE_REQUEST);

    expect(mockClient.requests[0]?.url).toMatch(
      /^http:\/\/localhost:9123\/v1\/gateway\/.*\/v1beta\/decisions$/
    );
  });

  test("emits GoogleRequestRecorder custom events for both constructor and call callbacks", async () => {
    const ctorRecorder = new GoogleRequestRecorder();
    const callRecorder = new GoogleRequestRecorder();
    const mockClient = new MockApiClient();

    const classifier = new GoogleClassifier("gemini-decision-1", {
      apiClient: mockClient,
      callbacks: [ctorRecorder],
    });

    await classifier.invoke(SAMPLE_REQUEST, {
      callbacks: [callRecorder],
    });

    expect(ctorRecorder.request?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/decisions"
    );
    expect(ctorRecorder.response?.status).toBe(200);
    expect(callRecorder.request?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/decisions"
    );
    expect(callRecorder.response?.status).toBe(200);
  });

  test("sends multiple ContentBlocks in state as wire Interactions Content[]", async () => {
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const mockClient = new MockApiClient();
    const classifier = new GoogleClassifier("gemini-decision-1", {
      apiClient: mockClient,
      mediaResolution: "low",
    });

    const res = await classifier.invoke({
      state: [
        { type: "text", text: "Customer photo for return #8821:" },
        {
          type: "image",
          mimeType: "image/png",
          data: tinyPng,
        },
        { type: "text", text: "Inspect only the ceramic rim." },
      ],
      questions: SAMPLE_REQUEST.questions,
    });

    expect(res.nouls.is_damaged.noul).toBe(0.91);
    expect(mockClient.requests[0]?.body).toEqual({
      model: "gemini-decision-1",
      input: [
        { type: "text", text: "Customer photo for return #8821:" },
        {
          type: "image",
          mime_type: "image/png",
          data: tinyPng,
          resolution: "low",
        },
        { type: "text", text: "Inspect only the ceramic rim." },
      ],
      questions: {
        is_damaged: {
          type: "noul",
          instructions: "Did the item arrive damaged?",
        },
      },
    });
  });

  test("retries transient 503 errors via AsyncCaller and succeeds on retry", async () => {
    const mockClient = new MockApiClient({
      handler: (_req, attempt) => {
        if (attempt === 1) {
          return new Response(
            JSON.stringify({
              error: { code: "unavailable", message: "Backend busy" },
            }),
            {
              status: 503,
              headers: { "content-type": "application/json" },
            }
          );
        }
        return new Response(
          JSON.stringify({
            answers: {
              is_damaged: { type: "noul", noul: 0.88 },
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          }
        );
      },
    });

    const classifier = new GoogleClassifier("gemini-decision-1", {
      apiClient: mockClient,
      maxRetries: 2,
    });

    const res = await classifier.invoke(SAMPLE_REQUEST);
    expect(mockClient.requests.length).toBe(2);
    expect(res.nouls.is_damaged.noul).toBe(0.88);
  });

  test("does not retry HTTP 400 validation errors or HTTP 400 safety refusals", async () => {
    const badRequestClient = new MockApiClient({
      handler: () =>
        new Response(
          JSON.stringify({
            error: {
              code: "invalid_argument",
              message: "Choice question exceeds maximum options.",
            },
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        ),
    });

    const badRequestClassifier = new GoogleClassifier("gemini-decision-1", {
      apiClient: badRequestClient,
      maxRetries: 3,
    });

    await expect(badRequestClassifier.invoke(SAMPLE_REQUEST)).rejects.toSatisfy(
      (err) => RequestError.isInstance(err)
    );
    expect(badRequestClient.requests.length).toBe(1);

    const safetyClient = new MockApiClient({
      handler: () =>
        new Response(
          JSON.stringify({
            error: {
              code: "safety",
              message: "Input blocked by safety policy.",
            },
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        ),
    });

    const safetyClassifier = new GoogleClassifier("gemini-decision-1", {
      apiClient: safetyClient,
      maxRetries: 3,
    });

    await expect(safetyClassifier.invoke(SAMPLE_REQUEST)).rejects.toSatisfy(
      (err) =>
        PromptRefusedError.isInstance(err) && ModelRefusalError.isInstance(err)
    );
    expect(safetyClient.requests.length).toBe(1);
  });

  test("propagates AbortSignal cancellation", async () => {
    const controller = new AbortController();
    controller.abort(new Error("Caller cancelled decision request"));

    const mockClient = new MockApiClient();
    const classifier = new GoogleClassifier("gemini-decision-1", {
      apiClient: mockClient,
      maxRetries: 0,
    });

    await expect(
      classifier.invoke(SAMPLE_REQUEST, { signal: controller.signal })
    ).rejects.toThrow();
    expect(mockClient.requests.length).toBe(0);
  });

  test("preserves own __proto__ question and choice keys end-to-end through invoke()", async () => {
    const responseJson =
      '{"answers":{"__proto__":{"type":"choice","choice":"__proto__","probabilities":{"__proto__":0.75,"fallback":0.25},"confidence":0.75}}}';

    const mockClient = new MockApiClient({
      handler: () =>
        new Response(responseJson, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });

    const classifier = new GoogleClassifier("gemini-decision-1", {
      apiClient: mockClient,
    });

    const criteria: Record<string, string> = {};
    Object.defineProperty(criteria, "__proto__", {
      value: "Prototype label.",
      enumerable: true,
      configurable: true,
      writable: true,
    });
    criteria.fallback = "Fallback label.";

    const questions: Record<string, Question> = {};
    Object.defineProperty(questions, "__proto__", {
      value: {
        type: "choice",
        instructions: "Choose the prototype label.",
        criteria,
      },
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const result = await classifier.invoke({
      state: "Select __proto__.",
      questions,
    });

    expect(Object.hasOwn(result.answers, "__proto__")).toBe(true);
    expect(Object.hasOwn(result.choices, "__proto__")).toBe(true);
    const protoChoice = Object.getOwnPropertyDescriptor(
      result.choices,
      "__proto__"
    )?.value;
    expect(protoChoice?.choice).toBe("__proto__");
  });
});
