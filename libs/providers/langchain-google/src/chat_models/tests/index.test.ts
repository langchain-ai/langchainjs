import {
  afterEach,
  beforeEach,
  describe,
  expect,
  MockInstance,
  test,
  vi,
} from "vitest";
import * as fs from "node:fs";
import { ApiClient } from "../../clients/index.js";
import { GoogleRequestRecorder } from "../../utils/handler.js";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { ChatGoogle, ChatGoogleParams } from "../index.js";
import { AIMessageChunk } from "@langchain/core/messages";
import type { Gemini } from "../types.js";

interface MockResponseParameters {
  filePath: string;
  url: string;
}

class MockResponse implements Response {
  private readonly filePath: string;
  private readonly bodyText: string;

  readonly headers: Headers = new Headers();
  readonly ok: boolean = true;
  readonly redirected: boolean = false;
  readonly status: number = 200;
  readonly statusText: string = "OK";
  readonly type: ResponseType = "basic";
  readonly url: string = "http://localhost";
  readonly body: ReadableStream<Uint8Array<ArrayBuffer>> | null = null;
  readonly bodyUsed: boolean = false;

  constructor({ filePath, url }: MockResponseParameters) {
    this.bodyText = fs.readFileSync(filePath, "utf-8");
    this.filePath = filePath;
    this.url = url;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return new TextEncoder().encode(this.bodyText).buffer;
  }
  async blob(): Promise<Blob> {
    return new Blob([this.bodyText]);
  }
  async formData(): Promise<FormData> {
    throw new Error("Not implemented");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async json(): Promise<any> {
    return JSON.parse(this.bodyText);
  }
  async text(): Promise<string> {
    return this.bodyText;
  }
  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return new TextEncoder().encode(this.bodyText);
  }
  clone(): Response {
    return new MockResponse({
      filePath: this.filePath,
      url: this.url,
    });
  }
}

class MockStreamingResponse implements Response {
  private readonly bodyText: string;

  readonly headers: Headers = new Headers();
  readonly ok: boolean = true;
  readonly redirected: boolean = false;
  readonly status: number = 200;
  readonly statusText: string = "OK";
  readonly type: ResponseType = "basic";
  readonly url: string = "http://localhost";
  readonly body: ReadableStream<Uint8Array<ArrayBuffer>>;
  readonly bodyUsed: boolean = false;

  constructor({ filePath, url }: MockResponseParameters) {
    this.bodyText = fs.readFileSync(filePath, "utf-8");
    this.url = url;
    const text = this.bodyText;
    this.body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return new TextEncoder().encode(this.bodyText).buffer;
  }
  async blob(): Promise<Blob> {
    return new Blob([this.bodyText]);
  }
  async formData(): Promise<FormData> {
    throw new Error("Not implemented");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async json(): Promise<any> {
    return JSON.parse(this.bodyText);
  }
  async text(): Promise<string> {
    return this.bodyText;
  }
  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return new TextEncoder().encode(this.bodyText);
  }
  clone(): Response {
    return new MockStreamingResponse({
      filePath: "",
      url: this.url,
    });
  }
}

class MockChunkStreamingResponse implements Response {
  readonly headers: Headers = new Headers();
  readonly ok: boolean = true;
  readonly redirected: boolean = false;
  readonly status: number = 200;
  readonly statusText: string = "OK";
  readonly type: ResponseType = "basic";
  readonly url: string = "http://localhost";
  readonly bodyUsed: boolean = false;
  readonly body: ReadableStream<Uint8Array>;

  constructor(chunks: object[]) {
    const encoder = new TextEncoder();
    this.body = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          const sseEvent = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(sseEvent));
        }
        controller.close();
      },
    });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    throw new Error("Not implemented");
  }
  async blob(): Promise<Blob> {
    throw new Error("Not implemented");
  }
  async formData(): Promise<FormData> {
    throw new Error("Not implemented");
  }
  async json(): Promise<unknown> {
    throw new Error("Not implemented - use streaming");
  }
  async text(): Promise<string> {
    throw new Error("Not implemented");
  }
  async bytes(): Promise<Uint8Array> {
    throw new Error("Not implemented");
  }
  clone(): Response {
    throw new Error("Not implemented");
  }
}

class MockStreamingApiClient extends ApiClient {
  request: Request;

  response: Response;

  private chunks: object[];

  constructor(chunks: object[]) {
    super();
    this.chunks = chunks;
  }

  async fetch(request: Request): Promise<Response> {
    this.request = request;
    this.response = new MockChunkStreamingResponse(this.chunks);
    return this.response;
  }

  hasApiKey(): boolean {
    return false;
  }
}

interface MockApiClientOptions {
  fileName: string;
  streaming?: boolean;
}

class MockApiClient extends ApiClient {
  request: Request;

  response: Response;

  filePath: string;

  streaming: boolean;

  constructor({ fileName, streaming }: MockApiClientOptions) {
    super();
    this.filePath = `src/chat_models/tests/data/mock/${fileName}`;
    this.streaming = streaming ?? false;
  }

  async fetch(request: Request): Promise<Response> {
    this.request = request;
    const params = { filePath: this.filePath, url: request.url };
    this.response = this.streaming
      ? new MockStreamingResponse(params)
      : new MockResponse(params);
    return this.response;
  }

  hasApiKey(): boolean {
    return false;
  }
}

type MockChatGoogleParams = ChatGoogleParams & {
  responseFile: string;
  streaming?: boolean;
};

describe("Google Mock", () => {
  let recorder: GoogleRequestRecorder;
  let callbacks: BaseCallbackHandler[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let warnSpy: MockInstance<any>;

  function newChatGoogle(mockFields: MockChatGoogleParams): ChatGoogle {
    const { model, responseFile, streaming, ...fields } = mockFields;
    recorder = new GoogleRequestRecorder();
    callbacks = [
      recorder,
      // new GoogleRequestLogger(),
    ];

    const apiClient = new MockApiClient({
      fileName: responseFile,
      streaming,
    });

    const params = {
      model,
      callbacks,
      apiClient,
      ...(fields ?? {}),
    };
    return new ChatGoogle(params);
  }

  beforeEach(async () => {
    warnSpy = vi.spyOn(global.console, "warn");
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("basic", async () => {
    const llm = newChatGoogle({
      model: "gemini-3-pro-preview",
      responseFile: "gemini-chat-001.json",
    });
    await llm.invoke("What is 1+1?");
    // console.log('request',recorder.request);
    expect(recorder?.request?.body?.generationConfig?.candidateCount).toEqual(
      1
    );
  });

  type TestReasoning = {
    model: string;
    maxReasoningTokens?: number;
    reasoningEffort?: string;
    expectIncludeThoughts?: boolean;
    expectThinkingBudget?: number;
    expectThinkingLevel?: Gemini.ThinkingLevel;
  };

  const testReasoning25Tokens: TestReasoning[] = [
    {
      model: "gemini-2.5-pro",
      maxReasoningTokens: -1,
      expectIncludeThoughts: true,
      expectThinkingBudget: -1,
    },
    {
      model: "gemini-2.5-pro",
      maxReasoningTokens: 0,
      expectIncludeThoughts: false,
      expectThinkingBudget: 128,
    },
    {
      model: "gemini-2.5-pro",
      maxReasoningTokens: 1000,
      expectIncludeThoughts: true,
      expectThinkingBudget: 1000,
    },
    {
      model: "gemini-2.5-flash",
      maxReasoningTokens: -1,
      expectIncludeThoughts: true,
      expectThinkingBudget: -1,
    },
    {
      model: "gemini-2.5-flash",
      maxReasoningTokens: 0,
      expectIncludeThoughts: false,
      expectThinkingBudget: 0,
    },
    {
      model: "gemini-2.5-flash",
      maxReasoningTokens: 1000,
      expectIncludeThoughts: true,
      expectThinkingBudget: 1000,
    },
    {
      model: "gemini-2.5-flash-lite",
      maxReasoningTokens: -1,
      expectIncludeThoughts: true,
      expectThinkingBudget: -1,
    },
    {
      model: "gemini-2.5-flash-lite",
      maxReasoningTokens: 0,
      expectIncludeThoughts: false,
      expectThinkingBudget: 0,
    },
    {
      model: "gemini-2.5-flash-lite",
      maxReasoningTokens: 1000,
      expectIncludeThoughts: true,
      expectThinkingBudget: 1000,
    },
  ];
  const testReasoning3Tokens: TestReasoning[] = [
    {
      model: "gemini-3-pro",
      maxReasoningTokens: -1,
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
    {
      model: "gemini-3-pro",
      maxReasoningTokens: 0,
      expectIncludeThoughts: false,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3-pro",
      maxReasoningTokens: 1000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3-pro",
      maxReasoningTokens: 8000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3-pro",
      maxReasoningTokens: 20000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
    {
      model: "gemini-3.1-pro",
      maxReasoningTokens: -1,
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
    {
      model: "gemini-3.1-pro",
      maxReasoningTokens: 0,
      expectIncludeThoughts: false,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3.1-pro",
      maxReasoningTokens: 1000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3.1-pro",
      maxReasoningTokens: 8000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "MEDIUM",
    },
    {
      model: "gemini-3.1-pro",
      maxReasoningTokens: 20000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
    {
      model: "gemini-3-flash",
      maxReasoningTokens: -1,
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
    {
      model: "gemini-3-flash",
      maxReasoningTokens: 0,
      expectIncludeThoughts: false,
      expectThinkingLevel: "MINIMAL",
    },
    {
      model: "gemini-3-flash",
      maxReasoningTokens: 1000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3-flash",
      maxReasoningTokens: 8000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "MEDIUM",
    },
    {
      model: "gemini-3-flash",
      maxReasoningTokens: 20000,
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
  ];
  const testReasoning25Effort: TestReasoning[] = [
    {
      model: "gemini-2.5-pro",
      reasoningEffort: "minimal",
      expectIncludeThoughts: false,
      expectThinkingBudget: 128,
    },
    {
      model: "gemini-2.5-pro",
      reasoningEffort: "low",
      expectIncludeThoughts: true,
      expectThinkingBudget: 1024,
    },
    {
      model: "gemini-2.5-pro",
      reasoningEffort: "medium",
      expectIncludeThoughts: true,
      expectThinkingBudget: 8 * 1024,
    },
    {
      model: "gemini-2.5-pro",
      reasoningEffort: "high",
      expectIncludeThoughts: true,
      expectThinkingBudget: 32 * 1024,
    },
    {
      model: "gemini-2.5-flash",
      reasoningEffort: "minimal",
      expectIncludeThoughts: false,
      expectThinkingBudget: 0,
    },
    {
      model: "gemini-2.5-flash",
      reasoningEffort: "low",
      expectIncludeThoughts: true,
      expectThinkingBudget: 1024,
    },
    {
      model: "gemini-2.5-flash",
      reasoningEffort: "medium",
      expectIncludeThoughts: true,
      expectThinkingBudget: 8 * 1024,
    },
    {
      model: "gemini-2.5-flash",
      reasoningEffort: "high",
      expectIncludeThoughts: true,
      expectThinkingBudget: 24 * 1024,
    },
    {
      model: "gemini-2.5-flash-lite",
      reasoningEffort: "minimal",
      expectIncludeThoughts: false,
      expectThinkingBudget: 0,
    },
    {
      model: "gemini-2.5-flash-lite",
      reasoningEffort: "low",
      expectIncludeThoughts: true,
      expectThinkingBudget: 1024,
    },
    {
      model: "gemini-2.5-flash-lite",
      reasoningEffort: "medium",
      expectIncludeThoughts: true,
      expectThinkingBudget: 8 * 1024,
    },
    {
      model: "gemini-2.5-flash-lite",
      reasoningEffort: "high",
      expectIncludeThoughts: true,
      expectThinkingBudget: 24 * 1024,
    },
  ];
  const testReasoning3Effort: TestReasoning[] = [
    {
      model: "gemini-3-pro",
      reasoningEffort: "minimal",
      expectIncludeThoughts: false,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3-pro",
      reasoningEffort: "low",
      expectIncludeThoughts: true,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3-pro",
      reasoningEffort: "medium",
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
    {
      model: "gemini-3-pro",
      reasoningEffort: "high",
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
    {
      model: "gemini-3.1-pro",
      reasoningEffort: "minimal",
      expectIncludeThoughts: false,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3.1-pro",
      reasoningEffort: "low",
      expectIncludeThoughts: true,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3.1-pro",
      reasoningEffort: "medium",
      expectIncludeThoughts: true,
      expectThinkingLevel: "MEDIUM",
    },
    {
      model: "gemini-3.1-pro",
      reasoningEffort: "high",
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
    {
      model: "gemini-3-flash",
      reasoningEffort: "minimal",
      expectIncludeThoughts: false,
      expectThinkingLevel: "MINIMAL",
    },
    {
      model: "gemini-3-flash",
      reasoningEffort: "low",
      expectIncludeThoughts: true,
      expectThinkingLevel: "LOW",
    },
    {
      model: "gemini-3-flash",
      reasoningEffort: "medium",
      expectIncludeThoughts: true,
      expectThinkingLevel: "MEDIUM",
    },
    {
      model: "gemini-3-flash",
      reasoningEffort: "high",
      expectIncludeThoughts: true,
      expectThinkingLevel: "HIGH",
    },
  ];

  const testReasoning: TestReasoning[] = [
    ...testReasoning25Tokens,
    ...testReasoning3Tokens,
    ...testReasoning25Effort,
    ...testReasoning3Effort,
  ];

  describe.each(testReasoning)(
    "reasoning - $model - $maxReasoningTokens - $reasoningEffort",
    ({
      model,
      maxReasoningTokens,
      reasoningEffort,
      expectIncludeThoughts,
      expectThinkingBudget,
      expectThinkingLevel,
    }: TestReasoning) => {
      test("reasoning", async () => {
        const llm = newChatGoogle({
          model,
          responseFile: "gemini-chat-001.json",
          maxReasoningTokens,
          reasoningEffort,
        });
        await llm.invoke("What is 1+1?");
        const thinkingConfig: Gemini.ThinkingConfig =
          recorder?.request?.body?.generationConfig?.thinkingConfig;
        expect(thinkingConfig?.thinkingBudget).toEqual(expectThinkingBudget);
        expect(thinkingConfig?.thinkingLevel).toEqual(expectThinkingLevel);
        expect(thinkingConfig?.includeThoughts).toEqual(expectIncludeThoughts);
      });
    }
  );

  describe("streaming usage_metadata", () => {
    test("each chunk carries delta usage_metadata that sums to correct totals", async () => {
      const llm = newChatGoogle({
        model: "gemini-2.5-flash",
        responseFile: "gemini-stream-001.txt",
        streaming: true,
      });

      const chunks: AIMessageChunk[] = [];
      for await (const chunk of await llm.stream("Why is the sky blue?")) {
        chunks.push(chunk);
      }

      const chunksWithUsage = chunks.filter(
        (c) => c.usage_metadata !== undefined
      );
      expect(chunksWithUsage.length).toBeGreaterThan(1);

      expect(chunksWithUsage[0].usage_metadata!.input_tokens).toBe(10);
      expect(chunksWithUsage[0].usage_metadata!.output_tokens).toBe(1);
      expect(chunksWithUsage[0].usage_metadata!.total_tokens).toBe(11);

      expect(chunksWithUsage[1].usage_metadata!.input_tokens).toBe(0);
      expect(chunksWithUsage[1].usage_metadata!.output_tokens).toBe(4);
      expect(chunksWithUsage[1].usage_metadata!.total_tokens).toBe(4);

      expect(chunksWithUsage[2].usage_metadata!.input_tokens).toBe(0);
      expect(chunksWithUsage[2].usage_metadata!.output_tokens).toBe(7);
      expect(chunksWithUsage[2].usage_metadata!.total_tokens).toBe(7);
    });

    test("concatenated stream chunks have correct (non-inflated) usage_metadata", async () => {
      const llm = newChatGoogle({
        model: "gemini-2.5-flash",
        responseFile: "gemini-stream-001.txt",
        streaming: true,
      });

      let res: AIMessageChunk | null = null;
      for await (const chunk of await llm.stream("Why is the sky blue?")) {
        if (!res) {
          res = chunk;
        } else {
          res = res.concat(chunk);
        }
      }

      expect(res).toBeDefined();
      expect(res!.usage_metadata).toBeDefined();
      expect(res!.usage_metadata!.input_tokens).toBe(10);
      expect(res!.usage_metadata!.output_tokens).toBe(12);
      expect(res!.usage_metadata!.total_tokens).toBe(22);
    });

    test("streamUsage false excludes usage_metadata from all chunks", async () => {
      const llm = newChatGoogle({
        model: "gemini-2.5-flash",
        responseFile: "gemini-stream-001.txt",
        streaming: true,
        streamUsage: false,
      });

      let res: AIMessageChunk | null = null;
      for await (const chunk of await llm.stream("Why is the sky blue?")) {
        if (!res) {
          res = chunk;
        } else {
          res = res.concat(chunk);
        }
      }

      expect(res).toBeDefined();
      expect(res!.usage_metadata).toBeUndefined();
    });
  });

  test("handleLLMNewToken is called for non-text streaming chunks", async () => {
    const execCodeChunk = {
      candidates: [
        {
          content: {
            parts: [
              {
                executableCode: {
                  language: "PYTHON",
                  code: "fib = []\na, b = 0, 1\nfor _ in range(10):\n    fib.append(a)\n    a, b = b, a + b\nprint(fib)\n",
                },
              },
            ],
            role: "model",
          },
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 19,
        candidatesTokenCount: 55,
        totalTokenCount: 155,
        promptTokensDetails: [{ modality: "TEXT", tokenCount: 19 }],
        thoughtsTokenCount: 81,
      },
      modelVersion: "gemini-2.5-flash",
    };

    const execResultChunk = {
      candidates: [
        {
          content: {
            parts: [
              {
                codeExecutionResult: {
                  outcome: "OUTCOME_OK",
                  output: "[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\n",
                },
              },
            ],
            role: "model",
          },
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 19,
        candidatesTokenCount: 55,
        totalTokenCount: 155,
        promptTokensDetails: [{ modality: "TEXT", tokenCount: 19 }],
        thoughtsTokenCount: 81,
      },
      modelVersion: "gemini-2.5-flash",
    };

    const textChunk = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "The first 10 Fibonacci numbers are: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34.",
              },
            ],
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 19,
        candidatesTokenCount: 97,
        totalTokenCount: 390,
        promptTokensDetails: [{ modality: "TEXT", tokenCount: 19 }],
        thoughtsTokenCount: 81,
      },
      modelVersion: "gemini-2.5-flash",
    };

    const apiClient = new MockStreamingApiClient([
      execCodeChunk,
      execResultChunk,
      textChunk,
    ]);

    const newTokenCalls: { text: string; chunk: unknown }[] = [];

    const llm = new ChatGoogle({
      model: "gemini-2.5-flash",
      streaming: true,
      apiClient,
      callbacks: [
        {
          handleLLMNewToken(
            token: string,
            _idx: unknown,
            _runId: unknown,
            _parentRunId: unknown,
            _tags: unknown,
            fields: { chunk?: unknown }
          ) {
            newTokenCalls.push({ text: token, chunk: fields?.chunk });
          },
        },
      ],
    });

    await llm.invoke("Calculate fibonacci numbers");

    expect(newTokenCalls.length).toBe(3);

    const nonTextCalls = newTokenCalls.filter((c) => c.text === "");
    expect(nonTextCalls).toHaveLength(2);
    expect(nonTextCalls[0]?.chunk).toBeDefined();
    expect(nonTextCalls[1]?.chunk).toBeDefined();

    const textCall = newTokenCalls.find((c) => c.text.includes("Fibonacci"));
    expect(textCall).toBeDefined();
  });

  test("handleLLMNewToken is called for inlineData streaming chunks", async () => {
    const execCodeChunk = {
      candidates: [
        {
          content: {
            parts: [
              {
                executableCode: {
                  language: "PYTHON",
                  code: "import matplotlib.pyplot as plt\nx = range(-10, 11)\ny = [i**2 for i in x]\nplt.plot(x, y)\nplt.savefig('plot.png')\nprint('done')\n",
                },
              },
            ],
            role: "model",
          },
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 22,
        candidatesTokenCount: 206,
        totalTokenCount: 443,
      },
      modelVersion: "gemini-2.5-flash",
    };

    const resultWithImageChunk = {
      candidates: [
        {
          content: {
            parts: [
              {
                codeExecutionResult: {
                  outcome: "OUTCOME_OK",
                  output: "done\n",
                },
              },
              {
                inlineData: {
                  mimeType: "image/png",
                  data: "iVBORw0KGgoAAAANSUhEUg==", // truncated base64
                },
              },
            ],
            role: "model",
          },
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 22,
        candidatesTokenCount: 206,
        totalTokenCount: 443,
      },
      modelVersion: "gemini-2.5-flash",
    };

    const textChunk = {
      candidates: [
        {
          content: {
            parts: [{ text: "Here is the plot of y = x^2." }],
            role: "model",
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 22,
        candidatesTokenCount: 220,
        totalTokenCount: 500,
      },
      modelVersion: "gemini-2.5-flash",
    };

    const apiClient = new MockStreamingApiClient([
      execCodeChunk,
      resultWithImageChunk,
      textChunk,
    ]);

    const newTokenCalls: { text: string; chunk: unknown }[] = [];

    const llm = new ChatGoogle({
      model: "gemini-2.5-flash",
      streaming: true,
      apiClient,
      callbacks: [
        {
          handleLLMNewToken(
            token: string,
            _idx: unknown,
            _runId: unknown,
            _parentRunId: unknown,
            _tags: unknown,
            fields: { chunk?: unknown }
          ) {
            newTokenCalls.push({ text: token, chunk: fields?.chunk });
          },
        },
      ],
    });

    await llm.invoke("Plot y=x^2");

    expect(newTokenCalls.length).toBe(3);

    const nonTextCalls = newTokenCalls.filter((c) => c.text === "");
    expect(nonTextCalls).toHaveLength(2);
    expect(nonTextCalls[0]?.chunk).toBeDefined();
    expect(nonTextCalls[1]?.chunk).toBeDefined();

    const textCall = newTokenCalls.find((c) => c.text.includes("plot"));
    expect(textCall).toBeDefined();
  });
});
