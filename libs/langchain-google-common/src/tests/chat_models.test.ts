/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, jest } from "@jest/globals";
import {
  AIMessage,
  BaseMessage,
  BaseMessageLike,
  HumanMessage,
  HumanMessageChunk,
  MessageContentComplex,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { InMemoryStore } from "@langchain/core/stores";
import { CallbackHandlerMethods } from "@langchain/core/callbacks/base";
import { Serialized } from "@langchain/core/load/serializable";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatGoogleBase, ChatGoogleBaseInput } from "../chat_models.js";
import {
  authOptions,
  MockClient,
  MockClientAuthInfo,
  MockClientError,
  mockId,
} from "./mock.js";
import {
  AnthropicAPIConfig,
  GeminiTool,
  GoogleAIBaseLLMInput,
  GoogleAISafetyCategory,
  GoogleAISafetyHandler,
  GoogleAISafetyThreshold,
} from "../types.js";
import { GoogleAbstractedClient } from "../auth.js";
import { GoogleAISafetyError } from "../utils/safety.js";
import {
  BackedBlobStore,
  MediaBlob,
  MediaManager,
  ReadThroughBlobStore,
} from "../experimental/utils/media_core.js";
import { removeAdditionalProperties } from "../utils/zod_to_gemini_parameters.js";
import { MessageGeminiSafetyHandler } from "../utils/index.js";

export class ChatGoogle extends ChatGoogleBase<MockClientAuthInfo> {
  constructor(fields?: ChatGoogleBaseInput<MockClientAuthInfo>) {
    super(fields);
  }

  buildAbstractedClient(
    fields?: GoogleAIBaseLLMInput<MockClientAuthInfo>
  ): GoogleAbstractedClient {
    const options = authOptions(fields);
    return new MockClient(options);
  }
}

describe("Mock ChatGoogle - Gemini", () => {
  test("Setting invalid model parameters", async () => {
    expect(() => {
      const model = new ChatGoogle({
        temperature: 1.2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/temperature/);

    expect(() => {
      const model = new ChatGoogle({
        topP: -2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topP/);

    expect(() => {
      const model = new ChatGoogle({
        topP: 2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topP/);

    expect(() => {
      const model = new ChatGoogle({
        topK: -2,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/topK/);

    expect(() => {
      const model = new ChatGoogle({
        maxReasoningTokens: -1000,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/maxReasoningTokens.*non-negative/);

    expect(() => {
      const model = new ChatGoogle({
        maxOutputTokens: 500,
        maxReasoningTokens: 1000,
      });
      expect(model).toBeNull(); // For linting. Should never reach.
    }).toThrowError(/maxOutputTokens.*maxReasoningTokens/);
  });

  test("user agent header", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record?.opts?.headers).toHaveProperty("User-Agent");
    expect(record?.opts?.headers).toHaveProperty("Client-Info");
    expect(record.opts.headers["User-Agent"]).toMatch(
      /langchain-js\/[0-9.]+-ChatConnection/
    );
    expect(record.opts.headers["Client-Info"]).toMatch(
      /\d+(\.\d+)?-ChatConnection/ // Since we are not getting libraryVersion from env right now, it will always be 0
    );
  });

  test("platform default", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new ChatGoogle({
      authOptions,
    });

    expect(model.platform).toEqual("gcp");
  });

  test("platform default key", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new ChatGoogle({
      authOptions,
      apiKey: "test",
    });

    expect(model.platform).toEqual("gai");
  });

  test("platform set", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gai",
    });

    expect(model.platform).toEqual("gai");
  });

  test("platform vertexai true", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new ChatGoogle({
      authOptions,
      apiKey: "test",
      vertexai: true,
    });

    expect(model.platform).toEqual("gcp");
  });

  test("platform vertexai false", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
    };
    const model = new ChatGoogle({
      authOptions,
      vertexai: false,
    });

    expect(model.platform).toEqual("gai");
  });

  test("platform endpoint - gcp", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gcp",
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record?.opts.url).toEqual(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-pro:generateContent`
    );
  });

  test("platform endpoint - gcp location", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gcp",
      location: "luna-central1",
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record?.opts.url).toEqual(
      `https://luna-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/luna-central1/publishers/google/models/gemini-pro:generateContent`
    );
  });

  test("platform endpoint - gcp global", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gcp",
      location: "global",
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record?.opts.url).toEqual(
      `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-pro:generateContent`
    );
  });

  test("platform endpoint - gai", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gai",
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record?.opts.url).toEqual(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`
    );
  });

  test("platform endpoint - gai apiVersion", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gai",
      apiVersion: "v1alpha",
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record?.opts.url).toEqual(
      `https://generativelanguage.googleapis.com/v1alpha/models/gemini-pro:generateContent`
    );
  });

  test("labels - included on Vertex AI (gcp)", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gcp",
      labels: {
        team: "research",
        component: "frontend",
        environment: "production",
      },
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Hello"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.labels).toBeDefined();
    expect(data.labels).toEqual({
      team: "research",
      component: "frontend",
      environment: "production",
    });
  });

  test("labels - excluded on Google AI Studio (gai)", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gai",
      labels: {
        team: "research",
        component: "frontend",
      },
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Hello"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.labels).not.toBeDefined();
  });

  test("labels - passed via invoke options on Vertex AI", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gcp",
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Hello"),
    ];
    await model.invoke(messages, {
      labels: {
        session: "test-session",
        user: "test-user",
      },
    });

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.labels).toBeDefined();
    expect(data.labels).toEqual({
      session: "test-session",
      user: "test-user",
    });
  });

  test("labels - invoke options override model labels on Vertex AI", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gcp",
      labels: {
        team: "research",
        environment: "dev",
      },
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Hello"),
    ];
    await model.invoke(messages, {
      labels: {
        environment: "production",
        session: "override-session",
      },
    });

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.labels).toBeDefined();
    expect(data.labels).toEqual({
      environment: "production",
      session: "override-session",
    });
  });

  test("labels - no labels sent when not provided", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gcp",
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Hello"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.labels).not.toBeDefined();
  });

  test("labels - empty labels object not sent", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      platformType: "gcp",
      labels: {},
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Hello"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.labels).not.toBeDefined();
  });

  test("1. Basic request format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toBeDefined();
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.systemInstruction).not.toBeDefined();
  });

  test("1. Basic request format - retryable request", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];

    const retryableError = new MockClientError(429);
    const requestSpy = jest
      .spyOn(MockClient.prototype, "request")
      .mockRejectedValueOnce(retryableError);

    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);

    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  test("1. Invoke request format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      temperature: 0.8,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;

    expect(data).toHaveProperty("generationConfig");
    const { generationConfig } = data;
    expect(generationConfig).toHaveProperty("temperature");
    expect(generationConfig.temperature).toEqual(0.8);
    expect(generationConfig).not.toHaveProperty("topP");

    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toBeDefined();
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.systemInstruction).not.toBeDefined();
  });

  test("1. Response format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);

    expect(result._getType()).toEqual("ai");
    const aiMessage = result as AIMessage;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content).toBe("T");
  });

  test("1. Invoke response format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    const result = await model.invoke(messages);

    expect(result._getType()).toEqual("ai");
    const aiMessage = result as AIMessage;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content).toBe("T");
  });

  // The older models don't support systemInstruction, so
  // SystemMessages will be turned into the human request with the prompt
  // from the system message and a faked ai response saying "Ok".
  test("1. System request format old model", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.0-pro-001",
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(5);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toEqual(
      "I will ask you to flip a coin and tell me H for heads and T for tails"
    );
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[1].parts[0].text).toEqual("Ok");
    expect(data.systemInstruction).not.toBeDefined();
  });

  test("1. System request format convert true", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      convertSystemMessageToHumanContent: true,
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(5);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toEqual(
      "I will ask you to flip a coin and tell me H for heads and T for tails"
    );
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[1].parts[0].text).toEqual("Ok");
    expect(data.systemInstruction).not.toBeDefined();
  });

  test("1. System request format convert false", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      convertSystemMessageToHumanContent: false,
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toEqual("Flip it");
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[1].parts[0].text).toEqual("H");
    expect(data.systemInstruction).toBeDefined();
  });

  test("1. System request format new model", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-pro",
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    await model.invoke(messages);

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.contents).toBeDefined();
    expect(data.contents.length).toEqual(3);
    expect(data.contents[0].role).toEqual("user");
    expect(data.contents[0].parts).toBeDefined();
    expect(data.contents[0].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[0].parts[0].text).toEqual("Flip it");
    expect(data.contents[1].role).toEqual("model");
    expect(data.contents[1].parts).toBeDefined();
    expect(data.contents[1].parts.length).toBeGreaterThanOrEqual(1);
    expect(data.contents[1].parts[0].text).toEqual("H");
    expect(data.systemInstruction).toBeDefined();
  });

  test("1. System request - multiple", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      convertSystemMessageToHumanContent: false,
    });
    const messages: BaseMessageLike[] = [
      new SystemMessage(
        "I will ask you to flip a coin and tell me H for heads and T for tails"
      ),
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new SystemMessage("Now tell me Z for heads and Q for tails"),
      new HumanMessage("Flip it again"),
    ];

    let caught = false;
    try {
      await model.invoke(messages);
    } catch (xx) {
      caught = true;
    }
    expect(caught).toBeTruthy();
  });

  test("1. System request - not first", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      convertSystemMessageToHumanContent: false,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip it"),
      new AIMessage("H"),
      new SystemMessage("Now tell me Z for heads and Q for tails"),
      new HumanMessage("Flip it again"),
    ];

    let caught = false;
    try {
      await model.invoke(messages);
    } catch (xx) {
      caught = true;
    }
    expect(caught).toBeTruthy();
  });

  test("1. seed - default off", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    await model.invoke(
      "You roll two dice. What's the probability they add up to 7?"
    );

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;

    expect(data).toHaveProperty("generationConfig");
    expect(data.generationConfig).not.toHaveProperty("seed");
  });

  test("1. seed - value", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      seed: 6,
    });
    await model.invoke(
      "You roll two dice. What's the probability they add up to 7?"
    );

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;

    expect(data).toHaveProperty("generationConfig");
    expect(data.generationConfig.seed).toEqual(6);
  });

  test("1. Reasoning - default off", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    await model.invoke(
      "You roll two dice. What's the probability they add up to 7?"
    );

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;

    expect(data).toHaveProperty("generationConfig");
    expect(data.generationConfig).not.toHaveProperty("thinkingConfig");
  });

  test("1. Reasoning - standard settings", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      maxReasoningTokens: 100,
    });
    await model.invoke(
      "You roll two dice. What's the probability they add up to 7?"
    );

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;

    expect(data).toHaveProperty("generationConfig");
    expect(data.generationConfig).toHaveProperty("thinkingConfig");
    const { thinkingConfig } = data.generationConfig;
    expect(thinkingConfig).toHaveProperty("thinkingBudget");
    expect(thinkingConfig.thinkingBudget).toEqual(100);
  });

  test("1. Reasoning - google settings", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      thinkingBudget: 120,
    });
    await model.invoke(
      "You roll two dice. What's the probability they add up to 7?"
    );

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;

    expect(data).toHaveProperty("generationConfig");
    expect(data.generationConfig).toHaveProperty("thinkingConfig");
    const { thinkingConfig } = data.generationConfig;
    expect(thinkingConfig).toHaveProperty("thinkingBudget");
    expect(thinkingConfig.thinkingBudget).toEqual(120);
  });

  test("1. Reasoning - openAI settings", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-1-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-2.5-flex-preview-04-17",
      reasoningEffort: "low",
    });
    await model.invoke(
      "You roll two dice. What's the probability they add up to 7?"
    );

    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;

    expect(data).toHaveProperty("generationConfig");
    expect(data.generationConfig).toHaveProperty("thinkingConfig");
    const { thinkingConfig } = data.generationConfig;
    expect(thinkingConfig).toHaveProperty("thinkingBudget");
    expect(thinkingConfig.thinkingBudget).toEqual(8192);
  });

  test("2. Safety - settings", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-2-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      safetySettings: [
        {
          category: GoogleAISafetyCategory.Harassment,
          threshold: GoogleAISafetyThreshold.Most,
        },
      ],
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    let caught = false;
    try {
      await model.invoke(messages);
    } catch (xx: any) {
      caught = true;
    }

    const settings = record?.opts?.data?.safetySettings;
    expect(settings).toBeDefined();
    expect(Array.isArray(settings)).toEqual(true);
    expect(settings).toHaveLength(1);
    expect(settings[0].category).toEqual("HARM_CATEGORY_HARASSMENT");
    expect(settings[0].threshold).toEqual("BLOCK_LOW_AND_ABOVE");

    expect(caught).toEqual(true);
  });

  test("2. Safety - default", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-2-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    let caught = false;
    try {
      await model.invoke(messages);
    } catch (xx: any) {
      caught = true;
      expect(xx).toBeInstanceOf(GoogleAISafetyError);

      const result = xx?.reply.generations[0];
      expect(result).toBeUndefined();
    }

    expect(caught).toEqual(true);
  });

  test("2. Safety - safety handler", async () => {
    const safetyHandler: GoogleAISafetyHandler = new MessageGeminiSafetyHandler(
      {
        msg: "I'm sorry, Dave, but I can't do that.",
      }
    );
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-2-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      safetyHandler,
    });
    const messages: BaseMessageLike[] = [
      new HumanMessage("Flip a coin and tell me H for heads and T for tails"),
      new AIMessage("H"),
      new HumanMessage("Flip it again"),
    ];
    let caught = false;
    try {
      const result = await model.invoke(messages);

      expect(result._getType()).toEqual("ai");
      const aiMessage = result as AIMessage;
      expect(aiMessage.content).toBeDefined();
      expect(aiMessage.content).toBe("I'm sorry, Dave, but I can't do that.");
    } catch (xx: any) {
      caught = true;
    }

    expect(caught).toEqual(false);
  });

  test("3. invoke - images", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-3-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      model: "gemini-1.5-flash",
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAIAAAACUFjqAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AIbFwQSRaexCAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAJklEQVQY02P8//8/A27AxIAXsEAor31f0CS2OfEQ1j2Q0owU+RsAGNUJD2/04PgAAAAASUVORK5CYII=`,
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];

    const result = await model.invoke(messages);

    expect(record.opts).toHaveProperty("data");
    expect(record.opts.data).toHaveProperty("contents");
    expect(record.opts.data.contents).toHaveLength(1);
    expect(record.opts.data.contents[0]).toHaveProperty("parts");

    const parts = record?.opts?.data?.contents[0]?.parts;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveProperty("text");
    expect(parts[1]).toHaveProperty("inlineData");
    expect(parts[1].inlineData).toHaveProperty("mimeType");
    expect(parts[1].inlineData).toHaveProperty("data");

    expect(result.content).toBe("A blue square.");
  });

  test("3. invoke - media - invalid", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-3-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      model: "gemini-1.5-flash",
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "media",
        fileUri: "mock://example.com/blue-box.png",
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];

    try {
      const result = await model.invoke(messages);
      expect(result).toBeUndefined();
    } catch (e) {
      expect((e as Error).message).toMatch(/^Invalid media content/);
    }
  });

  test("3. invoke - media - no manager", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-3-mock.json",
    };
    const model = new ChatGoogle({
      authOptions,
      model: "gemini-1.5-flash",
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "media",
        fileUri: "mock://example.com/blue-box.png",
        mimeType: "image/png",
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];

    const result = await model.invoke(messages);

    console.log(JSON.stringify(record.opts, null, 1));

    expect(record.opts).toHaveProperty("data");
    expect(record.opts.data).toHaveProperty("contents");
    expect(record.opts.data.contents).toHaveLength(1);
    expect(record.opts.data.contents[0]).toHaveProperty("parts");

    const parts = record?.opts?.data?.contents[0]?.parts;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveProperty("text");
    expect(parts[1]).toHaveProperty("fileData");
    expect(parts[1].fileData).toHaveProperty("mimeType");
    expect(parts[1].fileData).toHaveProperty("fileUri");

    expect(result.content).toBe("A blue square.");
  });

  test("3. invoke - media - manager", async () => {
    class MemStore extends InMemoryStore<MediaBlob> {
      get length() {
        return Object.keys(this.store).length;
      }
    }

    const aliasMemory = new MemStore();
    const aliasStore = new BackedBlobStore({
      backingStore: aliasMemory,
      defaultFetchOptions: {
        actionIfBlobMissing: undefined,
      },
    });
    const canonicalMemory = new MemStore();
    const canonicalStore = new BackedBlobStore({
      backingStore: canonicalMemory,
      defaultStoreOptions: {
        pathPrefix: "canonical://store/",
        actionIfInvalid: "prefixPath",
      },
      defaultFetchOptions: {
        actionIfBlobMissing: undefined,
      },
    });
    const blobStore = new ReadThroughBlobStore({
      baseStore: aliasStore,
      backingStore: canonicalStore,
    });
    const resolverMemory = new MemStore();
    const resolver = new BackedBlobStore({
      backingStore: resolverMemory,
      defaultFetchOptions: {
        actionIfBlobMissing: "emptyBlob",
      },
    });
    const mediaManager = new MediaManager({
      store: blobStore,
      resolvers: [resolver],
    });

    async function store(path: string, text: string): Promise<void> {
      const type = path.endsWith(".png") ? "image/png" : "text/plain";
      const data = new Blob([text], { type });
      const blob = await MediaBlob.fromBlob(data, { path });
      await resolver.store(blob);
    }
    await store("resolve://host/foo", "fooing");
    await store("resolve://host2/bar/baz", "barbazing");
    await store("resolve://host/foo/blue-box.png", "png");

    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-3-mock.json",
    };
    const callbacks: CallbackHandlerMethods[] = [
      {
        handleChatModelStart(
          llm: Serialized,
          messages: BaseMessage[][],
          runId: string,
          _parentRunId?: string,
          _extraParams?: Record<string, unknown>,
          _tags?: string[],
          _metadata?: Record<string, unknown>,
          _runName?: string
        ): any {
          console.log("Chat start", llm, messages, runId);
        },
        handleCustomEvent(
          eventName: string,
          data: any,
          runId: string,
          tags?: string[],
          metadata?: Record<string, any>
        ): any {
          console.log("Custom event", eventName, runId, data, tags, metadata);
        },
      },
    ];
    const model = new ChatGoogle({
      authOptions,
      model: "gemini-1.5-flash",
      apiConfig: {
        mediaManager,
      },
      callbacks,
    });

    const message: MessageContentComplex[] = [
      {
        type: "text",
        text: "What is in this image?",
      },
      {
        type: "media",
        fileUri: "resolve://host/foo/blue-box.png",
      },
    ];

    const messages: BaseMessage[] = [
      new HumanMessageChunk({ content: message }),
    ];

    const result = await model.invoke(messages);

    console.log(JSON.stringify(record.opts, null, 1));

    expect(record.opts).toHaveProperty("data");
    expect(record.opts.data).toHaveProperty("contents");
    expect(record.opts.data.contents).toHaveLength(1);
    expect(record.opts.data.contents[0]).toHaveProperty("parts");

    const parts = record?.opts?.data?.contents[0]?.parts;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveProperty("text");
    expect(parts[1]).toHaveProperty("fileData");
    expect(parts[1].fileData).toHaveProperty("mimeType");
    expect(parts[1].fileData.mimeType).toEqual("image/png");
    expect(parts[1].fileData).toHaveProperty("fileUri");
    expect(parts[1].fileData.fileUri).toEqual(
      "canonical://store/host/foo/blue-box.png"
    );

    expect(result.content).toBe("A blue square.");
  });

  test("4. Functions Bind - Gemini format request", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4-mock.json",
    };

    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];

    const baseModel = new ChatGoogle({
      authOptions,
    });
    const model = baseModel.bindTools(tools);

    const result = await model.invoke("What?");

    // console.log(JSON.stringify(record, null, 1));

    expect(result).toBeDefined();

    const toolsResult = record?.opts?.data?.tools;
    expect(toolsResult).toBeDefined();
    expect(Array.isArray(toolsResult)).toBeTruthy();
    expect(toolsResult).toHaveLength(1);

    const toolResult = toolsResult[0];
    expect(toolResult).toBeDefined();
    expect(toolResult).toHaveProperty("functionDeclarations");
    expect(Array.isArray(toolResult.functionDeclarations)).toBeTruthy();
    expect(toolResult.functionDeclarations).toHaveLength(1);

    const functionDeclaration = toolResult.functionDeclarations[0];
    expect(functionDeclaration.name).toBe("test");
    expect(functionDeclaration.description).toBe(
      "Run a test with a specific name and get if it passed or failed"
    );
    expect(functionDeclaration.parameters).toBeDefined();
    expect(typeof functionDeclaration.parameters).toBe("object");

    const parameters = functionDeclaration?.parameters;
    expect(parameters.type).toBe("object");
    expect(parameters).toHaveProperty("properties");
    expect(typeof parameters.properties).toBe("object");

    expect(parameters.properties.testName).toBeDefined();
    expect(typeof parameters.properties.testName).toBe("object");
    expect(parameters.properties.testName.type).toBe("string");
    expect(parameters.properties.testName.description).toBe(
      "The name of the test that should be run."
    );

    expect(parameters.required).toBeDefined();
    expect(Array.isArray(parameters.required)).toBeTruthy();
    expect(parameters.required).toHaveLength(1);
    expect(parameters.required[0]).toBe("testName");
  });

  test("4. Functions Bind - zod request", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4-mock.json",
    };

    const weatherTool = tool((_) => "no-op", {
      name: "get_weather",
      description:
        "Get the weather of a specific location and return the temperature in Celsius.",
      schema: z.object({
        location: z
          .string()
          .describe("The name of city to get the weather for."),
      }),
    });
    const tools = [weatherTool];

    const baseModel = new ChatGoogle({
      authOptions,
    });
    const model = baseModel.bindTools(tools);

    await model.invoke("What?");

    const func = record?.opts?.data?.tools?.[0]?.functionDeclarations?.[0];
    expect(func).toBeDefined();
    expect(func.name).toEqual("get_weather");
    expect(func.parameters?.required).toContain("location");
    expect(func.parameters?.properties?.location?.type).toEqual("string");
    expect(func.parameters?.properties?.location?.nullable).not.toBeDefined();

    console.log(func);
  });

  test("4. Functions Bind - zod nullish request", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4-mock.json",
    };

    const nullishWeatherTool = tool((_) => "no-op", {
      name: "get_nullish_weather",
      description:
        "Get the weather of a specific location and return the temperature in Celsius.",
      schema: z.object({
        location: z
          .string()
          .nullish()
          .describe("The name of city to get the weather for."),
      }),
    });
    const tools = [nullishWeatherTool];

    const baseModel = new ChatGoogle({
      authOptions,
    });
    const model = baseModel.bindTools(tools);

    await model.invoke("What?");

    const func = record?.opts?.data?.tools?.[0]?.functionDeclarations?.[0];
    expect(func).toBeDefined();
    expect(func.name).toEqual("get_nullish_weather");
    expect(func.parameters?.properties?.location?.type).toEqual("string");
    expect(func.parameters?.properties?.location?.nullable).toEqual(true);
  });

  test("4. Functions withStructuredOutput - Gemini format request", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4-mock.json",
    };

    const tool = {
      name: "test",
      description:
        "Run a test with a specific name and get if it passed or failed",
      parameters: {
        type: "object",
        properties: {
          testName: {
            type: "string",
            description: "The name of the test that should be run.",
          },
        },
        required: ["testName"],
      },
    };

    const baseModel = new ChatGoogle({
      authOptions,
    });
    const model = baseModel.withStructuredOutput(tool);

    await model.invoke("What?");

    // console.log(JSON.stringify(record, null, 1));

    const toolsResult = record?.opts?.data?.tools;
    expect(toolsResult).toBeDefined();
    expect(Array.isArray(toolsResult)).toBeTruthy();
    expect(toolsResult).toHaveLength(1);

    const toolResult = toolsResult[0];
    expect(toolResult).toBeDefined();
    expect(toolResult).toHaveProperty("functionDeclarations");
    expect(Array.isArray(toolResult.functionDeclarations)).toBeTruthy();
    expect(toolResult.functionDeclarations).toHaveLength(1);

    const functionDeclaration = toolResult.functionDeclarations[0];
    expect(functionDeclaration.name).toBe("test");
    expect(functionDeclaration.description).toBe(
      "Run a test with a specific name and get if it passed or failed"
    );
    expect(functionDeclaration.parameters).toBeDefined();
    expect(typeof functionDeclaration.parameters).toBe("object");

    const parameters = functionDeclaration?.parameters;
    expect(parameters.type).toBe("object");
    expect(parameters).toHaveProperty("properties");
    expect(typeof parameters.properties).toBe("object");

    expect(parameters.properties.testName).toBeDefined();
    expect(typeof parameters.properties.testName).toBe("object");
    expect(parameters.properties.testName.type).toBe("string");
    expect(parameters.properties.testName.description).toBe(
      "The name of the test that should be run."
    );

    expect(parameters.required).toBeDefined();
    expect(Array.isArray(parameters.required)).toBeTruthy();
    expect(parameters.required).toHaveLength(1);
    expect(parameters.required[0]).toBe("testName");
  });

  test("4. Functions - results", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4-mock.json",
    };

    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];

    const model = new ChatGoogle({
      authOptions,
    }).bindTools(tools);

    const result = await model.invoke("What?");

    // console.log(JSON.stringify(result, null, 1));
    expect(result).toHaveProperty("content");
    expect(result.content).toBe("");

    const args = result?.lc_kwargs?.additional_kwargs;
    expect(args).toBeDefined();
    expect(args).toHaveProperty("tool_calls");
    expect(Array.isArray(args.tool_calls)).toBeTruthy();
    expect(args.tool_calls).toHaveLength(1);
    const call = args.tool_calls[0];
    expect(call).toHaveProperty("type");
    expect(call.type).toBe("function");
    expect(call).toHaveProperty("function");
    const func = call.function;
    expect(func).toBeDefined();
    expect(func).toHaveProperty("name");
    expect(func.name).toBe("test");
    expect(func).toHaveProperty("arguments");
    expect(typeof func.arguments).toBe("string");
    expect(func.arguments.replaceAll("\n", "")).toBe('{"testName":"cobalt"}');

    expect(result).toHaveProperty("tool_calls");
    expect(result.tool_calls).toHaveLength(1);
    const toolCall = result!.tool_calls![0];
    expect(toolCall?.type).toEqual("tool_call");
    expect(toolCall?.name).toEqual("test");
    expect(toolCall?.args?.testName).toEqual("cobalt");
  });

  test("4a. Functions - results", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-4a-mock.json",
    };

    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            description: "Get the schema for a specific resource type",
            name: "get_resource_schema",
            parameters: {
              properties: {
                resourceType: {
                  description: "The type of resource to get schema for",
                  type: "string",
                },
              },
              required: ["resourceType"],
              type: "object",
            },
          },
        ],
      },
    ];

    const model = new ChatGoogle({
      authOptions,
    }).bindTools(tools);

    const result = await model.invoke("What?");

    // console.log(JSON.stringify(result, null, 1));
    expect(result).toHaveProperty("content");
    expect(result.content).toMatch("Okay, I will");

    const args = result?.lc_kwargs?.additional_kwargs;
    expect(args).toBeDefined();
    expect(args).toHaveProperty("tool_calls");
    expect(Array.isArray(args.tool_calls)).toBeTruthy();
    expect(args.tool_calls).toHaveLength(2);
    const call = args.tool_calls[0];
    expect(call).toHaveProperty("type");
    expect(call.type).toBe("function");
    expect(call).toHaveProperty("function");
    const func = call.function;
    expect(func).toBeDefined();
    expect(func).toHaveProperty("name");
    expect(func.name).toBe("get_resource_schema");
    expect(func).toHaveProperty("arguments");
    expect(typeof func.arguments).toBe("string");
    expect(func.arguments.replaceAll("\n", "")).toBe('{"resourceType":"user"}');

    expect(result).toHaveProperty("tool_calls");
    expect(result.tool_calls).toHaveLength(2);
    const toolCall = result!.tool_calls![0];
    expect(toolCall?.type).toEqual("tool_call");
    expect(toolCall?.name).toEqual("get_resource_schema");
    expect(toolCall?.args?.resourceType).toEqual("user");
  });

  test("5. Functions - function reply", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-5-mock.json",
    };

    const tools: GeminiTool[] = [
      {
        functionDeclarations: [
          {
            name: "test",
            description:
              "Run a test with a specific name and get if it passed or failed",
            parameters: {
              type: "object",
              properties: {
                testName: {
                  type: "string",
                  description: "The name of the test that should be run.",
                },
              },
              required: ["testName"],
            },
          },
        ],
      },
    ];

    const model = new ChatGoogle({
      authOptions,
    }).bindTools(tools);
    const toolResult = {
      testPassed: true,
    };
    const messages: BaseMessageLike[] = [
      new HumanMessage("Run a test on the cobalt project."),
      new AIMessage("", {
        tool_calls: [
          {
            id: "test",
            type: "function",
            function: {
              name: "test",
              arguments: '{"testName":"cobalt"}',
            },
          },
        ],
      }),
      new ToolMessage(JSON.stringify(toolResult), "test"),
    ];
    const result = await model.invoke(messages);
    expect(result).toBeDefined();

    // console.log(JSON.stringify(record?.opts?.data, null, 1));
  });

  test("6. GoogleSearchRetrievalTool result", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-6-mock.json",
    };

    const searchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: "MODE_DYNAMIC",
          dynamicThreshold: 0.7, // default is 0.7
        },
      },
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-pro-002",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchRetrievalTool]);

    const result = await model.invoke("Who won the 2024 MLB World Series?");
    expect(result.content as string).toContain("Dodgers");
    expect(result).toHaveProperty("response_metadata");
    expect(result.response_metadata).toHaveProperty("groundingMetadata");
    expect(result.response_metadata).toHaveProperty("groundingSupport");
    expect(Array.isArray(result.response_metadata.groundingSupport)).toEqual(
      true
    );
    expect(result.response_metadata.groundingSupport).toHaveLength(4);
  });

  test("6. GoogleSearchRetrievalTool request 1.5 ", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-6-mock.json",
    };

    const searchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: "MODE_DYNAMIC",
          dynamicThreshold: 0.7, // default is 0.7
        },
      },
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-pro-002",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchRetrievalTool]);

    const result = await model.invoke("Who won the 2024 MLB World Series?");
    expect(result.content as string).toContain("Dodgers");

    expect(record.opts.data.tools[0]).toHaveProperty("googleSearchRetrieval");
  });

  test("6. GoogleSearchRetrievalTool request 2.0 ", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-6-mock.json",
    };

    const searchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: "MODE_DYNAMIC",
          dynamicThreshold: 0.7, // default is 0.7
        },
      },
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-2.0-flash",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchRetrievalTool]);

    const result = await model.invoke("Who won the 2024 MLB World Series?");
    expect(result.content as string).toContain("Dodgers");

    expect(record.opts.data.tools[0]).toHaveProperty("googleSearch");
  });

  test("6. GoogleSearchTool request 1.5 ", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-6-mock.json",
    };

    const searchTool = {
      googleSearch: {},
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-pro-002",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchTool]);

    const result = await model.invoke("Who won the 2024 MLB World Series?");
    expect(result.content as string).toContain("Dodgers");

    expect(record.opts.data.tools[0]).toHaveProperty("googleSearchRetrieval");
  });

  test("6. GoogleSearchTool request 2.0 ", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-6-mock.json",
    };

    const searchTool = {
      googleSearch: {},
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-2.0-flash",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchTool]);

    const result = await model.invoke("Who won the 2024 MLB World Series?");
    expect(result.content as string).toContain("Dodgers");

    expect(record.opts.data.tools[0]).toHaveProperty("googleSearch");
  });

  test("7. logprobs request true", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-7-mock.json",
    };

    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-flash-002",
      logprobs: true,
      topLogprobs: 5,
    });
    const result = await model.invoke(
      "What are some names for a company that makes fancy socks?"
    );
    expect(result).toBeDefined();
    const data = record?.opts?.data;
    expect(data).toBeDefined();
    expect(data.generationConfig.responseLogprobs).toEqual(true);
    expect(data.generationConfig.logprobs).toEqual(5);
  });

  test("7. logprobs request false", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-7-mock.json",
    };

    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-flash-002",
      logprobs: false,
      topLogprobs: 5,
    });
    const result = await model.invoke(
      "What are some names for a company that makes fancy socks?"
    );
    expect(result).toBeDefined();
    const data = record?.opts?.data;
    expect(data).toBeDefined();
    expect(data.generationConfig.responseLogprobs).toEqual(false);
    expect(data.generationConfig.logprobs).not.toBeDefined();
  });

  test("7. logprobs request not defined", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-7-mock.json",
    };

    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-flash-002",
    });
    const result = await model.invoke(
      "What are some names for a company that makes fancy socks?"
    );
    expect(result).toBeDefined();
    const data = record?.opts?.data;
    expect(data).toBeDefined();
    expect(data.generationConfig.responseLogprobs).not.toBeDefined();
    expect(data.generationConfig.logprobs).not.toBeDefined();
  });

  test("7. logprobs response", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-7-mock.json",
    };

    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-flash-002",
      logprobs: true,
      topLogprobs: 5,
    });
    const result = await model.invoke(
      "What are some names for a company that makes fancy socks?"
    );
    // console.log(JSON.stringify(result,null,1));
    expect(result.response_metadata).toHaveProperty("logprobs");
    expect(result.response_metadata.logprobs).toHaveProperty("content");
    const logprobs = result.response_metadata.logprobs.content;
    expect(Array.isArray(logprobs)).toBeTruthy();
    expect(logprobs).toHaveLength(303);
    const first = logprobs[0];
    expect(first.token).toEqual("Here");
    expect(first.logprob).toEqual(-0.25194553);
    expect(first.bytes).toEqual([72, 101, 114, 101]);
    expect(first).toHaveProperty("top_logprobs");
    expect(Array.isArray(first.top_logprobs)).toBeTruthy();
          expect(first.top_logprobs).toHaveLength(5);
    });
});

describe("Mock ChatGoogle - Anthropic", () => {
  test("1. Invoke request format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "claude-chat-1-mock.json",
    };
    const model = new ChatGoogle({
      model: "claude-3-5-sonnet@20240620",
      platformType: "gcp",
      authOptions,
    });
    const messages: BaseMessageLike[] = [new HumanMessage("What is 1+1?")];
    await model.invoke(messages);

    console.log("record", record);
    expect(record.opts).toBeDefined();
    expect(record.opts.data).toBeDefined();
    const { data } = record.opts;
    expect(data.messages).toBeDefined();
    expect(data.messages.length).toEqual(1);
    expect(data.messages[0].role).toEqual("user");
    expect(data.messages[0].content).toBeDefined();
    expect(data.messages[0].content.length).toBeGreaterThanOrEqual(1);
    expect(data.messages[0].content[0].text).toBeDefined();
    expect(data.system).not.toBeDefined();
  });

  test("1. Invoke response format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "claude-chat-1-mock.json",
    };
    const model = new ChatGoogle({
      model: "claude-3-5-sonnet@20240620",
      platformType: "gcp",
      authOptions,
    });
    const messages: BaseMessageLike[] = [new HumanMessage("What is 1+1?")];
    const result = await model.invoke(messages);

    expect(result._getType()).toEqual("ai");
    const aiMessage = result as AIMessage;
    expect(aiMessage.content).toBeDefined();
    expect(aiMessage.content).toBe(
      "1 + 1 = 2\n\nThis is one of the most basic arithmetic equations. It represents the addition of two units, resulting in a sum of two."
    );
  });

  test("2. Thinking request 1 format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "claude-chat-2-mock.json",
    };
    const apiConfig: AnthropicAPIConfig = {
      thinking: { type: "enabled", budget_tokens: 2000 },
    };
    const model = new ChatGoogle({
      modelName: "claude-3-7-sonnet@20250219",
      platformType: "gcp",
      authOptions,
      apiConfig,
    });
    const messages: BaseMessageLike[] = [new HumanMessage("Hi there")];
    await model.invoke(messages);

    console.log("record", record?.opts?.data);
    expect(record?.opts?.data).toHaveProperty("thinking");
    expect(record.opts.data.thinking.type).toEqual("enabled");
    expect(record.opts.data.thinking.budget_tokens).toEqual(2000);
  });

  test("2. Thinking response 1 format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "claude-chat-2-mock.json",
    };
    const apiConfig: AnthropicAPIConfig = {
      thinking: { type: "enabled", budget_tokens: 2000 },
    };
    const model = new ChatGoogle({
      modelName: "claude-3-7-sonnet@20250219",
      platformType: "gcp",
      authOptions,
      apiConfig,
    });
    const messages: BaseMessageLike[] = [new HumanMessage("Hi there")];
    const response = await model.invoke(messages);

    console.log(JSON.stringify(response, null, 1));
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content).toHaveLength(2);
    const content = response.content as MessageContentComplex[];
    expect(
      content.some((block) => "thinking" in (block as MessageContentComplex))
    ).toBe(true);

    let thinkingCount = 0;
    for (const block of response.content) {
      expect(typeof block).toBe("object");
      const complexBlock = block as MessageContentComplex;
      if (complexBlock.type === "thinking") {
        thinkingCount += 1;
        expect(Object.keys(block).sort()).toEqual(
          ["type", "thinking", "signature"].sort()
        );
        expect(complexBlock.thinking).toBeTruthy();
        expect(typeof complexBlock.thinking).toBe("string");
        expect(complexBlock.signature).toBeTruthy();
        expect(typeof complexBlock.signature).toBe("string");
      }
    }
    expect(thinkingCount).toEqual(1);
  });

  test("2. Thinking request 2 format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "claude-chat-2-mock.json",
    };
    const apiConfig: AnthropicAPIConfig = {
      thinking: { type: "enabled", budget_tokens: 2000 },
    };
    const model = new ChatGoogle({
      modelName: "claude-3-7-sonnet@20250219",
      platformType: "gcp",
      authOptions,
      apiConfig,
    });
    const messages1: BaseMessageLike[] = [new HumanMessage("Hi there")];
    const response1 = await model.invoke(messages1);

    const messages2: BaseMessageLike[] = [
      ...messages1,
      response1,
      new HumanMessage("What is 42 + 7?"),
    ];
    await model.invoke(messages2);

    console.log("record", record?.opts?.data);
    const testMessages = record?.opts?.data?.messages;
    expect(Array.isArray(testMessages)).toEqual(true);
    expect(testMessages).toHaveLength(3);
    const content = testMessages[1]?.content;
    expect(Array.isArray(content)).toEqual(true);
    expect(content[0].type).toEqual("thinking");
    expect(content[0].signature).toEqual(
      "EuoBCkgIARACGAIiQAaRslZizmvsLlYS8BV0r0n6hzeTQrjPx/D8WBjoiz7E7uyphiQs+FIoF7ec1VULelnEi5NlAuogSfxyOfM8O/4SDCoF2ccJFJxrfz8gjhoMlV/iOHFZ9gLnW1kuIjDn2GrBrlPRzqQD1H7Z4wQHTEkVnv5AUUCzJdER3Pfyf6nSjM3fTb/f2SFp6hKW8uMqUJd0RLm38/Ofu548THF6TGT4Do1sY9M+HETggt6OYE0QMvMEWGQaAw8vuWBR+AzkbnuqmZ05hAAuumoGqM2kF5CiD/fwyxBDz4QYSSP+rBQn"
    );
  });

  test("3. Redacted response format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "claude-chat-3-mock.json",
    };
    const apiConfig: AnthropicAPIConfig = {
      thinking: { type: "enabled", budget_tokens: 2000 },
    };
    const model = new ChatGoogle({
      modelName: "claude-3-7-sonnet@20250219",
      platformType: "gcp",
      authOptions,
      apiConfig,
    });
    const messages: BaseMessageLike[] = [new HumanMessage("Hi there")];
    const response = await model.invoke(messages);

    console.log(JSON.stringify(response, null, 1));
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content).toHaveLength(2);
    const content = response.content as MessageContentComplex[];

    let thinkingCount = 0;
    for (const block of content) {
      expect(typeof block).toBe("object");
      const complexBlock = block as MessageContentComplex;
      if (complexBlock.type === "redacted_thinking") {
        thinkingCount += 1;
        expect(Object.keys(block).sort()).toEqual(["type", "data"].sort());
        expect(complexBlock).not.toHaveProperty("thinking");
        expect(complexBlock).toHaveProperty("data");
        expect(typeof complexBlock.data).toBe("string");
      }
    }
    expect(thinkingCount).toEqual(1);
  });

  test("3. Redacted request format", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "claude-chat-3-mock.json",
    };
    const apiConfig: AnthropicAPIConfig = {
      thinking: { type: "enabled", budget_tokens: 2000 },
    };
    const model = new ChatGoogle({
      modelName: "claude-3-7-sonnet@20250219",
      platformType: "gcp",
      authOptions,
      apiConfig,
    });
    const messages1: BaseMessageLike[] = [new HumanMessage("Hi there")];
    const response1 = await model.invoke(messages1);
    const messages2: BaseMessageLike[] = [
      ...messages1,
      response1,
      new HumanMessage("What is 42 + 7?"),
    ];
    await model.invoke(messages2);

    console.log("record", record?.opts?.data);
    const testMessages = record?.opts?.data?.messages;
    expect(Array.isArray(testMessages)).toEqual(true);
    expect(testMessages).toHaveLength(3);
    const content = testMessages[1]?.content;
    console.log(content);
    expect(Array.isArray(content)).toEqual(true);
    expect(content[0].type).toEqual("redacted_thinking");
    expect(content[0].data).toEqual(
      "EroICooBCAEQAhgCIkDvEnr8/MqMckuryHRx//D3wPtlP+0whuFFRSLNu/gEvZzyALMEneb5I6SQ2wshZF0RSyXs7sfUDq481kb1xUjWKkDRrtG/WX1wSVRTvowEpP+qJpYZqMJNhI28E8Vo+5Mm/3qrk0yIukRoOWKTVGGoPFfJEP539gMa1AxnJlToaefjEgxW4f83l8+aMIMJF9UaDFZlJEIPQWk99r6EqiIwvtTVG2j01jARQXRWfM214Q8F/q4ctTOOZjxRjtT9v453gMqjZ10ljYrvBVBjyHCCKtwGquvKhyBgtsT1BgOKWAanjGHV5Bz1OB7hZmumkMisVVmxfOt7XW+BiyEFLLne7wL3KdKpzn+Js7AbDLbJ822ncksYPYOMnCAYE7IFntUcwXEeZf+/UzWVuwnlvbDtXYFnzYvkiY4+hO0DTBEzjnskpM6BoB7jfi5gYE50a8VLnEJHQS+RzbdB8CWYh5nmH3dN0Zro1SZowtwxlcTyGU0SKlrATCgxccdL41no39K36C/FNeRjYl1PIPIlIrgS04AfJpXEw0mKTDasvPTdQtu8iXh9u+yT4YL1xlnr1shPN8KNQgL8/s8s5D4T7XL6M6AhvMFcw0NgXd8MpCgjFeDV/Y77IyeSavnsTlAjXBJ3lGkaRmyUxIEuQxTF+weGqebm88JHAVkGhM6+0cy8RLpcHjxJ+6BUNMKLwZBxNu8RGtISM0KUUs5hfJ5idfanHE+dXWmMbYq/B5Y67jcm4tR2rRwFORuI6BimwfKXj5IVDuSZxk5teF9uq5huDvva3y3QbrjWkzUF3ruiNkGoXpR1xDxf/42VPCO4lQgeQKhPo262118LsvcauphNL7cgkKw7hn7TVqX6CftdnMSMhNkJWqnQbzkzSS1eIvNd2a+5uio0ASzhuH6bnInZ2DT9vhQZYJPDqRb9iTAezrzE/mC8cLmduY6ULS39254Tt4JqSsZ0IhChyUHysgZp+Ntlq7Stgypmzk5Kco9faYtrGz/0LkuF2Uxm2rE+VVd2N+ypm63PprllU6zW1AdxvSL8Rx6NdNIPlr8d04Iz7bXY0ATv/JhAWeRTsWcRvIKjwEmTClmuYciZzqW/qGAiGgRzie/wscKrjR+CDZarg8QsTEv98Z/LANCGLNIoh48xQ6h4LKiNRytC5QzL2ZaIjRojlm3bGhpIGmBjKhZKQDjsuwwf2hL/JvyXxwbT3hCex/vQbnvp7BLD52tzy0kR0lmrrsQ6nAq3PEHJETZGbZazczrWt38STbAFA9yerg+aMyyvuTC8OXv77YMztqa122B0X9HK22qCHl1TaOivKS9pho5tjq0qAOWce+WCgx5F252V9QfTLz+QRLrGnPwftTuL9LA7DWT8P4C3g0AW3a0hiwjWuFZem3PTRgYW4gp9nbaewDFVzz220CVPgxNrGQM="
    );
  });

  test("4. Request content order", async () => {
    /*
     * Anthropic requires that any thinking content be before other
     * types of content, including tool_use, even if the LLM sends it
     * in a different order.
     */
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "claude-chat-4-mock.json",
    };
    const apiConfig: AnthropicAPIConfig = {
      thinking: { type: "enabled", budget_tokens: 2000 },
    };
    const model = new ChatGoogle({
      modelName: "claude-3-7-sonnet@20250219",
      platformType: "gcp",
      authOptions,
      apiConfig,
    });
    const messages1: BaseMessageLike[] = [new HumanMessage("Hi there")];
    const response1 = await model.invoke(messages1);
    const messages2: BaseMessageLike[] = [
      ...messages1,
      response1,
      new ToolMessage({
        tool_call_id: "toolu_vrtx_016zrD7kGCijSm76SA6QGjJw",
        content: "Mock response",
      }),
    ];
    await model.invoke(messages2);

    console.log("record", record?.opts?.data);
    const testMessages = record?.opts?.data?.messages;
    expect(Array.isArray(testMessages)).toEqual(true);
    expect(testMessages).toHaveLength(3);

    const content = testMessages[1]?.content;
    console.log(content);
    expect(Array.isArray(content)).toEqual(true);
    expect(content).toHaveLength(3);
    expect(content[0].type).toEqual("thinking");
    expect(content[2].type).toEqual("tool_use");

    const reply = testMessages[2]?.content;
    expect(Array.isArray(reply)).toEqual(true);
    expect(reply).toHaveLength(1);
    const replyContent = reply[0];
    expect(replyContent.type).toEqual("tool_result");
    expect(Array.isArray(replyContent.content)).toBe(true);
    expect(replyContent.content).toHaveLength(1);
    const toolResultContent = replyContent.content[0];
    console.log(toolResultContent);
    expect(toolResultContent.type).toEqual("text");
    expect(toolResultContent.text).toEqual("Mock response");
  });
});

function extractKeys(obj: Record<string, any>, keys: string[] = []) {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      keys.push(key);
      if (typeof obj[key] === "object" && obj[key] !== null) {
        extractKeys(obj[key], keys);
      }
    }
  }
  return keys;
}

test("removeAdditionalProperties can remove all instances of additionalProperties", async () => {
  const idealResponseSchema = z.object({
    idealResponse: z
      .string()
      .optional()
      .describe("The ideal response to the question"),
  });
  const questionSchema = z.object({
    question: z.string().describe("Question text"),
    type: z.enum(["singleChoice", "multiChoice"]).describe("Question type"),
    options: z.array(z.string()).describe("List of possible answers"),
    correctAnswer: z
      .string()
      .optional()
      .describe("correct answer from the possible answers"),
    idealResponses: z
      .array(idealResponseSchema)
      .describe("Array of ideal responses to the question"),
  });

  const schema = z.object({
    questions: z.array(questionSchema).describe("Array of question objects"),
  });

  const parsedSchemaArr = removeAdditionalProperties(zodToJsonSchema(schema));
  const arrSchemaKeys = extractKeys(parsedSchemaArr);
  expect(
    arrSchemaKeys.find((key) => key === "additionalProperties")
  ).toBeUndefined();
  const parsedSchemaObj = removeAdditionalProperties(
    zodToJsonSchema(questionSchema)
  );
  const arrSchemaObj = extractKeys(parsedSchemaObj);
  expect(
    arrSchemaObj.find((key) => key === "additionalProperties")
  ).toBeUndefined();

  const analysisSchema = z.object({
    decision: z.enum(["UseAPI", "UseFallback"]),
    explanation: z.string(),
    apiDetails: z
      .object({
        serviceName: z.string(),
        endpointName: z.string(),
        parameters: z.record(z.unknown()),
        extractionPath: z.string(),
      })
      .optional(),
  });
  const parsedAnalysisSchema = removeAdditionalProperties(
    zodToJsonSchema(analysisSchema)
  );
  const analysisSchemaObj = extractKeys(parsedAnalysisSchema);
  expect(
    analysisSchemaObj.find((key) => key === "additionalProperties")
  ).toBeUndefined();
});

test("Can set streaming param", () => {
  const modelWithStreamingDefault = new ChatGoogle();

  expect(modelWithStreamingDefault.streaming).toBe(false);

  const modelWithStreamingTrue = new ChatGoogle({
    streaming: true,
  });
  expect(modelWithStreamingTrue.streaming).toBe(true);
});
