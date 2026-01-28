/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import {
  openAIModerationMiddleware,
  OpenAIModerationError,
} from "../moderation.js";
import { createAgent } from "../../../../index.js";
import { FakeToolCallingChatModel } from "../../../../tests/utils.js";
import { initChatModel } from "../../../../../chat_models/universal.js";

vi.mock(
  "@langchain/openai",
  () => import("../../../tests/__mocks__/@langchain/openai.js")
);

vi.mock("../../../../../chat_models/universal.js", async () => {
  const actual = await vi.importActual(
    "../../../../../chat_models/universal.js"
  );
  const { ChatOpenAI } = await import(
    "../../../tests/__mocks__/@langchain/openai.js"
  );
  return {
    ...actual,
    initChatModel: vi.fn().mockResolvedValue(new ChatOpenAI()),
  };
});

const flaggedResponse = {
  id: "modr-80",
  model: "omni-moderation-latest",
  results: [
    {
      flagged: true,
      categories: {
        harassment: false,
        "harassment/threatening": false,
        sexual: false,
        hate: false,
        "hate/threatening": false,
        illicit: false,
        "illicit/violent": false,
        "self-harm/intent": true,
        "self-harm/instructions": false,
        "self-harm": true,
        violence: true,
        "violence/graphic": false,
        "sexual/minors": false,
      },
      category_scores: {
        harassment: 0.000595613990691901,
        "harassment/threatening": 0.0007731439949613941,
        sexual: 0.00006166297347617125,
        hate: 0.000014202364022997911,
        "hate/threatening": 0.000007843789122138342,
        illicit: 0.0038094050391387574,
        "illicit/violent": 0.00002868540823874629,
        "self-harm/intent": 0.998813087895366,
        "self-harm/instructions": 0.00029282492544709094,
        "self-harm": 0.9765081883024809,
        "sexual/minors": 0.000005144221374220898,
        violence: 0.4272401150888747,
        "violence/graphic": 0.00006667023092435894,
      },
      category_applied_input_types: {
        harassment: ["text"],
        "harassment/threatening": ["text"],
        sexual: ["text"],
        hate: ["text"],
        "hate/threatening": ["text"],
        illicit: ["text"],
        "illicit/violent": ["text"],
        "self-harm/intent": ["text"],
        "self-harm/instructions": ["text"],
        "self-harm": ["text"],
        "sexual/minors": ["text"],
        violence: ["text"],
        "violence/graphic": ["text"],
      } as any,
    },
  ],
};

describe("openAIModerationMiddleware", () => {
  let mockModel: ChatOpenAI;

  beforeEach(() => {
    mockModel = new ChatOpenAI();
  });

  describe("Initialization", () => {
    it("should create middleware with correct name", () => {
      const middleware = openAIModerationMiddleware({
        model: mockModel,
      });
      expect(middleware.name).toBe("OpenAIModerationMiddleware");
    });

    it("should throw error if model is not OpenAI", async () => {
      const nonOpenAIModel = {
        getName: () => "SomeOtherModel",
      } as any;

      const middleware = openAIModerationMiddleware({
        model: nonOpenAIModel,
        checkInput: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [new HumanMessage("I want to harm myself")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      await expect(beforeModelHook?.(state as any, {} as any)).rejects.toThrow(
        "Model must be an OpenAI model"
      );
    });

    it("should throw error if model does not support moderation", async () => {
      const modelWithoutModeration = {
        getName: () => "ChatOpenAI",
      } as any;

      const middleware = openAIModerationMiddleware({
        model: modelWithoutModeration,
        checkInput: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [new HumanMessage("I want to harm myself")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;

      await expect(beforeModelHook?.(state as any, {} as any)).rejects.toThrow(
        "Model must support moderation"
      );
    });
  });

  describe("Input Moderation", () => {
    it("should moderate user input when checkInput is true", async () => {
      const moderateContentMock = vi
        .spyOn(mockModel.client.moderations, "create")
        .mockResolvedValue(flaggedResponse);
      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [new HumanMessage("I want to harm myself")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(moderateContentMock).toHaveBeenCalledWith(
        { input: "I want to harm myself", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      expect(result).toEqual({
        jumpTo: "end",
        messages: [
          expect.objectContaining({
            content: expect.stringContaining("self-harm"),
          }),
        ],
      });
    });

    it("should not moderate input when checkInput is false", async () => {
      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: false,
      });

      const state = {
        messages: [new HumanMessage("Some input")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should pass through when input is not flagged", async () => {
      const notFlaggedResponse = {
        id: "modr-81",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(notFlaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
      });

      const state = {
        messages: [new HumanMessage("Hello, how are you?")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe("Output Moderation", () => {
    it("should moderate AI output when checkOutput is true", async () => {
      const flaggedResponse = {
        id: "modr-82",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: {
              violence: true,
            },
            category_scores: {
              violence: 0.8,
            },
            category_applied_input_types: {
              violence: ["text"],
            },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkOutput: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [
          new HumanMessage("Tell me about violence"),
          new AIMessage("Here's some violent content"),
        ],
      };

      const afterModelHook =
        typeof middleware.afterModel === "object" &&
        "hook" in middleware.afterModel
          ? middleware.afterModel.hook
          : middleware.afterModel;
      const result = await afterModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).toHaveBeenCalledWith(
        {
          input: "Here's some violent content",
          model: "omni-moderation-latest",
        },
        expect.any(Object)
      );
      expect(result).toEqual({
        jumpTo: "end",
        messages: [
          expect.objectContaining({
            content: expect.stringContaining("violence"),
          }),
        ],
      });
    });

    it("should not moderate output when checkOutput is false", async () => {
      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkOutput: false,
      });

      const state = {
        messages: [new AIMessage("Some output")],
      };

      const afterModelHook =
        typeof middleware.afterModel === "object" &&
        "hook" in middleware.afterModel
          ? middleware.afterModel.hook
          : middleware.afterModel;
      const result = await afterModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe("Tool Result Moderation", () => {
    it("should moderate tool results when checkToolResults is true", async () => {
      const flaggedResponse = {
        id: "modr-83",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: {
              hate: true,
            },
            category_scores: {
              hate: 0.9,
            },
            category_applied_input_types: {
              hate: ["text"],
            },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkToolResults: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [
          new HumanMessage("Search for something"),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: {} }],
          }),
          new ToolMessage({
            content: "Hateful tool result",
            tool_call_id: "1",
            name: "search",
          }),
        ],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).toHaveBeenCalledWith(
        { input: "Hateful tool result", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      expect(result).toEqual({
        jumpTo: "end",
        messages: [
          expect.objectContaining({
            content: expect.stringContaining("hate"),
          }),
        ],
      });
    });

    it("should not moderate tool results when checkToolResults is false", async () => {
      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkToolResults: false,
      });

      const state = {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "tool", args: {} }],
          }),
          new ToolMessage({ content: "Tool result", tool_call_id: "1" }),
        ],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe("Exit Behaviors", () => {
    it("should throw error when exitBehavior is 'error'", async () => {
      const flaggedResponse = {
        id: "modr-84",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { violence: true },
            category_scores: { violence: 0.8 },
            category_applied_input_types: { violence: ["text"] },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        exitBehavior: "error",
      });

      const state = {
        messages: [new HumanMessage("Violent content")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      await expect(beforeModelHook?.(state as any, {} as any)).rejects.toThrow(
        OpenAIModerationError
      );
    });

    it("should end execution when exitBehavior is 'end'", async () => {
      const flaggedResponse = {
        id: "modr-85",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { hate: true },
            category_scores: { hate: 0.9 },
            category_applied_input_types: { hate: ["text"] },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [new HumanMessage("Hateful content")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(result).toHaveProperty("jumpTo", "end");
      expect(result).toHaveProperty("messages");
      expect((result as any).messages[0]).toBeInstanceOf(AIMessage);
    });

    it("should replace content when exitBehavior is 'replace'", async () => {
      const flaggedResponse = {
        id: "modr-86",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { inappropriate: true },
            category_scores: { inappropriate: 0.7 },
            category_applied_input_types: { inappropriate: ["text"] },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        exitBehavior: "replace",
      });

      const state = {
        messages: [new HumanMessage("Inappropriate content")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(result).toHaveProperty("messages");
      const messages = (result as any).messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toContain("inappropriate");
      expect(messages[0].content).not.toContain("Inappropriate content");
    });
  });

  describe("Violation Message Formatting", () => {
    it("should format violation message with categories", async () => {
      const flaggedResponse = {
        id: "modr-87",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: {
              "self-harm": true,
              violence: true,
            },
            category_scores: {
              "self-harm": 0.9,
              violence: 0.8,
            },
            category_applied_input_types: {
              "self-harm": ["text"],
              violence: ["text"],
            },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [new HumanMessage("Harmful content")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      const message = (result as any).messages[0];
      expect(message.content).toBe(
        "I'm sorry, but I can't comply with that request. It was flagged for self-harm, violence."
      );
    });

    it("should use custom violation message template", async () => {
      const flaggedResponse = {
        id: "modr-88",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { hate: true },
            category_scores: { hate: 0.9 },
            category_applied_input_types: { hate: ["text"] },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        exitBehavior: "end",
        violationMessage: "Custom: {categories}",
      });

      const state = {
        messages: [new HumanMessage("Hateful content")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      const message = (result as any).messages[0];
      expect(message.content).toBe("Custom: hate");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty messages array", async () => {
      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
      });

      const state = {
        messages: [],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should handle messages without text content", async () => {
      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
      });

      const state = {
        messages: [
          new HumanMessage({
            content: [],
          }),
        ],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should handle multiple tool results", async () => {
      (mockModel.client.moderations.create as unknown as MockInstance)
        .mockResolvedValueOnce({
          id: "modr-89",
          model: "omni-moderation-latest",
          results: [
            {
              flagged: false,
              categories: {},
              category_scores: {},
              category_applied_input_types: {},
            },
          ],
        })
        .mockResolvedValueOnce({
          id: "modr-90",
          model: "omni-moderation-latest",
          results: [
            {
              flagged: true,
              categories: { violence: true },
              category_scores: { violence: 0.8 },
              category_applied_input_types: { violence: ["text"] },
            },
          ],
        });

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkToolResults: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "tool1", args: {} },
              { id: "2", name: "tool2", args: {} },
            ],
          }),
          new ToolMessage({ content: "Safe result", tool_call_id: "1" }),
          new ToolMessage({ content: "Violent result", tool_call_id: "2" }),
        ],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result: any = await beforeModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).toHaveBeenCalledWith(
        { input: "Safe result", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      expect(mockModel.client.moderations.create).toHaveBeenCalledWith(
        { input: "Violent result", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      expect(result).toHaveProperty("jumpTo", "end");
      expect(result).toHaveProperty("messages");
      expect(result.messages[0]).toBeInstanceOf(AIMessage);
      expect(result.messages[0].content).toContain("violence");
    });

    it("should use custom moderation model", async () => {
      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue({
        id: "modr-90",
        model: "text-moderation-stable",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
        ],
      });

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        moderationModel: "text-moderation-stable",
        checkInput: true,
      });

      const state = {
        messages: [new HumanMessage("Test input")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      await beforeModelHook?.(state as any, {} as any);

      expect(mockModel.client.moderations.create).toHaveBeenCalledWith(
        { input: "Test input", model: "text-moderation-stable" },
        expect.any(Object)
      );
    });
  });

  describe("Integration with createAgent", () => {
    it("should moderate input in agent execution", async () => {
      const flaggedResponse = {
        id: "modr-91",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { violence: true },
            category_scores: { violence: 0.8 },
            category_applied_input_types: { violence: ["text"] },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Response")],
      });

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Violent input")],
      });

      expect(mockModel.client.moderations.create).toHaveBeenCalled();
      expect(result.messages[result.messages.length - 1].content).toContain(
        "violence"
      );
    });

    it("should moderate output in agent execution", async () => {
      const safeInputResponse = {
        id: "modr-92",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
        ],
      };

      const flaggedOutputResponse = {
        id: "modr-93",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { hate: true },
            category_scores: { hate: 0.9 },
            category_applied_input_types: { hate: ["text"] },
          },
        ],
      };

      (mockModel.client.moderations.create as unknown as MockInstance)
        .mockResolvedValueOnce(safeInputResponse)
        .mockResolvedValueOnce(flaggedOutputResponse);

      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Hateful response content")],
      });

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        checkOutput: true,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Tell me something")],
      });

      expect(mockModel.client.moderations.create).toHaveBeenCalledTimes(2);
      // First call is for input moderation
      expect(mockModel.client.moderations.create).toHaveBeenNthCalledWith(
        1,
        { input: "Tell me something", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      // Second call is for output moderation
      expect(mockModel.client.moderations.create).toHaveBeenNthCalledWith(
        2,
        { input: "Hateful response content", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      // Final message should be the violation message
      expect(result.messages[result.messages.length - 1].content).toContain(
        "hate"
      );
    });

    it("should moderate tool results in agent execution", async () => {
      const safeInputResponse = {
        id: "modr-94",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
        ],
      };

      const flaggedToolResponse = {
        id: "modr-95",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { inappropiate: true },
            category_scores: { inappropiate: 0.85 },
            category_applied_input_types: { inappropiate: ["text"] },
          },
        ],
      };

      (mockModel.client.moderations.create as unknown as MockInstance)
        .mockResolvedValueOnce(safeInputResponse)
        .mockResolvedValueOnce(flaggedToolResponse);

      const toolMock = vi.fn().mockResolvedValue("Inappropriate tool result");
      const { tool } = await import("@langchain/core/tools");
      const { z } = await import("zod/v3");

      const testTool = tool(toolMock, {
        name: "test_tool",
        description: "A test tool",
        schema: z.object({ query: z.string() }),
      });

      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "call-1", name: "test_tool", args: { query: "test" } },
            ],
          }),
          new AIMessage("Final response"),
        ],
      });

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        checkToolResults: true,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [testTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use the tool")],
      });

      expect(mockModel.client.moderations.create).toHaveBeenCalledTimes(2);
      // First call is for input moderation
      expect(mockModel.client.moderations.create).toHaveBeenNthCalledWith(
        1,
        { input: "Use the tool", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      // Second call is for tool result moderation
      expect(mockModel.client.moderations.create).toHaveBeenNthCalledWith(
        2,
        { input: "Inappropriate tool result", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      // Final message should be the violation message
      expect(result.messages[result.messages.length - 1].content).toBe(
        "I'm sorry, but I can't comply with that request. It was flagged for inappropiate."
      );
      // Tool should have been called
      expect(toolMock).toHaveBeenCalled();
    });

    it("should moderate input, output, and tool results together", async () => {
      const safeInputResponse = {
        id: "modr-96",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
            category_applied_input_types: {},
          },
        ],
      };

      const flaggedToolResponse = {
        id: "modr-97",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { "self-harm": true },
            category_scores: { "self-harm": 0.95 },
            category_applied_input_types: { "self-harm": ["text"] },
          },
        ],
      };

      (mockModel.client.moderations.create as unknown as MockInstance)
        .mockResolvedValueOnce(safeInputResponse)
        .mockResolvedValueOnce(flaggedToolResponse);

      const toolMock = vi.fn().mockResolvedValue("Self-harm related content");
      const { tool } = await import("@langchain/core/tools");
      const { z } = await import("zod/v3");

      const testTool = tool(toolMock, {
        name: "test_tool",
        description: "A test tool",
        schema: z.object({ query: z.string() }),
      });

      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "call-1", name: "test_tool", args: { query: "test" } },
            ],
          }),
        ],
      });

      const middleware = openAIModerationMiddleware({
        model: mockModel,
        checkInput: true,
        checkOutput: true,
        checkToolResults: true,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [testTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search for something")],
      });

      expect(mockModel.client.moderations.create).toHaveBeenCalledTimes(2);
      // First call is for input moderation
      expect(mockModel.client.moderations.create).toHaveBeenNthCalledWith(
        1,
        { input: "Search for something", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      // Second call is for tool result moderation
      expect(mockModel.client.moderations.create).toHaveBeenNthCalledWith(
        2,
        { input: "Self-harm related content", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      // Final message should be the violation message from tool result moderation
      expect(result.messages[result.messages.length - 1].content).toBe(
        "I'm sorry, but I can't comply with that request. It was flagged for self-harm."
      );
    });
  });

  describe("String Model Support", () => {
    afterEach(() => {
      (initChatModel as unknown as MockInstance).mockClear();
    });

    it("should accept string model name for input moderation", async () => {
      const flaggedResponse = {
        id: "modr-100",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { violence: true },
            category_scores: { violence: 0.8 },
            category_applied_input_types: { violence: ["text"] },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);
      (initChatModel as unknown as MockInstance).mockResolvedValue(mockModel);

      const middleware = openAIModerationMiddleware({
        model: "gpt-4o-mini",
        checkInput: true,
        exitBehavior: "end",
      });

      const state = {
        messages: [new HumanMessage("Violent content")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      const result = await beforeModelHook?.(state as any, {} as any);

      expect(initChatModel).toHaveBeenCalledWith("gpt-4o-mini");
      expect(mockModel.client.moderations.create).toHaveBeenCalledWith(
        { input: "Violent content", model: "omni-moderation-latest" },
        expect.any(Object)
      );
      expect(result).toHaveProperty("jumpTo", "end");
      expect(result).toHaveProperty("messages");
      expect(result?.messages?.[result?.messages?.length - 1]?.content).toBe(
        "I'm sorry, but I can't comply with that request. It was flagged for violence."
      );
    });

    it("should lazily initialize model only when needed", async () => {
      const middleware = openAIModerationMiddleware({
        model: "gpt-4o-mini",
        checkInput: false,
        checkOutput: false,
        checkToolResults: false,
      });

      const state = {
        messages: [new HumanMessage("Some input")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      await beforeModelHook?.(state as any, {} as any);

      // Model should not be initialized if no moderation checks are enabled
      expect(initChatModel).not.toHaveBeenCalled();
    });

    it("should cache initialized model instance", async () => {
      const flaggedResponse = {
        id: "modr-104",
        model: "omni-moderation-latest",
        results: [
          {
            flagged: true,
            categories: { violence: true },
            category_scores: { violence: 0.8 },
            category_applied_input_types: { violence: ["text"] },
          },
        ],
      };

      (
        mockModel.client.moderations.create as unknown as MockInstance
      ).mockResolvedValue(flaggedResponse);

      const middleware = openAIModerationMiddleware({
        model: "gpt-4o-mini",
        checkInput: true,
        checkOutput: true,
        exitBehavior: "end",
      });

      const state1 = {
        messages: [new HumanMessage("Violent input")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;
      await beforeModelHook?.(state1 as any, {} as any);

      const state2 = {
        messages: [
          new HumanMessage("Safe input"),
          new AIMessage("Violent output"),
        ],
      };

      const afterModelHook =
        typeof middleware.afterModel === "object" &&
        "hook" in middleware.afterModel
          ? middleware.afterModel.hook
          : middleware.afterModel;
      await afterModelHook?.(state2 as any, {} as any);

      // initChatModel should only be called once, model should be cached
      expect(initChatModel).toHaveBeenCalledTimes(1);
      expect(initChatModel).toHaveBeenCalledWith("gpt-4o-mini");
    });

    it("should throw error if string model does not resolve to OpenAI model", async () => {
      const nonOpenAIModel = {
        getName: () => "SomeOtherModel",
      } as any;

      (initChatModel as unknown as MockInstance).mockResolvedValue(
        nonOpenAIModel
      );

      const middleware = openAIModerationMiddleware({
        model: "non-openai-model",
        checkInput: true,
      });

      const state = {
        messages: [new HumanMessage("Test input")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;

      await expect(beforeModelHook?.(state as any, {} as any)).rejects.toThrow(
        "Model must be an OpenAI model"
      );
    });

    it("should throw error if string model resolves to model without moderation support", async () => {
      const modelWithoutModeration = {
        getName: () => "ChatOpenAI",
      } as any;

      (initChatModel as unknown as MockInstance).mockResolvedValue(
        modelWithoutModeration
      );

      const middleware = openAIModerationMiddleware({
        model: "gpt-4o-mini",
        checkInput: true,
      });

      const state = {
        messages: [new HumanMessage("Test input")],
      };

      const beforeModelHook =
        typeof middleware.beforeModel === "object" &&
        "hook" in middleware.beforeModel
          ? middleware.beforeModel.hook
          : middleware.beforeModel;

      await expect(beforeModelHook?.(state as any, {} as any)).rejects.toThrow(
        "Model must support moderation"
      );
    });
  });
});
