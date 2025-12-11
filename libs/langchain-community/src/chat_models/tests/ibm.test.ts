/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable dot-notation */
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { jest } from "@jest/globals";
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import {
  transformStreamToObjectStream,
  WatsonXAI,
} from "@ibm-cloud/watsonx-ai";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import {
  ChatWatsonx,
  ChatWatsonxConstructor,
  ChatWatsonxInput,
  WatsonxCallParams,
} from "../ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};

const model = "mistralai/mistral-medium-2505";
const projectId = process.env.WATSONX_AI_PROJECT_ID || "testString";
const serviceUrl = process.env.WATSONX_AI_SERVICE_URL as string;

export function getKey<K>(key: K): K {
  return key;
}

export const testProperties = (
  instance: ChatWatsonx,
  testProps: ChatWatsonxConstructor,
  notExTestProps?: { [key: string]: any }
) => {
  const checkProperty = <T extends { [key: string]: any }>(
    testProps: T,
    instance: T,
    existing = true
  ) => {
    Object.keys(testProps).forEach((key) => {
      const keys = getKey<keyof T>(key);
      type Type = Pick<T, typeof keys>;
      if (typeof testProps[key as keyof T] === "object")
        checkProperty<Type>(
          testProps[key as keyof T],
          instance[key as keyof typeof instance],
          existing
        );
      else {
        if (existing)
          expect(instance[key as keyof typeof instance]).toBe(
            testProps[key as keyof T]
          );
        else if (instance)
          expect(instance[key as keyof typeof instance]).toBeUndefined();
      }
    });
  };
  checkProperty<typeof testProps>(testProps, instance);
  if (notExTestProps)
    checkProperty<typeof notExTestProps>(notExTestProps, instance, false);
};

describe("Chat unit tests", () => {
  describe("Positive tests for default usage", () => {
    test("Test basic properties after init", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
      expect(instance["service"]).toBeInstanceOf(WatsonXAI);
    });

    test("Authenticate with projectId", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Authenticate with spaceId", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        spaceId: process.env.WATSONX_AI_SPACE_ID || "testString",
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Authenticate with idOrName", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        idOrName: process.env.WATSONX_AI_ID_OR_NAME || "testString",
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });
      testProperties(instance, testProps);
    });

    test("Test methods after init", () => {
      const testProps: ChatWatsonxInput = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const instance = new ChatWatsonx({
        ...testProps,
        ...fakeAuthProp,
      });
      expect(instance.getNumTokens).toBeDefined();
      expect(instance._generate).toBeDefined();
      expect(instance._streamResponseChunks).toBeDefined();
      expect(instance.invocationParams).toBeDefined();
    });

    test("Test properties after init", async () => {
      const testProps: WatsonxCallParams & ChatWatsonxInput = {
        version: "2024-05-31",
        serviceUrl,
        projectId,
        model: "ibm/granite-13b-chat-v2",
        maxTokens: 100,
        maxCompletionTokens: 100,
        temperature: 0.1,
        timeLimit: 10000,
        topP: 1,
        maxRetries: 3,
        maxConcurrency: 3,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });
    test("Calling correct method regarding the mode without streaming", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        maxTokens: 100,
        temperature: 0.1,
        topP: 1,
        projectId,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });
      if (instance["service"]) {
        const spy = jest.spyOn(instance["service"], "textChat");
        spy.mockResolvedValue({
          status: 200,
          headers: {},
          statusText: "OK",
          result: {
            id: "",
            created: 1752142071,
            model_id: model,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: " Hello! AI stands for",
                  refusal: "",
                  tool_calls: [],
                },
                finish_reason: "length",
              },
            ],
            usage: {
              prompt_tokens: 9,
              completion_tokens: 5,
              total_tokens: 14,
            },
          },
        });
        const res = await instance.invoke("hello");
        expect(res).toBeInstanceOf(AIMessage);
        spy.mockClear();
      } else throw new Error("Service is undefined");
    });
    test("Calling correct method regarding the mode with streaming", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        maxTokens: 100,
        temperature: 0.1,
        topP: 1,
        projectId,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });
      const chunk: WatsonXAI.TextChatStreamResponse = {
        id: "",
        created: 1752142071,
        model_id: model,
        choices: [
          {
            index: 0,
            delta: {
              role: "assistant",
              content: "HELLO",
              refusal: "",
            },
            finish_reason: "length",
          },
        ],
      };
      if (instance["service"]) {
        const spy = jest.spyOn(instance["service"], "textChatStream");
        const stream = [
          `id: 1\nevent: message\ndata: ${JSON.stringify(chunk)}\n\n`,
          `id: 2\nevent: message\ndata: ${JSON.stringify(chunk)}\n\n`,
        ][Symbol.iterator]();

        const transform = await transformStreamToObjectStream<
          WatsonXAI.ObjectStreamed<WatsonXAI.TextChatStreamResponse>
        >({
          result: stream,
        });

        spy.mockResolvedValue(transform);
        const res = await instance.stream("hello");
        expect(res).toBeInstanceOf(IterableReadableStream<AIMessageChunk>);
        spy.mockClear();
      } else throw new Error("Service is undefined");
    });

    test("Test override properties with invocationParams", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        projectId,
        model,
        maxTokens: 100,
        temperature: 0.1,
        topP: 1,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);

      const props = instance.invocationParams({
        maxTokens: 10,
        topP: 2,
      });

      expect(props).toEqual({
        maxTokens: 10,
        temperature: 0.1,
        topP: 2,
        projectId,
      });
    });

    test("Tool conversion handles both Zod schemas and JSON schemas", () => {
      const testProps: ChatWatsonxInput = {
        model: "ibm/granite-13b-chat-v2",
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const model = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      const zodTool = {
        name: "zodTool",
        description: "A tool with Zod schema",
        schema: z.object({
          input: z.string().describe("Input parameter"),
        }),
      };

      const jsonSchemaTool = {
        name: "jsonSchemaTool",
        description: "A tool with JSON schema",
        schema: {
          type: "object",
          properties: {
            input: {
              type: "string",
              description: "Input parameter",
            },
          },
          required: ["input"],
        },
      };

      expect(() => {
        const modelWithTools = model.bindTools([zodTool, jsonSchemaTool]);
        expect(modelWithTools).toBeDefined();
      }).not.toThrow();

      const mcpLikeTool = new DynamicStructuredTool({
        name: "mcpLikeTool",
        description: "Tool similar to MCP tools",
        schema: {
          type: "object",
          properties: {
            city: { type: "string" },
          },
          required: ["city"],
        },
        func: async () => "test result",
      });

      expect(() => {
        const modelWithMcpTool = model.bindTools([mcpLikeTool]);
        expect(modelWithMcpTool).toBeDefined();
      }).not.toThrow();
    });
  });

  describe("Positive tests with model gateway", () => {
    test("Authenticate", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        modelGateway: true,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
      expect(instance["gateway"]).toBeInstanceOf(Gateway);
    });

    test("Test properties after init", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model: "ibm/granite-13b-chat-v2",
        maxTokens: 100,
        temperature: 0.1,
        topP: 1,
        maxRetries: 3,
        maxConcurrency: 3,
        modelGatewayKwargs: {
          serviceTier: "test",
          functions: {
            test: "test",
          },
        },
        modelGateway: true,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Test override properties with invocationParams", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        maxTokens: 100,
        temperature: 0.1,
        topP: 1,
        modelGateway: true,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);

      const props = instance.invocationParams({
        maxTokens: 10,
        topP: 2,
      });

      expect(props).toEqual({
        maxTokens: 10,
        temperature: 0.1,
        topP: 2,
      });
    });

    test("Calling correct method in modelGateway mode", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl,
        model,
        maxTokens: 100,
        temperature: 0.1,
        topP: 1,
        modelGateway: true,
        streaming: false,
      };

      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });
      if (instance["gateway"]) {
        const spy = jest.spyOn(instance["gateway"].chat.completion, "create");

        spy.mockResolvedValue({
          status: 200,
          headers: {},
          statusText: "OK",
          result: {
            id: "",
            object: "chat.completion",
            created: 1752142071,
            model,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: " Hello! AI stands for",
                  refusal: "",
                  tool_calls: [],
                },
                finish_reason: "length",
              },
            ],
            usage: {
              prompt_tokens: 9,
              completion_tokens: 5,
              total_tokens: 14,
            },
            service_tier: "null",
            system_fingerprint: "",
            cached: false,
            prompt_filter_results: [],
          },
        });

        const res = await instance.invoke("hello");
        expect(res).toBeInstanceOf(AIMessage);
        spy.mockClear();
      } else throw new Error("Gateway is undefined");
    });
  });

  describe("Negative tests", () => {
    test("Missing id", async () => {
      const testProps: ChatWatsonxInput = {
        model,
        version: "2024-05-31",
        serviceUrl,
      };
      expect(
        () =>
          new ChatWatsonx({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow(
        /Expected exactly one of: spaceId, projectId, idOrName, modelGateway./
      );
    });

    test("Missing other props", async () => {
      // @ts-expect-error Intentionally passing not enough parameters
      const testPropsProjectId: ChatWatsonxInput = {
        projectId,
      };

      expect(
        () =>
          new ChatWatsonx({
            ...testPropsProjectId,
            ...fakeAuthProp,
          })
      ).toThrowError();
      // @ts-expect-error Intentionally passing not enough parameters
      const testPropsServiceUrl: ChatWatsonxInput = {
        serviceUrl,
      };
      expect(
        () =>
          new ChatWatsonx({
            ...testPropsServiceUrl,
            ...fakeAuthProp,
          })
      ).toThrowError();
      const testPropsVersion = {
        version: "2024-05-31",
      };
      expect(
        () =>
          new ChatWatsonx({
            // @ts-expect-error Intentionally passing wrong type of an object
            testPropsVersion,
          })
      ).toThrowError();
    });

    test("Passing more than one id", async () => {
      const testProps: ChatWatsonxInput = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
        spaceId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      expect(
        () =>
          new ChatWatsonx({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrowError();
    });
    test("Id with modelGateway", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
        modelGateway: true,
      };
      expect(
        () =>
          // @ts-expect-error Pass invalid props with modelGateway
          new ChatWatsonx({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow(
        /Expected exactly one of: spaceId, projectId, idOrName, modelGateway. Got: projectId, modelGateway/
      );
    });
    test("projectId with invalid props", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
        modelGatewayKwargs: {},
      };
      expect(
        () =>
          // @ts-expect-error Pass invalid props with projectId
          new ChatWatsonx({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow(/Unexpected properties: modelGatewayKwargs./);
    });
    test("modelGateway with invalid props", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        modelGateway: true,
        timeLimit: 10,
      };
      expect(
        () =>
          // @ts-expect-error Pass invalid props with modelGateway
          new ChatWatsonx({
            ...testProps,
            ...fakeAuthProp,
          })
      ).toThrow(/Unexpected properties: timeLimit./);
    });
    test("Not existing property passed", async () => {
      const testProps = {
        model,
        version: "2024-05-31",
        serviceUrl,
        projectId,
      };
      const notExTestProps = {
        notExisting: 12,
        notExObj: {
          notExProp: 12,
        },
      };
      expect(
        () =>
          new ChatWatsonx({
            ...testProps,
            ...notExTestProps,
            ...fakeAuthProp,
          })
      ).toThrow(/Unexpected properties: notExisting, notExObj./);
    });
  });
});
