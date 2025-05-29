/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import WatsonxAiMlVml_v1 from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  ChatWatsonx,
  ChatWatsonxConstructor,
  ChatWatsonxInput,
  WatsonxCallParams,
} from "../ibm.js";
import { authenticateAndSetInstance } from "../../utils/ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};
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

describe("LLM unit tests", () => {
  describe("Positive tests", () => {
    test("Test authentication function", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(WatsonxAiMlVml_v1);
    });

    test("Test basic properties after init", async () => {
      const testProps = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Authenticate with projectId", async () => {
      const testProps = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Authenticate with spaceId", async () => {
      const testProps = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        spaceId: process.env.WATSONX_AI_SPACE_ID || "testString",
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Authenticate with idOrName", async () => {
      const testProps = {
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        idOrName: process.env.WATSONX_AI_ID_OR_NAME || "testString",
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });
      testProperties(instance, testProps);
    });

    test("Test methods after init", () => {
      const testProps: ChatWatsonxInput = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
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
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
        model: "ibm/granite-13b-chat-v2",
        maxTokens: 100,
        temperature: 0.1,
        timeLimit: 10000,
        topP: 1,
        maxRetries: 3,
        maxConcurrency: 3,
      };
      const instance = new ChatWatsonx({ ...testProps, ...fakeAuthProp });

      testProperties(instance, testProps);
    });

    test("Missing id", async () => {
      const testProps: ChatWatsonxInput = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
      };
      const intance = new ChatWatsonx({
        ...testProps,
        ...fakeAuthProp,
      });
      expect(intance).toBeDefined();
    });

    test("Tool conversion handles both Zod schemas and JSON schemas", () => {
      const testProps: ChatWatsonxInput = {
        model: "ibm/granite-13b-chat-v2",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
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

  describe("Negative tests", () => {
    test("Missing other props", async () => {
      // @ts-expect-error Intentionally passing not enough parameters
      const testPropsProjectId: ChatWatsonxInput = {
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
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
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
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
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
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

    test("Not existing property passed", async () => {
      const testProps = {
        model: "mistralai/mistral-large",
        version: "2024-05-31",
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL as string,
        projectId: process.env.WATSONX_AI_PROJECT_ID || "testString",
      };
      const notExTestProps = {
        notExisting: 12,
        notExObj: {
          notExProp: 12,
        },
      };
      const instance = new ChatWatsonx({
        ...testProps,
        ...notExTestProps,
        ...fakeAuthProp,
      });
      testProperties(instance, testProps, notExTestProps);
    });
  });
});
