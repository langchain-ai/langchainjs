import { describe, expect, test, vi } from "vitest";
import { z } from "zod/v3";
import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { ApiClient } from "../../../clients/index.js";
import { GenerateContentApiHandler } from "../generate_content.js";
import { GoogleChatApiHandler } from "../base.js";
import { ChatGoogle } from "../../index.js";
import { PromptBlockedError } from "../../../utils/errors.js";
import type {
  GenerateContentApiHandlerParams,
  GenerateContentInvocationParams,
  GoogleChatApiHandlerParams,
  BaseChatGoogleCallOptions,
} from "../../types.js";

class MockApiClient extends ApiClient {
  public recordedRequests: Request[] = [];
  public responseGenerator: (req: Request) => Promise<Response> | Response;

  constructor(
    responseGenerator: (req: Request) => Promise<Response> | Response = () =>
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "mock response" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      )
  ) {
    super();
    this.responseGenerator = responseGenerator;
  }

  hasApiKey(): boolean {
    return true;
  }

  override async getProjectId(): Promise<string> {
    return "test-project-123";
  }

  async fetch(request: Request): Promise<Response> {
    this.recordedRequests.push(request);
    return this.responseGenerator(request);
  }
}

function createHandler(
  overrides?: Partial<GenerateContentApiHandlerParams>
): GenerateContentApiHandler {
  const defaultParams: GenerateContentApiHandlerParams = {
    model: "gemini-2.0-flash",
    platform: "gai",
    apiVersion: "v1beta",
    apiClient: new MockApiClient(),
    caller: new AsyncCaller({}),
    ...overrides,
  };
  return new GenerateContentApiHandler(defaultParams);
}

describe("GenerateContentApiHandler", () => {
  describe("URL generation", () => {
    test("builds Gemini Developer API (gai) URL correctly", async () => {
      const handler = createHandler({
        platform: "gai",
        apiVersion: "v1beta",
        model: "gemini-2.0-flash",
      });

      const url = await handler.buildUrl();
      expect(url).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
      );
    });

    test("builds Gemini Developer API URL with query parameters without double encoding", async () => {
      const handler = createHandler({
        platform: "gai",
        apiVersion: "v1beta",
        model: "gemini-2.0-flash",
      });

      const url = await handler.buildUrl("streamGenerateContent?alt=sse");
      expect(url).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse"
      );
    });

    test("builds Gemini Developer API URL preserving gateway baseUrl path", async () => {
      const handler = createHandler({
        platform: "gai",
        apiVersion: "v1beta",
        model: "gemini-2.0-flash",
        baseUrl: "http://localhost:8080/gemini",
      });

      const url = await handler.buildUrl();
      expect(url).toBe(
        "http://localhost:8080/gemini/v1beta/models/gemini-2.0-flash:generateContent"
      );
    });

    test("builds Vertex AI (gcp) standard URL with project and location", async () => {
      const handler = createHandler({
        platform: "gcp",
        apiVersion: "v1",
        model: "gemini-2.0-flash",
        location: "us-central1",
        project: "my-gcp-project",
      });

      const url = await handler.buildUrl();
      expect(url).toBe(
        "https://us-central1-aiplatform.googleapis.com/v1/projects/my-gcp-project/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent"
      );
    });

    test("builds Vertex AI standard URL resolving project from apiClient", async () => {
      const handler = createHandler({
        platform: "gcp",
        apiVersion: "v1",
        model: "gemini-2.0-flash",
        location: "us-east4",
      });

      const url = await handler.buildUrl();
      expect(url).toBe(
        "https://us-east4-aiplatform.googleapis.com/v1/projects/test-project-123/locations/us-east4/publishers/google/models/gemini-2.0-flash:generateContent"
      );
    });

    test("builds Vertex AI Express URL correctly", async () => {
      const handler = createHandler({
        platform: "gcp",
        apiVersion: "v1",
        model: "gemini-2.0-flash",
        isVertexExpress: true,
      });

      const url = await handler.buildUrl();
      expect(url).toBe(
        "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.0-flash:generateContent"
      );
    });
  });

  describe("Request headers", () => {
    test("adds Vertex priority header on GCP when serviceTier is priority", () => {
      const handler = createHandler({
        platform: "gcp",
        serviceTier: "priority",
      });

      const headers = handler.getHeaders();
      expect(headers["X-Vertex-AI-LLM-Shared-Request-Type"]).toBe("priority");
    });

    test("does not add Vertex priority header on GAI platform even if serviceTier is priority", () => {
      const handler = createHandler({
        platform: "gai",
        serviceTier: "priority",
      });

      const headers = handler.getHeaders();
      expect(headers["X-Vertex-AI-LLM-Shared-Request-Type"]).toBeUndefined();
    });

    test("merges custom headers from params and call options", () => {
      const handler = createHandler({
        platform: "gai",
        customHeaders: { "X-Custom-Instance": "inst-val" },
      });

      const headers = handler.getHeaders({
        customHeaders: { "X-Custom-Call": "call-val" },
      });
      expect(headers["X-Custom-Instance"]).toBe("inst-val");
      expect(headers["X-Custom-Call"]).toBe("call-val");
    });
  });

  describe("Invocation parameters mapping", () => {
    test("maps basic generation config options", () => {
      const handler = createHandler({
        model: "gemini-2.0-flash",
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2048,
        stopSequences: ["STOP"],
      });

      const params = handler.invocationParams();
      expect(params.generationConfig?.temperature).toBe(0.7);
      expect(params.generationConfig?.topP).toBe(0.9);
      expect(params.generationConfig?.topK).toBe(40);
      expect(params.generationConfig?.maxOutputTokens).toBe(2048);
      expect(params.generationConfig?.stopSequences).toEqual(["STOP"]);
    });

    test("maps thinking config options for Gemini 2.0 (thinkingLevel) and Gemini 2.5 (thinkingBudget)", () => {
      const handler20 = createHandler({
        model: "gemini-2.0-flash",
        thinkingLevel: "HIGH",
      });
      const params20 = handler20.invocationParams();
      expect(params20.generationConfig?.thinkingConfig?.thinkingLevel).toBe(
        "HIGH"
      );
      expect(params20.generationConfig?.thinkingConfig?.includeThoughts).toBe(
        true
      );

      const handler25 = createHandler({
        model: "gemini-2.5-flash",
        thinkingBudget: 1024,
      });
      const params25 = handler25.invocationParams();
      expect(params25.generationConfig?.thinkingConfig?.thinkingBudget).toBe(
        1024
      );
      expect(params25.generationConfig?.thinkingConfig?.includeThoughts).toBe(
        true
      );
    });

    test("maps safety settings", () => {
      const handler = createHandler({
        model: "gemini-2.0-flash",
        safetySettings: [
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_LOW_AND_ABOVE",
          },
        ],
      });

      const params = handler.invocationParams();
      expect(params.safetySettings).toEqual([
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_LOW_AND_ABOVE",
        },
      ]);
    });

    test("maps toolConfig with mode and allowedFunctionNames when tools are provided", () => {
      const handler = createHandler({
        model: "gemini-2.0-flash",
        tools: [
          {
            functionDeclarations: [
              { name: "search", description: "Search the web" },
              { name: "calculator", description: "Calculate" },
            ],
          },
        ],
      });

      const params = handler.invocationParams({
        tool_choice: "search",
      });
      expect(params.toolConfig?.functionCallingConfig?.mode).toBe("ANY");
      expect(
        params.toolConfig?.functionCallingConfig?.allowedFunctionNames
      ).toEqual(["search"]);
    });

    test("maps responseMimeType and responseSchema", () => {
      const schema = {
        type: "object",
        properties: { answer: { type: "string" } },
      };
      const handler = createHandler({
        model: "gemini-2.0-flash",
        responseSchema: schema,
      });

      const params = handler.invocationParams();
      expect(params.generationConfig?.responseMimeType).toBe(
        "application/json"
      );
      expect(params.generationConfig?.responseJsonSchema).toEqual(schema);
    });
  });

  describe("Structured output formatting", () => {
    test("formats structured output tool from JSON schema", () => {
      const handler = createHandler();
      const schema = {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
        },
        required: ["city"],
      };

      const formatted = handler.formatStructuredOutputTool(schema, {
        name: "get_weather",
        description: "Get weather info",
      });
      expect(formatted.tools).toEqual([
        {
          functionDeclarations: [
            {
              name: "get_weather",
              description: "Get weather info",
              parameters: schema,
            },
          ],
        },
      ]);
      expect(formatted.toolChoice).toBe("get_weather");
    });

    test("formats structured output tool from Zod schema", () => {
      const handler = createHandler();
      const zodSchema = z.object({
        query: z.string().describe("Search query"),
      });

      const formatted = handler.formatStructuredOutputTool(zodSchema, {
        name: "perform_search",
        description: "Performs a web search",
      });
      expect(formatted.tools).toHaveLength(1);
      const decl = (
        formatted.tools[0] as {
          functionDeclarations?: Array<{ name: string; description: string }>;
        }
      ).functionDeclarations;
      expect(decl).toBeDefined();
      expect(decl?.[0].name).toBe("perform_search");
      expect(decl?.[0].description).toBe("Performs a web search");
      expect(formatted.toolChoice).toBe("perform_search");
    });
  });

  describe("Execution lifecycle", () => {
    test("executes generate and returns ChatResult with usage metadata", async () => {
      const mockClient = new MockApiClient();
      const handler = createHandler({ apiClient: mockClient });

      const result = await handler.generate([
        new HumanMessage("Hello, who are you?"),
      ]);

      expect(mockClient.recordedRequests).toHaveLength(1);
      expect(result.generations).toHaveLength(1);
      expect(result.generations[0].text).toBe("mock response");
      expect(result.llmOutput?.usageMetadata).toEqual({
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        input_token_details: {
          cache_read: 0,
        },
        output_token_details: {
          reasoning: 0,
        },
      });
    });

    test("throws PromptBlockedError when prompt is blocked by safety filters", async () => {
      const mockClient = new MockApiClient(
        () =>
          new Response(
            JSON.stringify({
              promptFeedback: {
                blockReason: "SAFETY",
                safetyRatings: [],
              },
            }),
            { headers: { "Content-Type": "application/json" } }
          )
      );
      const handler = createHandler({ apiClient: mockClient });

      await expect(
        handler.generate([new HumanMessage("unsafe prompt")])
      ).rejects.toThrow(PromptBlockedError);
    });

    test("streams response chunks using streamResponseChunks", async () => {
      const chunks = [
        {
          candidates: [
            {
              content: { parts: [{ text: "Hello " }] },
            },
          ],
        },
        {
          candidates: [
            {
              content: { parts: [{ text: "world!" }] },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 2,
            totalTokenCount: 7,
          },
        },
      ];

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
            );
          }
          controller.close();
        },
      });

      const mockClient = new MockApiClient(
        () =>
          new Response(stream, {
            headers: { "Content-Type": "text/event-stream" },
          })
      );
      const handler = createHandler({ apiClient: mockClient });

      const receivedChunks: ChatGenerationChunk[] = [];
      for await (const chunk of handler.streamResponseChunks([
        new HumanMessage("Hello"),
      ])) {
        receivedChunks.push(chunk);
      }

      expect(receivedChunks).toHaveLength(2);
      expect(receivedChunks[0].text).toBe("Hello ");
      expect(receivedChunks[1].text).toBe("world!");
    });
  });

  describe("BaseChatGoogle with custom handler", () => {
    test("allows injecting a custom GoogleChatApiHandler via apiHandler factory", async () => {
      class CustomTestHandler extends GoogleChatApiHandler<
        GenerateContentInvocationParams,
        GenerateContentApiHandlerParams
      > {
        protected getUrlSuffix(): string {
          return "/test-model:custom";
        }

        async generate(): Promise<{ generations: ChatGenerationChunk[] }> {
          return {
            generations: [
              new ChatGenerationChunk({
                text: "custom handler response",
                message: new AIMessageChunk({
                  content: "custom handler response",
                }),
              }),
            ],
          };
        }

        async *streamResponseChunks(): AsyncGenerator<ChatGenerationChunk> {
          yield new ChatGenerationChunk({
            text: "custom stream chunk",
            message: new AIMessageChunk({ content: "custom stream chunk" }),
          });
        }

        invocationParams(): GenerateContentInvocationParams {
          return {};
        }

        formatStructuredOutputTool() {
          throw new Error("Not implemented");
        }
      }

      const customFactory = vi.fn(
        (params: GoogleChatApiHandlerParams) =>
          new CustomTestHandler(params as GenerateContentApiHandlerParams)
      );

      const model = new ChatGoogle({
        model: "gemini-2.0-flash",
        apiKey: "fake-key",
        apiHandler: customFactory,
      });

      const result = await model.invoke("Hello from test");
      expect(customFactory).toHaveBeenCalledTimes(1);
      expect(result.content).toBe("custom handler response");
    });
  });
});
