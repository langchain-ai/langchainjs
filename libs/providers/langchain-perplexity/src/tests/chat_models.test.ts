import { vi, test, expect, describe, beforeEach } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatPerplexity } from "../chat_models.js";

describe("ChatPerplexity", () => {
  describe("constructor", () => {
    test("creates instance with required fields", () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });
      expect(model.model).toBe("sonar");
      expect(model._llmType()).toBe("perplexity");
    });

    test("throws error when no API key is provided", () => {
      expect(
        () =>
          new ChatPerplexity({
            model: "sonar",
          })
      ).toThrow("Perplexity API key not found");
    });

    test("sets optional parameters correctly", () => {
      const model = new ChatPerplexity({
        model: "sonar-pro",
        apiKey: "test-key",
        temperature: 0.5,
        maxTokens: 1024,
        topP: 0.9,
        topK: 50,
        presencePenalty: 0.5,
        frequencyPenalty: 0.3,
        streaming: true,
        timeout: 30000,
        returnImages: true,
        returnRelatedQuestions: true,
        searchRecencyFilter: "week",
        searchDomainFilter: ["example.com"],
        searchMode: "academic",
        reasoningEffort: "high",
        searchAfterDateFilter: "2024-01-01",
        searchBeforeDateFilter: "2024-12-31",
        disableSearch: false,
        enableSearchClassifier: true,
        webSearchOptions: {
          search_context_size: "high",
          user_location: {
            latitude: 37.7749,
            longitude: -122.4194,
            country: "US",
          },
        },
      });

      expect(model.temperature).toBe(0.5);
      expect(model.maxTokens).toBe(1024);
      expect(model.topP).toBe(0.9);
      expect(model.topK).toBe(50);
      expect(model.presencePenalty).toBe(0.5);
      expect(model.frequencyPenalty).toBe(0.3);
      expect(model.streaming).toBe(true);
      expect(model.timeout).toBe(30000);
      expect(model.returnImages).toBe(true);
      expect(model.returnRelatedQuestions).toBe(true);
      expect(model.searchRecencyFilter).toBe("week");
      expect(model.searchDomainFilter).toEqual(["example.com"]);
      expect(model.searchMode).toBe("academic");
      expect(model.reasoningEffort).toBe("high");
      expect(model.searchAfterDateFilter).toBe("2024-01-01");
      expect(model.searchBeforeDateFilter).toBe("2024-12-31");
      expect(model.disableSearch).toBe(false);
      expect(model.enableSearchClassifier).toBe(true);
      expect(model.webSearchOptions).toEqual({
        search_context_size: "high",
        user_location: {
          latitude: 37.7749,
          longitude: -122.4194,
          country: "US",
        },
      });
    });

    test("lc_name returns ChatPerplexity", () => {
      expect(ChatPerplexity.lc_name()).toBe("ChatPerplexity");
    });
  });

  describe("invocationParams", () => {
    test("returns correct params with defaults", () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });
      const params = model.invocationParams();
      expect(params.model).toBe("sonar");
      expect(params.temperature).toBeUndefined();
      expect(params.max_tokens).toBeUndefined();
      expect(params.stream).toBeUndefined();
    });

    test("returns correct params with all options set", () => {
      const model = new ChatPerplexity({
        model: "sonar-pro",
        apiKey: "test-key",
        temperature: 0.7,
        maxTokens: 2048,
        streaming: true,
        topP: 0.95,
        topK: 40,
        presencePenalty: 1.0,
        frequencyPenalty: 0.5,
        searchDomainFilter: ["wikipedia.org"],
        searchRecencyFilter: "day",
        returnImages: true,
        returnRelatedQuestions: true,
        searchMode: "web",
        reasoningEffort: "medium",
        searchAfterDateFilter: "2024-06-01",
        searchBeforeDateFilter: "2024-12-31",
        disableSearch: false,
        enableSearchClassifier: true,
        webSearchOptions: { search_context_size: "medium" },
      });
      const params = model.invocationParams();

      expect(params.model).toBe("sonar-pro");
      expect(params.temperature).toBe(0.7);
      expect(params.max_tokens).toBe(2048);
      expect(params.stream).toBe(true);
      expect(params.top_p).toBe(0.95);
      expect(params.top_k).toBe(40);
      expect(params.presence_penalty).toBe(1.0);
      expect(params.frequency_penalty).toBe(0.5);
      expect(params.search_domain_filter).toEqual(["wikipedia.org"]);
      expect(params.search_recency_filter).toBe("day");
      expect(params.return_images).toBe(true);
      expect(params.return_related_questions).toBe(true);
      expect(params.search_mode).toBe("web");
      expect(params.reasoning_effort).toBe("medium");
      expect(params.search_after_date_filter).toBe("2024-06-01");
      expect(params.search_before_date_filter).toBe("2024-12-31");
      expect(params.disable_search).toBe(false);
      expect(params.enable_search_classifier).toBe(true);
      expect(params.web_search_options).toEqual({
        search_context_size: "medium",
      });
    });

    test("passes response_format from call options", () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });
      const responseFormat = {
        type: "json_schema" as const,
        json_schema: {
          name: "test",
          description: "test schema",
          schema: { type: "object" },
        },
      };
      const params = model.invocationParams({ response_format: responseFormat });
      expect(params.response_format).toEqual(responseFormat);
    });
  });

  describe("_generate (non-streaming)", () => {
    test("invokes the API and returns a ChatResult", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const mockResponse = {
        choices: [
          {
            message: {
              role: "assistant",
              content: "The capital of India is New Delhi.",
            },
          },
        ],
        citations: ["https://example.com/india"],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any).client.chat.completions,
        "create"
      ).mockResolvedValue(mockResponse);

      const result = await model._generate(
        [new HumanMessage("What is the capital of India?")],
        {}
      );

      expect(result.generations).toHaveLength(1);
      expect(result.generations[0].text).toBe(
        "The capital of India is New Delhi."
      );
      expect(result.generations[0].message.content).toBe(
        "The capital of India is New Delhi."
      );
      expect(result.generations[0].message.additional_kwargs.citations).toEqual(
        ["https://example.com/india"]
      );
      expect(result.llmOutput?.tokenUsage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    test("handles empty content in response", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const mockResponse = {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
            },
          },
        ],
        citations: [],
      };

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any).client.chat.completions,
        "create"
      ).mockResolvedValue(mockResponse);

      const result = await model._generate([new HumanMessage("Hello")], {});

      expect(result.generations[0].text).toBe("");
      expect(result.generations[0].message.content).toBe("");
    });

    test("sends correct messages to the API", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const createSpy = vi
        .spyOn(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (model as any).client.chat.completions,
          "create"
        )
        .mockResolvedValue({
          choices: [{ message: { role: "assistant", content: "Hi" } }],
          citations: [],
        });

      const messages = [
        new SystemMessage("You are helpful."),
        new HumanMessage("Hello!"),
      ];

      await model._generate(messages, {});

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "system", content: "You are helpful." },
            { role: "user", content: "Hello!" },
          ],
          stream: false,
        })
      );
    });

    test("throws on unknown message type", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const { ToolMessage } = await import("@langchain/core/messages");
      const toolMsg = new ToolMessage({
        content: "tool result",
        tool_call_id: "123",
      });

      await expect(model._generate([toolMsg], {})).rejects.toThrow(
        /Unknown message type/
      );
    });
  });

  describe("_generate (streaming aggregation)", () => {
    test("aggregates streaming chunks into a single generation", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
        streaming: true,
      });

      const chunks = [
        {
          choices: [
            {
              delta: { role: "assistant", content: "Hello" },
              finish_reason: null,
            },
          ],
          citations: ["https://example.com"],
        },
        {
          choices: [
            { delta: { content: " world" }, finish_reason: null },
          ],
          citations: [],
        },
        {
          choices: [
            { delta: { content: "!" }, finish_reason: "stop" },
          ],
          citations: [],
        },
      ];

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any).client.chat.completions,
        "create"
      ).mockResolvedValue(mockStream());

      const result = await model._generate(
        [new HumanMessage("Hi")],
        {}
      );

      expect(result.generations).toHaveLength(1);
      expect(result.generations[0].text).toBe("Hello world!");
    });
  });

  describe("_streamResponseChunks", () => {
    test("yields individual chunks", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const chunks = [
        {
          choices: [
            {
              delta: { role: "assistant", content: "The " },
              finish_reason: null,
            },
          ],
          citations: ["https://example.com"],
        },
        {
          choices: [
            { delta: { content: "answer" }, finish_reason: null },
          ],
          citations: [],
        },
        {
          choices: [
            { delta: { content: "." }, finish_reason: "stop" },
          ],
          citations: [],
        },
      ];

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any).client.chat.completions,
        "create"
      ).mockResolvedValue(mockStream());

      const result: unknown[] = [];
      for await (const chunk of model._streamResponseChunks(
        [new HumanMessage("Question")],
        {}
      )) {
        result.push(chunk);
      }

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("text", "The ");
      expect(result[1]).toHaveProperty("text", "answer");
      expect(result[2]).toHaveProperty("text", ".");
    });

    test("sets citations on the first chunk only", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const chunks = [
        {
          choices: [
            {
              delta: { role: "assistant", content: "First" },
              finish_reason: null,
            },
          ],
          citations: ["https://cite1.com", "https://cite2.com"],
        },
        {
          choices: [
            { delta: { content: " Second" }, finish_reason: "stop" },
          ],
          citations: ["https://cite1.com", "https://cite2.com"],
        },
      ];

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any).client.chat.completions,
        "create"
      ).mockResolvedValue(mockStream());

      const result = [];
      for await (const chunk of model._streamResponseChunks(
        [new HumanMessage("Hi")],
        {}
      )) {
        result.push(chunk);
      }

      expect(result[0].message.additional_kwargs.citations).toEqual([
        "https://cite1.com",
        "https://cite2.com",
      ]);
      expect(
        result[1].message.additional_kwargs.citations
      ).toBeUndefined();
    });

    test("skips chunks without content", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const chunks = [
        {
          choices: [
            {
              delta: { role: "assistant", content: null },
              finish_reason: null,
            },
          ],
          citations: [],
        },
        {
          choices: [
            { delta: { content: "Data" }, finish_reason: "stop" },
          ],
          citations: [],
        },
      ];

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any).client.chat.completions,
        "create"
      ).mockResolvedValue(mockStream());

      const result = [];
      for await (const chunk of model._streamResponseChunks(
        [new HumanMessage("Hi")],
        {}
      )) {
        result.push(chunk);
      }

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Data");
    });

    test("handles different message roles in stream", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const chunks = [
        {
          choices: [
            {
              delta: { role: "user", content: "User chunk" },
              finish_reason: null,
            },
          ],
          citations: [],
        },
        {
          choices: [
            {
              delta: { role: "system", content: "System chunk" },
              finish_reason: null,
            },
          ],
          citations: [],
        },
        {
          choices: [
            {
              delta: { role: undefined, content: "Default chunk" },
              finish_reason: "stop",
            },
          ],
          citations: [],
        },
      ];

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any).client.chat.completions,
        "create"
      ).mockResolvedValue(mockStream());

      const result = [];
      for await (const chunk of model._streamResponseChunks(
        [new HumanMessage("Hi")],
        {}
      )) {
        result.push(chunk);
      }

      expect(result).toHaveLength(3);
      expect(result[0].text).toBe("User chunk");
      expect(result[1].text).toBe("System chunk");
      expect(result[2].text).toBe("Default chunk");
    });

    test("calls runManager.handleLLMNewToken for each chunk", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const chunks = [
        {
          choices: [
            {
              delta: { role: "assistant", content: "chunk1" },
              finish_reason: null,
            },
          ],
          citations: [],
        },
        {
          choices: [
            { delta: { content: "chunk2" }, finish_reason: "stop" },
          ],
          citations: [],
        },
      ];

      async function* mockStream() {
        for (const chunk of chunks) {
          yield chunk;
        }
      }

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any).client.chat.completions,
        "create"
      ).mockResolvedValue(mockStream());

      const mockRunManager = {
        handleLLMNewToken: vi.fn(),
      };

      const result = [];
      for await (const chunk of model._streamResponseChunks(
        [new HumanMessage("Hi")],
        {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockRunManager as any
      )) {
        result.push(chunk);
      }

      expect(mockRunManager.handleLLMNewToken).toHaveBeenCalledTimes(2);
      expect(mockRunManager.handleLLMNewToken).toHaveBeenCalledWith("chunk1");
      expect(mockRunManager.handleLLMNewToken).toHaveBeenCalledWith("chunk2");
    });
  });

  describe("withStructuredOutput", () => {
    test("throws error when strict mode is enabled", () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      expect(() =>
        model.withStructuredOutput(
          { type: "object", properties: {} },
          { strict: true }
        )
      ).toThrow(`"strict" mode is not supported for this model.`);
    });

    test("throws error for non-jsonSchema method", () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      expect(() =>
        model.withStructuredOutput(
          { type: "object", properties: {} },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { method: "functionCalling" as any }
        )
      ).toThrow(
        `Perplexity only supports "jsonSchema" as a structured output method.`
      );
    });

    test("creates a runnable with JSON schema", () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const structured = model.withStructuredOutput({
        type: "object",
        properties: {
          answer: { type: "string" },
        },
      });

      expect(structured).toBeDefined();
    });

    test("creates a runnable with includeRaw", () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const structured = model.withStructuredOutput(
        {
          type: "object",
          properties: { answer: { type: "string" } },
        },
        { includeRaw: true }
      );

      expect(structured).toBeDefined();
    });

    test("uses reasoning parsers for reasoning models", () => {
      const model = new ChatPerplexity({
        model: "sonar-reasoning",
        apiKey: "test-key",
      });

      const structured = model.withStructuredOutput({
        type: "object",
        properties: { answer: { type: "string" } },
      });

      expect(structured).toBeDefined();
    });

    test("uses custom name when provided", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const mockResponse = new AIMessage({
        content: '{"capital": "New Delhi"}',
      });

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any),
        "invoke"
      ).mockResolvedValue(mockResponse);

      const structured = model.withStructuredOutput(
        {
          type: "object",
          properties: { capital: { type: "string" } },
        },
        { name: "geography_response" }
      );

      const result = await structured.invoke("What is the capital of India?");
      expect(result).toEqual({ capital: "New Delhi" });
    });

    test("parses JSON output correctly", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const mockResponse = new AIMessage({
        content: '{"answer": "42", "confidence": 0.99}',
      });

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any),
        "invoke"
      ).mockResolvedValue(mockResponse);

      const structured = model.withStructuredOutput({
        type: "object",
        properties: {
          answer: { type: "string" },
          confidence: { type: "number" },
        },
      });

      const result = await structured.invoke("What is the answer?");
      expect(result).toEqual({ answer: "42", confidence: 0.99 });
    });

    test("includeRaw returns both raw and parsed", async () => {
      const model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });

      const mockResponse = new AIMessage({
        content: '{"answer": "42"}',
      });

      vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (model as any),
        "invoke"
      ).mockResolvedValue(mockResponse);

      const structured = model.withStructuredOutput(
        {
          type: "object",
          properties: { answer: { type: "string" } },
        },
        { includeRaw: true }
      );

      const result = await structured.invoke("Question");
      expect(result).toHaveProperty("raw");
      expect(result).toHaveProperty("parsed");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).parsed).toEqual({ answer: "42" });
    });
  });

  describe("message conversion", () => {
    let model: ChatPerplexity;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let createSpy: any;

    beforeEach(() => {
      model = new ChatPerplexity({
        model: "sonar",
        apiKey: "test-key",
      });
      createSpy = vi
        .spyOn(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (model as any).client.chat.completions,
          "create"
        )
        .mockResolvedValue({
          choices: [{ message: { role: "assistant", content: "ok" } }],
          citations: [],
        });
    });

    test("converts HumanMessage to user role", async () => {
      await model._generate([new HumanMessage("Hello")], {});
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "Hello" }],
        })
      );
    });

    test("converts AIMessage to assistant role", async () => {
      await model._generate(
        [new AIMessage("I am an AI")],
        {}
      );
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "assistant", content: "I am an AI" }],
        })
      );
    });

    test("converts SystemMessage to system role", async () => {
      await model._generate(
        [new SystemMessage("Be helpful")],
        {}
      );
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "system", content: "Be helpful" }],
        })
      );
    });

    test("handles multi-turn conversation", async () => {
      await model._generate(
        [
          new SystemMessage("You are helpful."),
          new HumanMessage("Hi"),
          new AIMessage("Hello!"),
          new HumanMessage("How are you?"),
        ],
        {}
      );
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: "system", content: "You are helpful." },
            { role: "user", content: "Hi" },
            { role: "assistant", content: "Hello!" },
            { role: "user", content: "How are you?" },
          ],
        })
      );
    });
  });
});
