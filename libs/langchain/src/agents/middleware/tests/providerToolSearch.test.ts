import { z } from "zod/v3";
import {
  expect,
  describe,
  it,
  vi,
  beforeEach,
  type MockInstance,
} from "vitest";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { providerToolSearchMiddleware } from "../providerToolSearch.js";
import { createAgent } from "../../index.js";

const ANTHROPIC_SEARCH_TOOL_TYPE = "tool_search_tool_bm25_20251119";
const OPENAI_SEARCH_TOOL_TYPE = "tool_search";

type BoundTool = {
  name?: string;
  type?: string;
  extras?: { defer_loading?: boolean };
};

function createMockModel(name = "ChatAnthropic", modelType = "anthropic") {
  const mockModel = {
    getName: () => name,
    bindTools: vi.fn().mockReturnThis(),
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: vi.fn().mockResolvedValue(new AIMessage("Response from model")),
    lc_runnable: true,
    _modelType: modelType,
    _generate: vi.fn(),
    _llmType: () => modelType,
  } as unknown as BaseChatModel;
  mockModel.withStructuredOutput = vi.fn().mockReturnValue(mockModel);

  return mockModel;
}

/** The tool list bound to the model on the first model call. */
function boundToolsOf(model: BaseChatModel): BoundTool[] {
  return (model.bindTools as unknown as MockInstance).mock
    .calls[0][0] as BoundTool[];
}

const hasSearchTool = (boundTools: BoundTool[]) =>
  boundTools.some(
    (t) =>
      t.type === ANTHROPIC_SEARCH_TOOL_TYPE ||
      t.type === OPENAI_SEARCH_TOOL_TYPE
  );

const getWeather = tool(async () => "sunny", {
  name: "get_weather",
  description: "Get the weather for a city",
  schema: z.object({ city: z.string() }),
});

const sendEmail = tool(async () => "sent", {
  name: "send_email",
  description: "Send an email",
  schema: z.object({ to: z.string() }),
});

describe("providerToolSearchMiddleware", () => {
  let mockModel: BaseChatModel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockModel = createMockModel();
  });

  it("passes the request through unchanged when no tools are deferred", async () => {
    const agent = createAgent({
      model: mockModel,
      tools: [getWeather, sendEmail],
      middleware: [providerToolSearchMiddleware()],
    });

    await agent.invoke({ messages: [new HumanMessage("hi")] });

    const boundTools = boundToolsOf(mockModel);
    expect(hasSearchTool(boundTools)).toBe(false);
  });

  it("defers tools named in searchableTools", async () => {
    const agent = createAgent({
      model: mockModel,
      tools: [sendEmail],
      middleware: [
        providerToolSearchMiddleware({ searchableTools: ["send_email"] }),
      ],
    });

    await agent.invoke({ messages: [new HumanMessage("hi")] });

    const boundTools = boundToolsOf(mockModel);
    const emailTool = boundTools.find((t) => t.name === "send_email");
    expect(emailTool?.extras?.defer_loading).toBe(true);
  });

  it("appends the native search tool when a tool is deferred", async () => {
    const agent = createAgent({
      model: mockModel,
      tools: [sendEmail],
      middleware: [
        providerToolSearchMiddleware({ searchableTools: ["send_email"] }),
      ],
    });

    await agent.invoke({ messages: [new HumanMessage("hi")] });

    const boundTools = boundToolsOf(mockModel);
    const containsSearchTool = boundTools.some(
      (t) => t.type === ANTHROPIC_SEARCH_TOOL_TYPE
    );
    expect(containsSearchTool).toBe(true);
  });

  it("accepts tool instances and names in searchableTools", async () => {
    const agent = createAgent({
      model: mockModel,
      tools: [getWeather, sendEmail],
      middleware: [
        providerToolSearchMiddleware({
          searchableTools: ["get_weather", sendEmail],
        }),
      ],
    });

    await agent.invoke({ messages: [new HumanMessage("hi")] });

    const boundTools = boundToolsOf(mockModel);
    const sendEmailTool = boundTools.find((t) => t.name === "send_email");
    const getWeatherTool = boundTools.find((t) => t.name === "get_weather");

    expect(sendEmailTool?.extras?.defer_loading).toBe(true);
    expect(getWeatherTool?.extras?.defer_loading).toBe(true);
  });

  it("honors tools pre-marked with extras.defer_loading", async () => {
    const preMarked = tool(async () => "ok", {
      name: "deferred_tool",
      description: "A tool deferred at construction time",
      schema: z.object({}),
      extras: { defer_loading: true },
    });

    const agent = createAgent({
      model: mockModel,
      tools: [getWeather, preMarked],
      middleware: [providerToolSearchMiddleware()],
    });

    await agent.invoke({ messages: [new HumanMessage("hi")] });

    const boundTools = boundToolsOf(mockModel);
    const deferredTool = boundTools.find((t) => t.name === "deferred_tool");

    expect(deferredTool?.extras?.defer_loading).toBe(true);
    expect(hasSearchTool(boundTools)).toBe(true);
  });

  it("throws when a tool is deferred but the provider has no server-side tool search", async () => {
    const mistralModel = createMockModel("ChatMistralAI", "mistralai");
    const agent = createAgent({
      model: mistralModel,
      tools: [getWeather, sendEmail],
      middleware: [
        providerToolSearchMiddleware({ searchableTools: ["send_email"] }),
      ],
    });

    await expect(
      agent.invoke({ messages: [new HumanMessage("hi")] })
    ).rejects.toThrow(/requires a provider with server-side tool search/);
  });

  it("throws when searchableTools references a tool that is not present", async () => {
    const agent = createAgent({
      model: mockModel,
      tools: [getWeather],
      middleware: [
        providerToolSearchMiddleware({ searchableTools: ["does_not_exist"] }),
      ],
    });

    await expect(
      agent.invoke({ messages: [new HumanMessage("hi")] })
    ).rejects.toThrow(
      /searchableTools references tool\(s\) not bound.*does_not_exist/
    );
  });
});
