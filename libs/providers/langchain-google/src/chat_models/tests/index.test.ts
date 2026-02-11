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

class MockApiClient extends ApiClient {
  request: Request;

  response: Response;

  filePath: string;

  constructor(fileName: string) {
    super();
    this.filePath = `src/chat_models/tests/data/mock/${fileName}`;
  }

  async fetch(request: Request): Promise<Response> {
    this.request = request;
    this.response = new MockResponse({
      filePath: this.filePath,
      url: request.url,
    });
    return this.response;
  }

  hasApiKey(): boolean {
    return false;
  }
}

type MockChatGoogleParams = ChatGoogleParams & { responseFile: string };

describe("Google Mock", () => {
  let recorder: GoogleRequestRecorder;
  let callbacks: BaseCallbackHandler[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let warnSpy: MockInstance<any>;

  function newChatGoogle(mockFields: MockChatGoogleParams): ChatGoogle {
    const { model, responseFile, ...fields } = mockFields;
    recorder = new GoogleRequestRecorder();
    callbacks = [
      recorder,
      // new GoogleRequestLogger(),
    ];

    const apiClient = new MockApiClient(responseFile);

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
});
